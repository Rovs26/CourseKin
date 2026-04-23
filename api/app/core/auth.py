"""Clerk JWT verification.

get_current_user is a FastAPI dependency that extracts the Authorization
Bearer token, verifies it against Clerk's JWKS, and returns a CurrentUser
dataclass with user_id, email, session_id, and email_verified.

get_current_user_optional returns None if no token is present, or the
CurrentUser if a valid token is provided.

require_owner is a helper that raises 403 if current_user.user_id != owner_id.
If owner_id is None (legacy projects with no user_id set), it also raises 403.
"""

import logging
import threading
from dataclasses import dataclass

import requests as http_requests
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import ExpiredSignatureError, JWTError, jwt
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.database import get_db

logger = logging.getLogger(__name__)

# ── JWKS cache ────────────────────────────────────────────────────────────────
# Clerk rotates keys rarely; caching in-process for the lifetime of the worker
# is safe and avoids a network round-trip on every request.
_jwks_cache: dict | None = None
_jwks_lock = threading.Lock()


def _get_jwks() -> dict:
    """Return the JWKS document, fetching it on first call and caching it."""
    global _jwks_cache
    if _jwks_cache is not None:
        return _jwks_cache
    with _jwks_lock:
        # Double-check after acquiring the lock
        if _jwks_cache is not None:
            return _jwks_cache
        if not settings.CLERK_JWKS_URL:
            raise HTTPException(
                status_code=500,
                detail="Server misconfiguration: CLERK_JWKS_URL is not set",
            )
        try:
            resp = http_requests.get(settings.CLERK_JWKS_URL, timeout=10)
            resp.raise_for_status()
            _jwks_cache = resp.json()
            logger.info("JWKS fetched and cached from %s", settings.CLERK_JWKS_URL)
        except HTTPException:
            raise
        except Exception as e:
            logger.error("Failed to fetch JWKS: %s", e)
            raise HTTPException(
                status_code=503,
                detail="Authentication service temporarily unavailable",
            )
        return _jwks_cache


# ── CurrentUser ───────────────────────────────────────────────────────────────

@dataclass
class CurrentUser:
    user_id: str
    email: str | None
    session_id: str | None
    email_verified: bool


# ── Bearer extractors ─────────────────────────────────────────────────────────
# auto_error=True  → FastAPI returns 403 automatically if header is missing
# auto_error=False → returns None so we can handle the optional case ourselves

_bearer = HTTPBearer(auto_error=True)
_bearer_optional = HTTPBearer(auto_error=False)


# ── Core verification ─────────────────────────────────────────────────────────

def _verify_token(token: str) -> CurrentUser:
    """Decode and verify a Clerk JWT; return CurrentUser on success."""
    try:
        jwks = _get_jwks()

        # Find the matching key by 'kid' header claim
        header = jwt.get_unverified_header(token)
        kid = header.get("kid")
        key = next((k for k in jwks.get("keys", []) if k.get("kid") == kid), None)
        if key is None:
            raise HTTPException(status_code=401, detail="Unauthorized: unknown signing key")

        # Decode options: disable audience check (Clerk doesn't set 'aud' by default)
        options: dict = {"verify_aud": False}

        payload = jwt.decode(
            token,
            key,
            algorithms=["RS256"],
            options=options,
            issuer=settings.CLERK_ISSUER if settings.CLERK_ISSUER else None,
        )

        user_id: str | None = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized: missing subject claim")

        return CurrentUser(
            user_id=user_id,
            email=payload.get("email"),
            session_id=payload.get("sid"),
            email_verified=bool(payload.get("email_verified", False)),
        )

    except HTTPException:
        raise
    except ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Unauthorized: token has expired")
    except JWTError as exc:
        raise HTTPException(status_code=401, detail=f"Unauthorized: {exc}")
    except Exception as exc:
        logger.error("Unexpected JWT verification error: %s", exc)
        raise HTTPException(status_code=401, detail="Unauthorized")


# ── FastAPI dependencies ───────────────────────────────────────────────────────

def _check_not_banned(user: CurrentUser, db: Session) -> None:
    """Raise 403 if the user is in the banned_users table."""
    # Import here to avoid circular imports (models → database → auth)
    from app.db.models import BannedUser  # noqa: PLC0415
    banned = db.get(BannedUser, user.user_id)
    if banned:
        raise HTTPException(status_code=403, detail="account_suspended")


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
    db: Session = Depends(get_db),
) -> CurrentUser:
    """Require a valid Clerk JWT. Returns CurrentUser or raises 401/403."""
    user = _verify_token(credentials.credentials)
    _check_not_banned(user, db)
    return user


def get_current_user_optional(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_optional),
    db: Session = Depends(get_db),
) -> CurrentUser | None:
    """Return CurrentUser if a valid JWT is present, else None."""
    if credentials is None:
        return None
    user = _verify_token(credentials.credentials)
    _check_not_banned(user, db)
    return user


# ── Ownership guard ───────────────────────────────────────────────────────────

def require_owner(current_user: CurrentUser, owner_id: str | None) -> None:
    """Raise 403 if current_user does not own the resource.

    owner_id=None means the resource has no owner set (legacy data) —
    we treat that as inaccessible rather than open to everyone.
    """
    if owner_id is None or current_user.user_id != owner_id:
        raise HTTPException(status_code=403, detail="Access denied")
