"""Request throttling backed by Redis in production.

Slowapi resolves its key before FastAPI authentication dependencies execute,
so a bearer-token claim cannot safely be used here without performing JWT
verification twice. Request limits therefore use the client IP address; AI
generation also has verified-user daily and monthly quota enforcement after
authentication.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.requests import Request

from app.core.config import settings


def request_ip_key(request: Request) -> str:
    """Use a non-forgeable pre-authentication limiter key."""
    return f"ip:{get_remote_address(request)}"


limiter = Limiter(
    key_func=request_ip_key,
    default_limits=["600/hour"],
    storage_uri=settings.RATE_LIMIT_STORAGE_URI or "memory://",
)
