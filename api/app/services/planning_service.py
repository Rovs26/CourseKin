"""AI-assisted syllabus extraction that always produces student-review proposals."""

import json
import logging
import time
from datetime import date
from uuid import uuid4

from openai import OpenAI

from app.core.config import settings
from app.core.utils import utc_now_iso
from app.db.database import SessionLocal
from app.db.models import CourseObligation, Job, Project
from app.services.usage_service import PRICING, record_usage, release_reserved_cost

logger = logging.getLogger(__name__)

VALID_TYPES = {"quiz", "exam", "assignment", "project", "paper", "reading", "other"}
VALID_CONFIDENCE = {"high", "medium", "low"}


def _compute_cost(model: str, prompt_tokens: int, completion_tokens: int) -> float:
    input_rate, output_rate = PRICING.get(model, (0.15, 0.60))
    return (prompt_tokens * input_rate + completion_tokens * output_rate) / 1_000_000


def _call_openai(source_text: str, project: Project) -> tuple[dict, dict]:
    source_text = source_text[: settings.MAX_EXTRACTED_CHARS]
    context = [
        f"Course title: {project.title}",
        f"Field: {project.field_of_study}",
    ]
    if project.course_code:
        context.append(f"Course code: {project.course_code}")
    if project.term:
        context.append(f"Academic term: {project.term}")

    system_prompt = """You extract academic obligations from a university course syllabus.

Return strict JSON only in this schema:
{"obligations":[{"title":"string","obligation_type":"quiz|exam|assignment|project|paper|reading|other","due_date":"YYYY-MM-DD or null","details":"string or null","grading_criteria":"string or null","confidence":"high|medium|low","uncertain_fields":["field_name"]}]}

Rules:
- Use only obligations explicitly stated in the syllabus.
- Extract assessments, light assignments, projects, papers, required readings with due dates, and exams.
- Never infer a calendar date. If a date is incomplete or ambiguous, set due_date to null and add "due_date" to uncertain_fields.
- Preserve any grading percentage, rubric, or criteria in grading_criteria.
- These are proposals for the student to review, not confirmed calendar events."""
    user_prompt = "\n".join(context) + "\n\nSyllabus text:\n" + source_text

    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    start = time.perf_counter()
    response = client.chat.completions.create(
        model=settings.OPENAI_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.1,
        response_format={"type": "json_object"},
        max_tokens=settings.OPENAI_MAX_OUTPUT_TOKENS,
        timeout=settings.OPENAI_TIMEOUT_SECONDS,
    )
    usage = response.usage
    prompt_tokens = usage.prompt_tokens if usage else 0
    completion_tokens = usage.completion_tokens if usage else 0
    logger.info("Syllabus extraction completed in %.1fs", time.perf_counter() - start)
    return json.loads(response.choices[0].message.content or "{}"), {
        "model": settings.OPENAI_MODEL,
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
        "cost_usd": _compute_cost(settings.OPENAI_MODEL, prompt_tokens, completion_tokens),
    }


def _valid_date(value: object) -> str | None:
    if not isinstance(value, str):
        return None
    try:
        date.fromisoformat(value)
    except ValueError:
        return None
    return value


def _optional_text(value: object) -> str | None:
    if not isinstance(value, str):
        return None
    text = value.strip()[:2000]
    return text or None


def _normalize_obligations(payload: dict) -> list[dict]:
    items = payload.get("obligations")
    if not isinstance(items, list):
        return []
    normalized = []
    for raw in items[:100]:
        if not isinstance(raw, dict):
            continue
        title_value = raw.get("title")
        title = title_value.strip()[:200] if isinstance(title_value, str) else ""
        if not title:
            continue
        raw_date = raw.get("due_date")
        due_date = _valid_date(raw_date)
        raw_uncertain = raw.get("uncertain_fields")
        uncertain = [
            str(field)[:50]
            for field in raw_uncertain if isinstance(field, str)
        ] if isinstance(raw_uncertain, list) else []
        if raw_date and not due_date and "due_date" not in uncertain:
            uncertain.append("due_date")
        obligation_type = str(raw.get("obligation_type", "other"))
        confidence = str(raw.get("confidence", "low"))
        normalized.append(
            {
                "title": title,
                "obligation_type": obligation_type if obligation_type in VALID_TYPES else "other",
                "due_date": due_date,
                "details": _optional_text(raw.get("details")),
                "grading_criteria": _optional_text(raw.get("grading_criteria")),
                "confidence": confidence if confidence in VALID_CONFIDENCE else "low",
                "uncertain_fields": uncertain,
            }
        )
    return normalized


def run_syllabus_extraction_in_background(
    job_id: str,
    project_id: str,
    source_id: str,
    source_text: str,
    user_id: str | None = None,
) -> None:
    db = SessionLocal()
    try:
        job = db.get(Job, job_id)
        project = db.get(Project, project_id)
        if not job or not project:
            return
        job.stage = "generating"
        job.updated_at = utc_now_iso()
        db.commit()

        try:
            extracted, usage = _call_openai(source_text, project)
            proposals = _normalize_obligations(extracted)
        except Exception as exc:
            logger.error("Syllabus extraction failed: job=%s error=%s", job_id, exc)
            job.status = "failed"
            job.stage = "failed"
            job.error_message = str(exc)
            job.updated_at = utc_now_iso()
            db.commit()
            if user_id:
                release_reserved_cost(db, user_id, job_id)
            return

        prior_reviewed = {
            (item.title.casefold(), item.due_date)
            for item in db.query(CourseObligation)
            .filter(
                CourseObligation.source_id == source_id,
                CourseObligation.status != "proposed",
            )
            .all()
        }
        db.query(CourseObligation).filter(
            CourseObligation.source_id == source_id,
            CourseObligation.status == "proposed",
        ).delete()
        now = utc_now_iso()
        for proposal in proposals:
            if (proposal["title"].casefold(), proposal["due_date"]) in prior_reviewed:
                continue
            db.add(
                CourseObligation(
                    id=str(uuid4()),
                    project_id=project_id,
                    source_id=source_id,
                    status="proposed",
                    proposal_snapshot=dict(proposal),
                    created_at=now,
                    updated_at=now,
                    **proposal,
                )
            )

        job.status = "completed"
        job.stage = "completed"
        job.error_message = None
        job.updated_at = now
        db.commit()
        if user_id:
            record_usage(db=db, user_id=user_id, job_id=job_id, **usage)
    except Exception as exc:
        logger.exception("Unexpected syllabus extraction failure: %s", exc)
        db.rollback()
        job = db.get(Job, job_id)
        if job:
            job.status = "failed"
            job.stage = "failed"
            job.error_message = "Unexpected syllabus extraction failure"
            job.updated_at = utc_now_iso()
            db.commit()
        if user_id:
            release_reserved_cost(db, user_id, job_id)
    finally:
        db.close()
