from fastapi import HTTPException, Request
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models import UsageLog
from app.services.turnstile_service import verify_turnstile


TURNSTILE_GENERATION_THRESHOLD = 3


def require_generation_challenge(
    request: Request,
    turnstile_token: str | None,
    user_id: str,
    db: Session,
) -> None:
    """Require bot verification for a user's initial generation requests."""
    prior_count = db.query(func.count(UsageLog.id)).filter(
        UsageLog.user_id == user_id,
    ).scalar() or 0
    if prior_count >= TURNSTILE_GENERATION_THRESHOLD:
        return
    if settings.APP_ENV != "production" and not settings.TURNSTILE_SECRET_KEY:
        return
    if not turnstile_token:
        raise HTTPException(status_code=400, detail="turnstile_required")
    remote_ip = request.client.host if request.client else None
    if not verify_turnstile(turnstile_token, remote_ip):
        raise HTTPException(status_code=400, detail="turnstile_failed")
