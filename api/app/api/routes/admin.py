import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.auth import CurrentUser, get_current_user
from app.core.config import settings
from app.db.database import get_db
from app.db.models import GenerationCache, UsageLog

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["Admin"])


def require_admin(current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    """Dependency that allows only emails listed in ADMIN_EMAILS."""
    admin_emails = {e.strip().lower() for e in settings.ADMIN_EMAILS.split(",") if e.strip()}
    if not admin_emails:
        raise HTTPException(status_code=403, detail="Admin access is not configured")
    if (current_user.email or "").lower() not in admin_emails:
        raise HTTPException(status_code=403, detail="Forbidden")
    return current_user


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
