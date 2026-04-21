"""Rate limiting via slowapi.

Limits are intentionally generous — they exist to prevent abuse,
not to gate normal usage.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
