"""Usage tracking and quota enforcement.

check_monthly_quota is called BEFORE every OpenAI call. If the user has
exceeded their monthly cap, it raises HTTPException(402) which turns into
a friendly 'quota exceeded' message on the frontend.

record_usage is called AFTER every successful OpenAI call (not on error,
not on cache hit where cost_usd=0.0).
"""

import logging
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.utils import utc_now_iso
from app.db.models import UsageLog

logger = logging.getLogger(__name__)


def _month_start_iso() -> str:
    """Return ISO string for the first second of the current UTC calendar month.

    Example: "2026-04-01T00:00:00Z"
    We keep everything as ISO strings to stay consistent with the rest of the codebase
    (no datetime objects in the DB, no timezone library required).
    """
    now = utc_now_iso()           # e.g. "2026-04-21T14:30:00Z"
    year_month = now[:7]          # "2026-04"
    return f"{year_month}-01T00:00:00Z"


def check_monthly_quota(user_id: str, db: Session) -> None:
    """Raise HTTP 402 if the user has exhausted their free-tier monthly quota.

    Sums all usage_log rows for this user since the start of the current calendar
    month and compares to settings.FREE_TIER_MONTHLY_USD.
    """
    month_start = _month_start_iso()

    spent: float = db.query(func.sum(UsageLog.cost_usd)).filter(
        UsageLog.user_id == user_id,
        UsageLog.created_at >= month_start,
    ).scalar() or 0.0

    logger.debug(
        "Quota check: user=%s spent=%.6f limit=%.6f",
        user_id, spent, settings.FREE_TIER_MONTHLY_USD,
    )

    if spent >= settings.FREE_TIER_MONTHLY_USD:
        raise HTTPException(
            status_code=402,
            detail=(
                f"Monthly free generation limit reached (${settings.FREE_TIER_MONTHLY_USD:.2f}/month). "
                "Upgrade to Plus to continue generating."
            ),
        )


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
    """Insert a UsageLog row for a completed OpenAI call.

    If cached=True the actual API cost was $0 so we force cost_usd to 0.0.
    """
    entry = UsageLog(
        id=str(uuid4()),
        user_id=user_id,
        job_id=job_id,
        model=model,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        cost_usd=0.0 if cached else cost_usd,
        cached=cached,
        created_at=utc_now_iso(),
    )
    db.add(entry)
    db.commit()

    logger.info(
        "Usage recorded: user=%s job=%s model=%s tokens=%d+%d cost_usd=%.6f cached=%s",
        user_id, job_id, model, prompt_tokens, completion_tokens,
        0.0 if cached else cost_usd, cached,
    )
