"""Generate citation-grounded answers for questions in a private course stream."""

import json
import logging
import time

from openai import OpenAI

from app.core.config import settings
from app.core.utils import utc_now_iso
from app.db.database import SessionLocal
from app.db.models import CourseStreamEntry, Job
from app.services.usage_service import PRICING, record_usage, release_reserved_cost

logger = logging.getLogger(__name__)

EXPLANATION_MODE_INSTRUCTIONS = {
    "standard": "Give a clear university-level explanation.",
    "simplified": "Explain using simpler language and short sentences without removing essential meaning.",
    "step_by_step": "Explain in numbered conceptual steps so the student can follow the reasoning.",
    "example_first": "Start with an example supported by the material, then connect it to the concept.",
}


def _compute_cost(model: str, prompt_tokens: int, completion_tokens: int) -> float:
    input_rate, output_rate = PRICING.get(model, (0.15, 0.60))
    return (prompt_tokens * input_rate + completion_tokens * output_rate) / 1_000_000


def _prepare_chunks(chunks: list[dict]) -> list[dict]:
    selected: list[dict] = []
    remaining = settings.MAX_EXTRACTED_CHARS
    for chunk in chunks:
        text = str(chunk.get("text", "")).strip()
        if not text or remaining <= 0:
            continue
        selected_text = text[:remaining].strip()
        if not selected_text:
            continue
        selected.append({**chunk, "text": selected_text})
        remaining -= len(selected_text)
    return selected


def _format_material(chunks: list[dict]) -> str:
    sections = []
    for chunk in chunks:
        page_label = f", page {chunk['page_number']}" if chunk.get("page_number") else ""
        sections.append(
            f"[{chunk['id']}; {chunk['source_title']}{page_label}]\n{chunk['text']}"
        )
    return "\n\n".join(sections)


def _call_openai(question: str, source_material: str, explanation_mode: str) -> tuple[dict, dict]:
    system_prompt = """You are CourseKin, answering a university student's question from attached course materials only.

Return strict JSON only:
{"answer":"string or null","citations":["chunk-id"],"insufficient_evidence":true|false}

Rules:
- Use only the provided course material. Do not use outside knowledge or web sources.
- Answer clearly and pedagogically when the material supports an answer.
- Cite every answer using the bracketed chunk IDs from the material.
- If the course material does not support a reliable answer, set answer to null,
  citations to [], and insufficient_evidence to true.
- Never invent a citation."""
    style_instruction = EXPLANATION_MODE_INSTRUCTIONS.get(
        explanation_mode, EXPLANATION_MODE_INSTRUCTIONS["standard"]
    )
    user_prompt = (
        f"Student question:\n{question}\n\nRequested explanation style:\n{style_instruction}"
        f"\n\nAttached course material:\n{source_material}"
    )
    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    started = time.perf_counter()
    response = client.chat.completions.create(
        model=settings.OPENAI_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.2,
        response_format={"type": "json_object"},
        max_tokens=settings.OPENAI_MAX_OUTPUT_TOKENS,
        timeout=settings.OPENAI_TIMEOUT_SECONDS,
    )
    usage = response.usage
    prompt_tokens = usage.prompt_tokens if usage else 0
    completion_tokens = usage.completion_tokens if usage else 0
    logger.info("Course answer completed in %.1fs", time.perf_counter() - started)
    return json.loads(response.choices[0].message.content or "{}"), {
        "model": settings.OPENAI_MODEL,
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
        "cost_usd": _compute_cost(settings.OPENAI_MODEL, prompt_tokens, completion_tokens),
    }


def normalize_grounded_answer(payload: dict, chunks: list[dict]) -> dict:
    chunks_by_id = {str(chunk["id"]): chunk for chunk in chunks}
    raw_ids = payload.get("citations")
    citations = []
    seen_ids: set[str] = set()
    if isinstance(raw_ids, list):
        for value in raw_ids:
            chunk_id = value if isinstance(value, str) else None
            if isinstance(value, dict) and isinstance(value.get("chunk_id"), str):
                chunk_id = value["chunk_id"]
            chunk = chunks_by_id.get(str(chunk_id))
            if not chunk or chunk["id"] in seen_ids:
                continue
            seen_ids.add(chunk["id"])
            citations.append(
                {
                    "chunk_id": chunk["id"],
                    "source_id": chunk["source_id"],
                    "source_title": chunk["source_title"],
                    "page_number": chunk.get("page_number"),
                    "excerpt": str(chunk["text"]).replace("\n", " ").strip()[:320],
                }
            )

    answer = payload.get("answer")
    answer = answer.strip()[:10000] if isinstance(answer, str) else ""
    if not answer or not citations:
        return {
            "answer_status": "insufficient_evidence",
            "answer_content": None,
            "answer_evidence": {
                "status": "not_found",
                "source_scope": "course_materials_only",
                "citations": [],
            },
        }
    return {
        "answer_status": "answered",
        "answer_content": answer,
        "answer_evidence": {
            "status": "supported",
            "source_scope": "course_materials_only",
            "citations": citations,
        },
    }


