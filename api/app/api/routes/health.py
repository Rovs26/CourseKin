import logging
from datetime import datetime, timezone

from fastapi import APIRouter
from sqlalchemy import text

from app.core.config import settings
from app.db.database import SessionLocal

logger = logging.getLogger(__name__)

router = APIRouter(prefix="", tags=["Health"])


@router.get("/")
def root():
    return {"message": "ReviewFlow API running"}


@router.get("/health")
def health():
    """Structured health check: DB connectivity + OpenAI key configured."""
    checks = {}

    # Database connectivity
    try:
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        db.close()
        checks["database"] = "ok"
    except Exception as e:
        logger.error("Health check: database unreachable — %s", e)
        checks["database"] = "unreachable"

    # OpenAI API key configured
    if settings.OPENAI_API_KEY and len(settings.OPENAI_API_KEY) > 8:
        checks["openai_key"] = "configured"
    else:
        checks["openai_key"] = "missing"

    all_ok = all(v in ("ok", "configured") for v in checks.values())

    return {
        "status": "healthy" if all_ok else "degraded",
        "checks": checks,
        "environment": settings.APP_ENV,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }