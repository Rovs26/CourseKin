import logging
from datetime import datetime, timedelta, timezone

from app.core.config import settings
from app.core.utils import utc_now_iso
from app.db.database import SessionLocal
from app.db.models import CourseStreamEntry, Job, Source
from app.services.course_answer_service import run_course_answer_in_background
from app.services.course_coaching_service import run_course_coaching_in_background
from app.services.generation_service import run_generation_in_background
from app.services.planning_service import run_syllabus_extraction_in_background
from app.services.source_chunk_service import ensure_source_chunks, serialize_chunks
from app.services.usage_service import release_reserved_cost

logger = logging.getLogger(__name__)


def _stale_cutoff_iso() -> str:
    cutoff = datetime.now(timezone.utc) - timedelta(seconds=settings.JOB_STALE_SECONDS)
    return cutoff.strftime("%Y-%m-%dT%H:%M:%SZ")


def recover_stale_jobs() -> int:
    """Requeue interrupted work and fail jobs that exhausted retry attempts."""
    db = SessionLocal()
    recovered = 0
    try:
        jobs = (
            db.query(Job)
            .filter(Job.status == "processing", Job.updated_at < _stale_cutoff_iso())
            .all()
        )
        for job in jobs:
            if job.attempts >= settings.JOB_MAX_ATTEMPTS:
                job.status = "failed"
                job.stage = "failed"
                job.error_message = "Generation worker retry limit exceeded"
                if job.user_id:
                    release_reserved_cost(db, job.user_id, job.id)
            else:
                job.status = "queued"
                job.stage = "queued"
                job.error_message = None
            job.updated_at = utc_now_iso()
            recovered += 1
        db.commit()
        return recovered
    finally:
        db.close()


def process_next_queued_job() -> bool:
    """Claim and execute one queued job. Intended for one or more worker services."""
    db = SessionLocal()
    try:
        query = db.query(Job).filter(Job.status == "queued").order_by(Job.created_at.asc())
        if settings.is_postgres:
            query = query.with_for_update(skip_locked=True)
        job = query.first()
        if not job:
            return False

        job.status = "processing"
        job.stage = "generating"
        job.attempts += 1
        job.updated_at = utc_now_iso()
        options = job.generation_options or {}
        source = db.get(Source, job.source_id)
        db.commit()

        if not source or not (source.text or "").strip():
            job.status = "failed"
            job.stage = "failed"
            job.error_message = "Source text is unavailable"
            job.updated_at = utc_now_iso()
            if job.job_type in {"answer-course-question", "coach-coursework"}:
                item = db.get(CourseStreamEntry, options.get("stream_entry_id", ""))
                if item:
                    if job.job_type == "answer-course-question" and item.answer_job_id == job.id:
                        item.answer_status = "failed"
                        item.updated_at = job.updated_at
                    if job.job_type == "coach-coursework" and item.coaching_job_id == job.id:
                        item.coaching_status = "failed"
                        item.updated_at = job.updated_at
            if job.user_id:
                release_reserved_cost(db, job.user_id, job.id)
            db.commit()
            return True

        job_id = job.id
        project_id = job.project_id
        source_id = source.id
        job_type = job.job_type
        user_id = job.user_id
        source_text = source.text or ""
        source_title = source.title
        source_chunks = serialize_chunks(ensure_source_chunks(db, source))
        if job_type in {"answer-course-question", "coach-coursework"}:
            source_ids = options.get("source_ids") or [source.id]
            answer_sources = {
                item.id: item
                for item in db.query(Source)
                .filter(Source.project_id == project_id, Source.id.in_(source_ids))
                .all()
            }
            if set(answer_sources) != set(source_ids):
                job.status = "failed"
                job.stage = "failed"
                job.error_message = "Linked course material is unavailable"
                job.updated_at = utc_now_iso()
                item = db.get(CourseStreamEntry, options.get("stream_entry_id", ""))
                if item:
                    if job_type == "answer-course-question" and item.answer_job_id == job.id:
                        item.answer_status = "failed"
                        item.updated_at = job.updated_at
                    if job_type == "coach-coursework" and item.coaching_job_id == job.id:
                        item.coaching_status = "failed"
                        item.updated_at = job.updated_at
                if job.user_id:
                    release_reserved_cost(db, job.user_id, job.id)
                db.commit()
                return True
            source_chunks = []
            for selected_source_id in source_ids:
                selected_source = answer_sources[selected_source_id]
                for chunk in serialize_chunks(ensure_source_chunks(db, selected_source)):
                    source_chunks.append({**chunk, "source_title": selected_source.title})
        db.commit()
    finally:
        db.close()

    if job_type == "extract-syllabus":
        run_syllabus_extraction_in_background(
            job_id=job_id,
            project_id=project_id,
            source_id=source_id,
            source_text=source_text,
            user_id=user_id,
        )
        return True

    if job_type == "answer-course-question":
        run_course_answer_in_background(
            job_id=job_id,
            project_id=project_id,
            entry_id=options.get("stream_entry_id", ""),
            source_chunks=source_chunks,
            explanation_mode=options.get("explanation_mode", "standard"),
            user_id=user_id,
        )
        return True

    if job_type == "coach-coursework":
        run_course_coaching_in_background(
            job_id=job_id,
            project_id=project_id,
            entry_id=options.get("stream_entry_id", ""),
            source_chunks=source_chunks,
            user_id=user_id,
        )
        return True

    run_generation_in_background(
        job_id=job_id,
        project_id=project_id,
        source_id=source_id,
        source_text=source_text,
        source_title=source_title,
        source_chunks=source_chunks,
        user_id=user_id,
        sections=options.get("sections"),
        counts=options.get("counts"),
        merge_mode=options.get("merge_mode", "skip"),
    )
    return True
