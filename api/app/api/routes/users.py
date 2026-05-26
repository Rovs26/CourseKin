"""User self-service endpoints: data export and account deletion."""

import io
import json
import logging
import zipfile

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.auth import CurrentUser, get_current_user
from app.core.rate_limit import limiter
from app.core.config import settings
from app.core.utils import utc_now_iso
from app.db.database import get_db
from app.api.routes.billing import revoke_polar_subscription
from app.db.models import (
    CourseObligation,
    GenerationCache,
    Job,
    PreparationMilestone,
    Project,
    Reviewer,
    ReviewerFeedback,
    Source,
    SourceChunk,
    Subscription,
    UsageLog,
)
from app.services import storage_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/users", tags=["Users"])


# ── Helpers ───────────────────────────────────────────────────────────────────

def _project_ids_for_user(user_id: str, db: Session) -> list[str]:
    rows = db.execute(
        select(Project.id).where(Project.user_id == user_id)
    ).scalars().all()
    return list(rows)


# ── GET /users/me/export ──────────────────────────────────────────────────────

@router.get("/me/export")
@limiter.limit("5/hour")
def export_my_data(
    request: Request,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return a ZIP archive containing all personal data for the current user."""
    user_id = current_user.user_id
    project_ids = _project_ids_for_user(user_id, db)

    # ── Collect data ──────────────────────────────────────────────────────────
    projects = db.execute(
        select(Project).where(Project.user_id == user_id)
    ).scalars().all()

    sources = (
        db.execute(
            select(Source).where(Source.project_id.in_(project_ids))
        ).scalars().all()
        if project_ids else []
    )

    source_chunks = (
        db.execute(
            select(SourceChunk).where(SourceChunk.project_id.in_(project_ids))
        ).scalars().all()
        if project_ids else []
    )

    course_obligations = (
        db.execute(
            select(CourseObligation).where(CourseObligation.project_id.in_(project_ids))
        ).scalars().all()
        if project_ids else []
    )

    preparation_milestones = (
        db.execute(
            select(PreparationMilestone).where(PreparationMilestone.project_id.in_(project_ids))
        ).scalars().all()
        if project_ids else []
    )

    jobs = (
        db.execute(
            select(Job).where(Job.project_id.in_(project_ids))
        ).scalars().all()
        if project_ids else []
    )

    reviewers = (
        db.execute(
            select(Reviewer).where(Reviewer.project_id.in_(project_ids))
        ).scalars().all()
        if project_ids else []
    )

    reviewer_feedback = (
        db.execute(
            select(ReviewerFeedback).where(ReviewerFeedback.project_id.in_(project_ids))
        ).scalars().all()
        if project_ids else []
    )

    usage_logs = db.execute(
        select(UsageLog).where(UsageLog.user_id == user_id)
    ).scalars().all()
    generation_cache = db.execute(
        select(GenerationCache).where(GenerationCache.user_id == user_id)
    ).scalars().all()
    subscription = db.get(Subscription, user_id)

    # ── Serialise ──────────────────────────────────────────────────────────────
    def project_to_dict(p: Project) -> dict:
        return {
            "id": p.id,
            "title": p.title,
            "project_type": p.project_type,
            "age_bracket": p.age_bracket,
            "learning_mode": p.learning_mode,
            "field_of_study": p.field_of_study,
            "source_mode": p.source_mode,
            "template_id": p.template_id,
            "course_code": p.course_code,
            "term": p.term,
            "instructor": p.instructor,
            "meeting_schedule": p.meeting_schedule,
            "reminders_enabled": p.reminders_enabled,
            "reminder_lead_days": p.reminder_lead_days,
            "created_at": p.created_at,
            "updated_at": p.updated_at,
        }

    def source_to_dict(s: Source) -> dict:
        d: dict = {
            "id": s.id,
            "project_id": s.project_id,
            "title": s.title,
            "type": s.type,
            "status": s.status,
            "purpose": s.purpose,
            "url": s.url,
            "file_name": s.file_name,
            "text": s.text,
            "created_at": s.created_at,
            "updated_at": s.updated_at,
        }
        # Generate a short-lived presigned GET URL for R2-backed files
        if s.storage_key and settings.r2_configured:
            try:
                d["download_url"] = storage_service.generate_presigned_get(
                    s.storage_key, expires_in=3600
                )
            except Exception:
                d["download_url"] = None
        return d

    def job_to_dict(j: Job) -> dict:
        return {
            "id": j.id,
            "project_id": j.project_id,
            "source_id": j.source_id,
            "job_type": j.job_type,
            "status": j.status,
            "stage": j.stage,
            "error_message": j.error_message,
            "created_at": j.created_at,
            "updated_at": j.updated_at,
        }

    def chunk_to_dict(chunk: SourceChunk) -> dict:
        return {
            "id": chunk.id,
            "source_id": chunk.source_id,
            "project_id": chunk.project_id,
            "ordinal": chunk.ordinal,
            "page_number": chunk.page_number,
            "text": chunk.text,
            "created_at": chunk.created_at,
        }

    def obligation_to_dict(obligation: CourseObligation) -> dict:
        return {
            "id": obligation.id,
            "project_id": obligation.project_id,
            "source_id": obligation.source_id,
            "title": obligation.title,
            "obligation_type": obligation.obligation_type,
            "due_date": obligation.due_date,
            "details": obligation.details,
            "grading_criteria": obligation.grading_criteria,
            "confidence": obligation.confidence,
            "uncertain_fields": obligation.uncertain_fields,
            "status": obligation.status,
            "created_at": obligation.created_at,
            "updated_at": obligation.updated_at,
        }

    def milestone_to_dict(milestone: PreparationMilestone) -> dict:
        return {
            "id": milestone.id,
            "project_id": milestone.project_id,
            "obligation_id": milestone.obligation_id,
            "title": milestone.title,
            "milestone_type": milestone.milestone_type,
            "sequence": milestone.sequence,
            "scheduled_date": milestone.scheduled_date,
            "estimated_minutes": milestone.estimated_minutes,
            "status": milestone.status,
            "completed_at": milestone.completed_at,
            "created_at": milestone.created_at,
            "updated_at": milestone.updated_at,
        }

    def reviewer_to_dict(r: Reviewer) -> dict:
        return {
            "project_id": r.project_id,
            "source_id": r.source_id,
            "status": r.status,
            "output_type": r.output_type,
            "version": r.version,
            "content_json": r.content_json,
            "created_at": r.created_at,
            "updated_at": r.updated_at,
        }

    def usage_log_to_dict(u: UsageLog) -> dict:
        return {
            "id": u.id,
            "job_id": u.job_id,
            "model": u.model,
            "prompt_tokens": u.prompt_tokens,
            "completion_tokens": u.completion_tokens,
            "cost_usd": u.cost_usd,
            "cached": u.cached,
            "created_at": u.created_at,
        }

    def feedback_to_dict(feedback: ReviewerFeedback) -> dict:
        return {
            "id": feedback.id,
            "project_id": feedback.project_id,
            "reviewer_version": feedback.reviewer_version,
            "section": feedback.section,
            "item_index": None if feedback.item_index == -1 else feedback.item_index,
            "rating": feedback.rating,
            "comment": feedback.comment,
            "created_at": feedback.created_at,
            "updated_at": feedback.updated_at,
        }

    def cache_to_dict(entry: GenerationCache) -> dict:
        return {
            "id": entry.id,
            "content_json": entry.content_json,
            "model": entry.model,
            "prompt_version": entry.prompt_version,
            "hit_count": entry.hit_count,
            "created_at": entry.created_at,
            "last_hit_at": entry.last_hit_at,
        }

    def subscription_to_dict(sub: Subscription | None) -> dict | None:
        if sub is None:
            return None
        return {
            "plan": sub.plan,
            "status": sub.status,
            "polar_customer_id": sub.polar_customer_id,
            "polar_subscription_id": sub.polar_subscription_id,
            "current_period_end": sub.current_period_end,
            "created_at": sub.created_at,
            "updated_at": sub.updated_at,
        }

    # ── Build ZIP in memory ───────────────────────────────────────────────────
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(
            "user.json",
            json.dumps(
                {
                    "user_id": user_id,
                    "email": current_user.email,
                    "exported_at": utc_now_iso(),
                },
                indent=2,
            ),
        )
        zf.writestr(
            "projects.json",
            json.dumps([project_to_dict(p) for p in projects], indent=2),
        )
        zf.writestr(
            "sources.json",
            json.dumps([source_to_dict(s) for s in sources], indent=2),
        )
        zf.writestr(
            "source_chunks.json",
            json.dumps([chunk_to_dict(chunk) for chunk in source_chunks], indent=2),
        )
        zf.writestr(
            "course_obligations.json",
            json.dumps([obligation_to_dict(item) for item in course_obligations], indent=2),
        )
        zf.writestr(
            "preparation_milestones.json",
            json.dumps([milestone_to_dict(item) for item in preparation_milestones], indent=2),
        )
        zf.writestr(
            "jobs.json",
            json.dumps([job_to_dict(j) for j in jobs], indent=2),
        )
        zf.writestr(
            "reviewers.json",
            json.dumps([reviewer_to_dict(r) for r in reviewers], indent=2),
        )
        zf.writestr(
            "reviewer_feedback.json",
            json.dumps([feedback_to_dict(feedback) for feedback in reviewer_feedback], indent=2),
        )
        zf.writestr(
            "usage_log.json",
            json.dumps([usage_log_to_dict(u) for u in usage_logs], indent=2),
        )
        zf.writestr(
            "generation_cache.json",
            json.dumps([cache_to_dict(entry) for entry in generation_cache], indent=2),
        )
        zf.writestr(
            "subscription.json",
            json.dumps(subscription_to_dict(subscription), indent=2),
        )

    buf.seek(0)
    logger.info("Data export generated for user_id=%s", user_id)

    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="coursekin-export-{user_id[:8]}.zip"'
        },
    )


# ── DELETE /users/me ──────────────────────────────────────────────────────────

@router.delete("/me", status_code=204)
@limiter.limit("3/hour")
def delete_my_account(
    request: Request,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Permanently delete the current user's account and all associated data."""
    user_id = current_user.user_id
    project_ids = _project_ids_for_user(user_id, db)
    subscription = db.get(Subscription, user_id)

    # 1. Revoke a paid subscription before deleting its mapping.
    if subscription and subscription.status != "revoked":
        revoke_polar_subscription(subscription.polar_subscription_id)

    # 2. Delete R2 objects for all sources owned by this user
    if project_ids and settings.r2_configured:
        sources_with_files = db.execute(
            select(Source.storage_key).where(
                Source.project_id.in_(project_ids),
                Source.storage_key.isnot(None),
            )
        ).scalars().all()

        for key in sources_with_files:
            if key:
                storage_service.delete_object(key, strict=True)

    # 3. Delete DB rows in dependency order
    if project_ids:
        # Reviewers and jobs reference projects
        db.execute(
            Reviewer.__table__.delete().where(Reviewer.project_id.in_(project_ids))
        )
        db.execute(
            Job.__table__.delete().where(Job.project_id.in_(project_ids))
        )
        db.execute(
            ReviewerFeedback.__table__.delete().where(
                ReviewerFeedback.project_id.in_(project_ids)
            )
        )
        db.execute(
            PreparationMilestone.__table__.delete().where(
                PreparationMilestone.project_id.in_(project_ids)
            )
        )
        db.execute(
            CourseObligation.__table__.delete().where(
                CourseObligation.project_id.in_(project_ids)
            )
        )
        db.execute(
            SourceChunk.__table__.delete().where(SourceChunk.project_id.in_(project_ids))
        )
        db.execute(
            Source.__table__.delete().where(Source.project_id.in_(project_ids))
        )
        db.execute(
            Project.__table__.delete().where(Project.user_id == user_id)
        )

    # UsageLog is keyed by user_id directly
    db.execute(
        UsageLog.__table__.delete().where(UsageLog.user_id == user_id)
    )
    db.execute(
        GenerationCache.__table__.delete().where(GenerationCache.user_id == user_id)
    )
    db.execute(
        Subscription.__table__.delete().where(Subscription.user_id == user_id)
    )

    db.commit()
    logger.info("DB data purged for user_id=%s", user_id)

    # 4. Delete Clerk user. A failure is returned so deletion is never falsely reported complete.
    _delete_clerk_user(user_id)

    return None


def _delete_clerk_user(user_id: str) -> None:
    """Delete the authentication identity, surfacing provider failure to the user."""
    if not settings.CLERK_SECRET_KEY:
        raise HTTPException(status_code=503, detail="Account identity deletion is not configured")
    try:
        from clerk_backend_api import Clerk  # noqa: PLC0415

        clerk = Clerk(bearer_auth=settings.CLERK_SECRET_KEY)
        clerk.users.delete_user(user_id=user_id)
        logger.info("Clerk user deleted: %s", user_id)
    except Exception as exc:
        logger.error("Failed to delete Clerk user %s: %s", user_id, exc)
        raise HTTPException(status_code=502, detail="Account identity deletion failed; please retry")
