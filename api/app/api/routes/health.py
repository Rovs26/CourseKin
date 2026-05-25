import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.database import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="", tags=["Health"])

# Bump this when cutting a release.
APP_VERSION = "0.1.0"


@router.get("/")
def root():
    return {"message": "ReviewFlow API running"}


@router.get("/health")
def health():
    """Lightweight liveness probe — no DB call so Railway healthcheck never hangs."""
    return {
        "status": "ok",
        "version": APP_VERSION,
        "env": settings.APP_ENV,
    }


@router.get("/ready")
def ready(db: Session = Depends(get_db)):
    """Readiness probe used during deploy verification and staging acceptance."""
    try:
        db.execute(text("SELECT 1"))
    except Exception as exc:
        logger.error("Database readiness check failed: %s", exc)
        raise HTTPException(status_code=503, detail="database_unavailable") from exc
    return {
        "status": "ready",
        "version": APP_VERSION,
        "env": settings.APP_ENV,
        "database": "ok",
    }