def answer_question_now(
    question: str,
    source_chunks: list[dict],
    explanation_mode: str = "standard",
) -> tuple[dict, dict]:
    """Synchronous grounded answer for chat-style Q&A over a course's materials.

    Returns ``(normalized_answer, usage)``. ``usage`` is zeroed when no model call
    was made (no usable chunks) so the caller can still record it consistently.
    """
    chunks = _prepare_chunks(source_chunks)
    zero_usage = {
        "model": settings.OPENAI_MODEL,
        "prompt_tokens": 0,
        "completion_tokens": 0,
        "cost_usd": 0.0,
    }
    if not chunks:
        return (
            {
                "answer_status": "insufficient_evidence",
                "answer_content": None,
                "answer_evidence": {
                    "status": "not_found",
                    "source_scope": "course_materials_only",
                    "citations": [],
                },
            },
            zero_usage,
        )
    payload, usage = _call_openai(question, _format_material(chunks), explanation_mode)
    return normalize_grounded_answer(payload, chunks), usage


def run_course_answer_in_background(
    job_id: str,
    project_id: str,
    entry_id: str,
    source_chunks: list[dict],
    explanation_mode: str = "standard",
    user_id: str | None = None,
) -> None:
    db = SessionLocal()
    try:
        job = db.get(Job, job_id)
        item = db.get(CourseStreamEntry, entry_id)
        if not job or not item or item.project_id != project_id or item.answer_job_id != job_id:
            if job:
                job.status = "failed"
                job.stage = "failed"
                job.error_message = "Question changed before answer generation started"
                job.updated_at = utc_now_iso()
                db.commit()
            if user_id:
                release_reserved_cost(db, user_id, job_id)
            return

        chunks = _prepare_chunks(source_chunks)
        if not chunks:
            item.answer_status = "failed"
            job.status = "failed"
            job.stage = "failed"
            job.error_message = "Attached course material has no usable evidence"
            job.updated_at = utc_now_iso()
            item.updated_at = job.updated_at
            db.commit()
            if user_id:
                release_reserved_cost(db, user_id, job_id)
            return

        item.answer_status = "generating"
        job.stage = "generating"
        item.updated_at = utc_now_iso()
        job.updated_at = item.updated_at
        db.commit()

        try:
            payload, usage = _call_openai(item.content, _format_material(chunks), explanation_mode)
            answer = normalize_grounded_answer(payload, chunks)
        except Exception as exc:
            logger.error("Course answer generation failed: job=%s error=%s", job_id, exc)
            item.answer_status = "failed"
            job.status = "failed"
            job.stage = "failed"
            job.error_message = str(exc)
            job.updated_at = utc_now_iso()
            item.updated_at = job.updated_at
            db.commit()
            if user_id:
                release_reserved_cost(db, user_id, job_id)
            return

        db.refresh(item)
        now = utc_now_iso()
        if item.answer_job_id == job_id and item.entry_type == "question":
            item.answer_status = answer["answer_status"]
            item.answer_content = answer["answer_content"]
            item.answer_evidence = answer["answer_evidence"]
            item.answer_generated_at = now
            item.updated_at = now
        job.status = "completed"
        job.stage = "completed"
        job.error_message = None
        job.updated_at = now
        db.commit()
        if user_id:
            record_usage(db=db, user_id=user_id, job_id=job_id, **usage)
    except Exception as exc:
        logger.exception("Unexpected course answer failure: %s", exc)
        db.rollback()
        job = db.get(Job, job_id)
        item = db.get(CourseStreamEntry, entry_id)
        if job:
            job.status = "failed"
            job.stage = "failed"
            job.error_message = "Unexpected course answer failure"
            job.updated_at = utc_now_iso()
            if item and item.answer_job_id == job_id:
                item.answer_status = "failed"
                item.updated_at = job.updated_at
            db.commit()
        if user_id:
            release_reserved_cost(db, user_id, job_id)
    finally:
        db.close()
