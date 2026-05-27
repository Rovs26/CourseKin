"""Generate bounded, citation-grounded coursework coaching from course evidence."""

import json
import logging
import time

from openai import OpenAI

from app.core.config import settings
from app.core.utils import utc_now_iso
from app.db.database import SessionLocal
from app.db.models import CourseStreamEntry, Job
from app.services.course_answer_service import _format_material, _prepare_chunks
from app.services.usage_service import PRICING, record_usage, release_reserved_cost

logger = logging.getLogger(__name__)

MODE_INSTRUCTIONS = {
    "assignment_plan": (
        "Break the confirmed requirement and rubric into a completion checklist and work plan. "
        "Do not write submission-ready prose."
    ),
    "draft_feedback": (
        "Give feedback on the student's short draft: requirement coverage, clarity, missing support, "
        "and concrete revision guidance. Do not rewrite the whole submission."
    ),
    "office_hours": (
        "Prepare focused questions and talking points the student can take to office hours. "
        "Support human help-seeking rather than replacing it."
    ),
}


def _compute_cost(model: str, prompt_tokens: int, completion_tokens: int) -> float:
    input_rate, output_rate = PRICING.get(model, (0.15, 0.60))
    return (prompt_tokens * input_rate + completion_tokens * output_rate) / 1_000_000


def _call_openai(
    content: str,
    mode: str,
    context: dict | None,
    source_material: str,
) -> tuple[dict, dict]:
    system_prompt = """You are CourseKin's bounded coursework coach for university students.

Return strict JSON only:
{"guidance":"string or null","next_steps":["string"],"rubric_checks":["string"],"questions_for_instructor":["string"],"limitation_note":"string","citations":["chunk-id"],"insufficient_evidence":true|false}

Rules:
- Use only the supplied course materials and confirmed task context. Do not use web sources or outside facts.
- This feature supports light assignments, short papers, and office-hours preparation only.
- Never produce a completed assignment, presentation/slides, thesis section, data analysis, or group-paper authorship.
- Cite the advice using bracketed chunk IDs from attached material.
- If there is not enough material for reliable coaching, set guidance to null, citations to [], and insufficient_evidence to true.
- For draft feedback, critique and guide revision; do not rewrite the student's entire draft."""
    mode_instruction = MODE_INSTRUCTIONS.get(mode, MODE_INSTRUCTIONS["office_hours"])
    user_prompt = (
        f"Coaching mode:\n{mode_instruction}\n\nConfirmed task context:\n"
        f"{json.dumps(context or {}, ensure_ascii=False)}\n\nStudent input:\n{content}"
        f"\n\nAttached course materials:\n{source_material}"
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
    logger.info("Coursework coaching completed in %.1fs", time.perf_counter() - started)
    return json.loads(response.choices[0].message.content or "{}"), {
        "model": settings.OPENAI_MODEL,
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
        "cost_usd": _compute_cost(settings.OPENAI_MODEL, prompt_tokens, completion_tokens),
    }


def normalize_grounded_coaching(payload: dict, chunks: list[dict]) -> dict:
    chunks_by_id = {str(chunk["id"]): chunk for chunk in chunks}
    citations = []
    seen_ids: set[str] = set()
    raw_ids = payload.get("citations")
    if isinstance(raw_ids, list):
        for value in raw_ids:
            chunk_id = value if isinstance(value, str) else None
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
    guidance = payload.get("guidance")
    guidance = guidance.strip()[:10000] if isinstance(guidance, str) else ""
    if not guidance or not citations:
        return {
            "coaching_status": "insufficient_evidence",
            "coaching_output": None,
            "coaching_evidence": {
                "status": "not_found",
                "source_scope": "course_materials_only",
                "citations": [],
            },
        }

    def _text_list(key: str) -> list[str]:
        values = payload.get(key)
        if not isinstance(values, list):
            return []
        return [value.strip()[:500] for value in values[:10] if isinstance(value, str) and value.strip()]

    limitation = payload.get("limitation_note")
    limitation = (
        limitation.strip()[:500]
        if isinstance(limitation, str) and limitation.strip()
        else "Guidance only: keep authorship and final submission decisions with the student."
    )
    return {
        "coaching_status": "ready",
        "coaching_output": {
            "guidance": guidance,
            "next_steps": _text_list("next_steps"),
            "rubric_checks": _text_list("rubric_checks"),
            "questions_for_instructor": _text_list("questions_for_instructor"),
            "limitation_note": limitation,
        },
        "coaching_evidence": {
            "status": "supported",
            "source_scope": "course_materials_only",
            "citations": citations,
        },
    }


def run_course_coaching_in_background(
    job_id: str,
    project_id: str,
    entry_id: str,
    source_chunks: list[dict],
    user_id: str | None = None,
) -> None:
    db = SessionLocal()
    try:
        job = db.get(Job, job_id)
        item = db.get(CourseStreamEntry, entry_id)
        if not job or not item or item.project_id != project_id or item.coaching_job_id != job_id:
            if job:
                job.status = "failed"
                job.stage = "failed"
                job.error_message = "Coaching request changed before generation started"
                job.updated_at = utc_now_iso()
                db.commit()
            if user_id:
                release_reserved_cost(db, user_id, job_id)
            return
        chunks = _prepare_chunks(source_chunks)
        if not chunks:
            item.coaching_status = "failed"
            job.status = "failed"
            job.stage = "failed"
            job.error_message = "Attached course material has no usable evidence"
            job.updated_at = utc_now_iso()
            item.updated_at = job.updated_at
            db.commit()
            if user_id:
                release_reserved_cost(db, user_id, job_id)
            return

        item.coaching_status = "generating"
        job.stage = "generating"
        item.updated_at = utc_now_iso()
        job.updated_at = item.updated_at
        db.commit()
        try:
            payload, usage = _call_openai(
                item.content,
                item.coaching_mode or "office_hours",
                item.coaching_context,
                _format_material(chunks),
            )
            result = normalize_grounded_coaching(payload, chunks)
        except Exception as exc:
            logger.error("Coursework coaching failed: job=%s error=%s", job_id, exc)
            item.coaching_status = "failed"
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
        if item.coaching_job_id == job_id and item.entry_type == "coaching":
            item.coaching_status = result["coaching_status"]
            item.coaching_output = result["coaching_output"]
            item.coaching_evidence = result["coaching_evidence"]
            item.coaching_generated_at = now
            item.updated_at = now
        job.status = "completed"
        job.stage = "completed"
        job.error_message = None
        job.updated_at = now
        db.commit()
        if user_id:
            record_usage(db=db, user_id=user_id, job_id=job_id, **usage)
    except Exception as exc:
        logger.exception("Unexpected coursework coaching failure: %s", exc)
        db.rollback()
        job = db.get(Job, job_id)
        item = db.get(CourseStreamEntry, entry_id)
        if job:
            job.status = "failed"
            job.stage = "failed"
            job.error_message = "Unexpected coursework coaching failure"
            job.updated_at = utc_now_iso()
            if item and item.coaching_job_id == job_id:
                item.coaching_status = "failed"
                item.updated_at = job.updated_at
            db.commit()
        if user_id:
            release_reserved_cost(db, user_id, job_id)
    finally:
        db.close()
