"""Usage accounting and generation quota enforcement."""

import logging
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import func, text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.utils import utc_now_iso
from app.db.models import Subscription, UsageLog

logger = logging.getLogger(__name__)

FREE_TIER_DAILY_GENS = 3
PAID_TIER_DAILY_GENS = 50
PRICING: dict[str, tuple[float, float]] = {
    "gpt-4.1-nano": (0.10, 0.40),
    "gpt-4o-mini": (0.15, 0.60),
    "gpt-4.1-mini": (0.40, 1.60),
}


def _month_start_iso() -> str:
    """Return ISO string for the first second of the current UTC calendar month.

    Example: "2026-04-01T00:00:00Z"
    We keep everything as ISO strings to stay consistent with the rest of the codebase
    (no datetime objects in the DB, no timezone library required).
    """
    now = utc_now_iso()           # e.g. "2026-04-21T14:30:00Z"
    year_month = now[:7]          # "2026-04"
    return f"{year_month}-01T00:00:00Z"


def _day_start_iso() -> str:
    """Return ISO string for the start of the current UTC day.

    Example: "2026-04-25T00:00:00Z"
    """
    now = utc_now_iso()   # "2026-04-25T14:30:00Z"
    return now[:10] + "T00:00:00Z"


def _is_active_plus(user_id: str, db: Session) -> bool:
    """Return True if the user has an active Plus subscription right now."""
    sub = db.get(Subscription, user_id)
    if sub is None:
        return False
    if sub.status != "active":
        return False
    if sub.plan not in ("plus_monthly", "plus_yearly"):
        return False
    return sub.current_period_end > utc_now_iso()


def estimated_generation_cost() -> float:
    """Return a conservative upper-bound reservation for one model call."""
    input_rate, output_rate = PRICING.get(settings.OPENAI_MODEL, (0.15, 0.60))
    # Reserve for bounded source text plus system/schema instructions and framing.
    estimated_prompt_tokens = (settings.MAX_EXTRACTED_CHARS + 3) // 4 + 2_500
    return (
        estimated_prompt_tokens * input_rate
        + settings.OPENAI_MAX_OUTPUT_TOKENS * output_rate
    ) / 1_000_000


def lock_quota_for_user(user_id: str, db: Session) -> None:
    """Serialize quota checks and reservations for one user in Postgres."""
    if settings.is_postgres:
        db.execute(
            text("SELECT pg_advisory_xact_lock(hashtext(:user_id))"),
            {"user_id": user_id},
        )


def check_monthly_quota(user_id: str, db: Session, requested_generations: int = 1) -> None:
    """Raise HTTP 402 if the user has exhausted their monthly quota.

    Plus users get PAID_TIER_MONTHLY_USD; free users get FREE_TIER_MONTHLY_USD.
    """
    is_paid = _is_active_plus(user_id, db)
    limit = settings.PAID_TIER_MONTHLY_USD if is_paid else settings.FREE_TIER_MONTHLY_USD
    month_start = _month_start_iso()

    spent: float = db.query(func.sum(UsageLog.cost_usd)).filter(
        UsageLog.user_id == user_id,
        UsageLog.created_at >= month_start,
    ).scalar() or 0.0

    logger.debug(
        "Quota check: user=%s spent=%.6f limit=%.6f paid=%s",
        user_id, spent, limit, is_paid,
    )

    reserved_cost = estimated_generation_cost() * requested_generations
    if spent + reserved_cost > limit:
        if is_paid:
            raise HTTPException(
                status_code=402,
                detail=(
                    f"Monthly Plus limit reached (${limit:.2f}/month). "
                    "Contact support if you need a higher limit."
                ),
            )
        raise HTTPException(
            status_code=402,
            detail=(
                f"Monthly free generation limit reached (${limit:.2f}/month). "
                "Upgrade to Plus to continue generating."
            ),
        )


def check_daily_cap(user_id: str, db: Session, requested_generations: int = 1) -> None:
    """Raise HTTP 429 if the user has hit their daily generation cap.

    Free users: 3 generations per day.
    Plus users: 50 generations per day.
    """
    is_paid = _is_active_plus(user_id, db)
    daily_limit = PAID_TIER_DAILY_GENS if is_paid else FREE_TIER_DAILY_GENS
    day_start = _day_start_iso()

    count: int = db.query(func.count(UsageLog.id)).filter(
        UsageLog.user_id == user_id,
        UsageLog.created_at >= day_start,
    ).scalar() or 0

    logger.debug(
        "Daily cap check: user=%s count=%d limit=%d paid=%s",
        user_id, count, daily_limit, is_paid,
    )

    if count + requested_generations > daily_limit:
        upgrade_note = "" if is_paid else " Upgrade to Plus for up to 50/day."
        raise HTTPException(
            status_code=429,
            detail=(
                f"Daily generation limit reached ({daily_limit}/day).{upgrade_note}"
            ),
        )


def reserve_usage(db: Session, user_id: str, job_id: str) -> None:
    """Reserve a worst-case spend allocation before a queued job is accepted."""
    db.add(
        UsageLog(
            id=str(uuid4()),
            user_id=user_id,
            job_id=job_id,
            model="reserved",
            prompt_tokens=0,
            completion_tokens=0,
            cost_usd=estimated_generation_cost(),
            cached=False,
            created_at=utc_now_iso(),
        )
    )


def release_reserved_cost(db: Session, user_id: str, job_id: str) -> None:
    """Zero a reservation for a terminal job that never incurred model spend."""
    entry = (
        db.query(UsageLog)
        .filter(
            UsageLog.user_id == user_id,
            UsageLog.job_id == job_id,
            UsageLog.model == "reserved",
        )
        .first()
    )
    if entry:
        entry.model = "failed"
        entry.cost_usd = 0.0
        db.commit()


def record_usage(
    db: Session,
    user_id: str,
    job_id: str | None,
    model: str,
    prompt_tokens: int,
    completion_tokens: int,
    cost_usd: float,
    cached: bool = False,
) -> None:
    """Replace a queued reservation with actual cost, or insert legacy usage."""
    entry = None
    if job_id:
        entry = (
            db.query(UsageLog)
            .filter(
                UsageLog.user_id == user_id,
                UsageLog.job_id == job_id,
                UsageLog.model == "reserved",
            )
            .first()
        )
    if entry is None:
        entry = UsageLog(
            id=str(uuid4()),
            user_id=user_id,
            job_id=job_id,
            created_at=utc_now_iso(),
        )
        db.add(entry)
    entry.model = model
    entry.prompt_tokens = prompt_tokens
    entry.completion_tokens = completion_tokens
    entry.cost_usd = 0.0 if cached else cost_usd
    entry.cached = cached
    db.commit()

    logger.info(
        "Usage recorded: user=%s job=%s model=%s tokens=%d+%d cost_usd=%.6f cached=%s",
        user_id, job_id, model, prompt_tokens, completion_tokens,
        0.0 if cached else cost_usd, cached,
    )
