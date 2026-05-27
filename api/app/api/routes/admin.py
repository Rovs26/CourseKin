import logging
from datetime import date, datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from app.core.auth import CurrentUser, get_current_user
from app.core.config import settings
from app.core.utils import utc_now_iso
from app.db.database import get_db
from app.db.models import (
    BannedUser,
    CourseObligation,
    GenerationCache,
    Job,
    PreparationMilestone,
    UsageLog,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["Admin"])
VALIDATED_OBLIGATION_FIELDS = (
    "title",
    "obligation_type",
    "due_date",
    "details",
    "grading_criteria",
)


def require_admin(current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    """Dependency that allows only emails listed in ADMIN_EMAILS."""
    admin_emails = {e.strip().lower() for e in settings.ADMIN_EMAILS.split(",") if e.strip()}
    if not admin_emails:
        raise HTTPException(status_code=403, detail="Admin access is not configured")
    if (current_user.email or "").lower() not in admin_emails:
        raise HTTPException(status_code=403, detail="Forbidden")
    return current_user


# ── Cache stats ───────────────────────────────────────────────────────────────

@router.get("/cache-stats")
def cache_stats(
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_admin),
):
    """Return generation cache statistics."""
    total_entries = db.query(func.count(GenerationCache.id)).scalar() or 0
    total_hits = db.query(func.sum(GenerationCache.hit_count)).scalar() or 0

    total_calls = db.query(func.count(UsageLog.id)).scalar() or 0
    cached_calls = (
        db.query(func.count(UsageLog.id)).filter(UsageLog.cached == True).scalar() or 0  # noqa: E712
    )

    hit_rate = round(cached_calls / total_calls, 4) if total_calls else 0.0

    return {
        "cache_entries": total_entries,
        "total_cache_hits": int(total_hits),
        "total_generation_calls": total_calls,
        "cached_calls": cached_calls,
        "hit_rate": hit_rate,
    }


# ── Abuse summary ─────────────────────────────────────────────────────────────


def _rate(numerator: int, denominator: int) -> float:
    return round(numerator / denominator, 4) if denominator else 0.0


@router.get("/course-planning/validation")
def course_planning_validation(
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_admin),
):
    """Return pilot metrics for validated syllabus extraction and preparation activity."""
    reviewed = (
        db.query(CourseObligation)
        .filter(
            CourseObligation.proposal_snapshot.isnot(None),
            CourseObligation.reviewed_snapshot.isnot(None),
        )
        .all()
    )
    confirmed = [
        item for item in reviewed if (item.reviewed_snapshot or {}).get("status") == "confirmed"
    ]
    dismissed = [
        item for item in reviewed if (item.reviewed_snapshot or {}).get("status") == "dismissed"
    ]
    field_corrections = {field: 0 for field in VALIDATED_OBLIGATION_FIELDS}
    corrected_confirmations = 0
    for item in confirmed:
        proposal = item.proposal_snapshot or {}
        student_review = item.reviewed_snapshot or {}
        corrected_fields = [
            field
            for field in VALIDATED_OBLIGATION_FIELDS
            if proposal.get(field) != student_review.get(field)
        ]
        if corrected_fields:
            corrected_confirmations += 1
        for field in corrected_fields:
            field_corrections[field] += 1

    dated_assessments = (
        db.query(CourseObligation)
        .filter(
            CourseObligation.status == "confirmed",
            CourseObligation.due_date.isnot(None),
        )
        .all()
    )
    assessment_ids = [item.id for item in dated_assessments]
    milestones_by_obligation: dict[str, list[PreparationMilestone]] = {}
    if assessment_ids:
        for milestone in (
            db.query(PreparationMilestone)
            .filter(PreparationMilestone.obligation_id.in_(assessment_ids))
            .all()
        ):
            milestones_by_obligation.setdefault(milestone.obligation_id, []).append(milestone)

    assessments_with_runway = [
        item for item in dated_assessments if milestones_by_obligation.get(item.id)
    ]
    prepared_before_due_date = 0
    for assessment in assessments_with_runway:
        due_date = date.fromisoformat(assessment.due_date)
        if any(
            milestone.status == "completed"
            and milestone.completed_at
            and date.fromisoformat(milestone.completed_at[:10]) < due_date
            for milestone in milestones_by_obligation[assessment.id]
        ):
            prepared_before_due_date += 1

    unchanged_confirmations = len(confirmed) - corrected_confirmations
    return {
        "extraction_review": {
            "measurable_reviews": len(reviewed),
            "confirmed": len(confirmed),
            "dismissed": len(dismissed),
            "unchanged_confirmations": unchanged_confirmations,
            "corrected_confirmations": corrected_confirmations,
            "unchanged_confirmation_rate": _rate(unchanged_confirmations, len(confirmed)),
            "field_corrections": field_corrections,
        },
        "preparation_return": {
            "confirmed_dated_assessments": len(dated_assessments),
            "assessments_with_runway": len(assessments_with_runway),
            "assessments_with_early_completed_session": prepared_before_due_date,
            "early_preparation_rate": _rate(
                prepared_before_due_date, len(assessments_with_runway)
            ),
        },
        "notes": [
            "Extraction metrics cover obligations reviewed after proposal snapshots were introduced.",
            "Early preparation is a behavioral proxy: at least one planned session completed before the assessment due date.",
            "A real-student pilot is still required before claiming learning improvement or enabling outbound reminders.",
        ],
    }


