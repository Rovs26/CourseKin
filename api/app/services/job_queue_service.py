import logging
from datetime import datetime, timedelta, timezone

from app.core.config import settings
from app.core.utils import utc_now_iso
from app.db.database import SessionLocal
from app.db.models import Job, Source
from app.services.generation_service import run_generation_in_background
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
        source = db.get(Source, job.source_id)
        options = job.generation_options or {}
        db.commit()

        if not source or not (source.text or "").strip():
            job.status = "failed"
            job.stage = "failed"
            job.error_message = "Source text is unavailable"
            job.updated_at = utc_now_iso()
            if job.user_id:
                release_reserved_cost(db, job.user_id, job.id)
            db.commit()
            return True

        job_id = job.id
        project_id = job.project_id
        source_id = source.id
        user_id = job.user_id
        source_text = source.text or ""
        source_title = source.title
        source_chunks = serialize_chunks(ensure_source_chunks(db, source))
        db.commit()
    finally:
        db.close()

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
