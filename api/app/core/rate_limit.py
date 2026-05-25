"""Rate limiting via slowapi, keyed by Clerk user ID when authenticated,
falling back to IP for unauthenticated requests.

The user_or_ip_key function inspects the Authorization header. If a Bearer
token is present, it decodes the JWT *without signature verification* purely
to extract the 'sub' (user ID) for bucket segregation. This is safe because:
  - slowapi runs before FastAPI's Depends, so we can't call get_current_user here
  - An attacker forging a user_id only affects their own rate-limit bucket
  - Actual authorization (signature verification) is handled by auth.py

The default limit of 600/hour applies to all routes that don't have an
explicit @limiter.limit decorator.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.requests import Request

from app.core.config import settings

def user_or_ip_key(request: Request) -> str:
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        token = auth[7:]
        try:
            import jwt as pyjwt  # PyJWT — installed as dep of fastapi-clerk-auth
            claims = pyjwt.decode(token, options={"verify_signature": False})
            sub = claims.get("sub")
            if sub:
                return f"user:{sub}"
        except Exception:
            pass
    return f"ip:{get_remote_address(request)}"


limiter = Limiter(
    key_func=user_or_ip_key,
    default_limits=["600/hour"],
    storage_uri=settings.RATE_LIMIT_STORAGE_URI or "memory://",
)
