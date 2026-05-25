import logging

from fastapi import APIRouter

from app.core.config import settings

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
