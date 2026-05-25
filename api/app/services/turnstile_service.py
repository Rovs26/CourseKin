"""Cloudflare Turnstile token verification."""

import logging

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


def verify_turnstile(token: str, remote_ip: str | None = None) -> bool:
    """Verify a Turnstile challenge token against Cloudflare's siteverify API.

    Returns True if the token is valid (or if Turnstile is not configured in dev).
    Returns False if verification fails.
    """
    if not settings.TURNSTILE_SECRET_KEY:
        if settings.APP_ENV == "production":
            # Fail closed in production — misconfigured Turnstile = no bot protection
            logger.error("TURNSTILE_SECRET_KEY not set in production — rejecting request")
            return False
        # Dev mode: pass through when no secret is configured
        return True

    try:
        with httpx.Client(timeout=10) as client:
            resp = client.post(
                settings.TURNSTILE_VERIFY_URL,
                data={
                    "secret": settings.TURNSTILE_SECRET_KEY,
                    "response": token,
                    "remoteip": remote_ip or "",
                },
            )
        data = resp.json()
        return bool(data.get("success"))
    except Exception as e:
        logger.warning("Turnstile verification error: %s", e)
        return False