@router.get("/abuse/summary")
def abuse_summary(
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_admin),
):
    """Aggregate abuse metrics for the last 24 hours."""
    now = datetime.now(timezone.utc)
    cutoff_24h = (now - timedelta(hours=24)).isoformat()
    cutoff_1h = (now - timedelta(hours=1)).isoformat()

    # Users with >5 jobs in the last hour
    high_volume_users = (
        db.query(Job.project_id, func.count(Job.id).label("job_count"))
        .filter(Job.created_at >= cutoff_1h)
        .group_by(Job.project_id)
        .having(func.count(Job.id) > 5)
        .all()
    )

    # Users with >50% failed job ratio (last 24h, min 3 jobs)
    all_jobs_24h = (
        db.query(
            Job.project_id,
            func.count(Job.id).label("total"),
            func.sum(case((Job.status == "failed", 1), else_=0)).label("failed"),
        )
        .filter(Job.created_at >= cutoff_24h)
        .group_by(Job.project_id)
        .all()
    )
    high_failure_users = [
        {"project_id": r.project_id, "total": r.total, "failed": r.failed or 0}
        for r in all_jobs_24h
        if r.total >= 3 and (r.failed or 0) / r.total > 0.5
    ]

    # Current banned users
    banned = db.query(BannedUser).all()

    return {
        "high_volume_last_hour": [
            {"project_id": r.project_id, "job_count": r.job_count}
            for r in high_volume_users
        ],
        "high_failure_ratio_24h": high_failure_users,
        "banned_users": [
            {
                "user_id": b.user_id,
                "reason": b.reason,
                "banned_at": b.banned_at,
                "banned_by": b.banned_by,
            }
            for b in banned
        ],
    }


# ── Ban / unban ───────────────────────────────────────────────────────────────

class BanRequest(BaseModel):
    user_id: str
    reason: str


class UnbanRequest(BaseModel):
    user_id: str


@router.post("/abuse/ban")
def ban_user(
    payload: BanRequest,
    db: Session = Depends(get_db),
    admin: CurrentUser = Depends(require_admin),
):
    """Add a user to the ban list."""
    existing = db.get(BannedUser, payload.user_id)
    if existing:
        raise HTTPException(status_code=400, detail="User is already banned")

    banned = BannedUser(
        user_id=payload.user_id,
        reason=payload.reason,
        banned_at=utc_now_iso(),
        banned_by=admin.email or admin.user_id,
    )
    db.add(banned)
    db.commit()
    logger.info("User banned: %s by %s (reason: %s)", payload.user_id, admin.email, payload.reason)
    return {"message": f"User {payload.user_id} has been banned"}


@router.post("/abuse/unban")
def unban_user(
    payload: UnbanRequest,
    db: Session = Depends(get_db),
    admin: CurrentUser = Depends(require_admin),
):
    """Remove a user from the ban list."""
    banned = db.get(BannedUser, payload.user_id)
    if not banned:
        raise HTTPException(status_code=404, detail="User is not banned")

    db.delete(banned)
    db.commit()
    logger.info("User unbanned: %s by %s", payload.user_id, admin.email)
    return {"message": f"User {payload.user_id} has been unbanned"}
