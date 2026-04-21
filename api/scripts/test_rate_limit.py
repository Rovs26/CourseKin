"""Smoke-test for Phase 3 rate limiting.

Tests:
  1. user_or_ip_key returns "user:<sub>" when a Bearer JWT is present
  2. user_or_ip_key returns "ip:<addr>" when no Bearer token is present
  3. A minimal FastAPI+slowapi app fires 429 after limit is hit and the
     response body has the friendly message format.

Run from the api/ directory:
    python3 scripts/test_rate_limit.py
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# ── Test 1 & 2: user_or_ip_key ────────────────────────────────────────────────

import jwt as pyjwt
from unittest.mock import MagicMock


def make_mock_request(auth_header: str | None = None, ip: str = "1.2.3.4") -> MagicMock:
    req = MagicMock()
    req.headers.get = lambda key, default="": auth_header if key == "Authorization" and auth_header else default
    req.client.host = ip
    return req


# Import after sys.path is set
from app.core.rate_limit import user_or_ip_key

# Build a fake JWT with a known sub (no signature verification)
fake_token = pyjwt.encode({"sub": "user_abc123", "email": "test@example.com"}, "secret", algorithm="HS256")

mock_authed = make_mock_request(auth_header=f"Bearer {fake_token}")
key_authed = user_or_ip_key(mock_authed)
if key_authed == "user:user_abc123":
    print("[PASS] Test 1: authed request keyed as user:user_abc123")
else:
    print(f"[FAIL] Test 1: expected 'user:user_abc123', got '{key_authed}'")

mock_anon = make_mock_request(ip="10.0.0.1")
key_anon = user_or_ip_key(mock_anon)
if key_anon == "ip:10.0.0.1":
    print("[PASS] Test 2: anon request keyed as ip:10.0.0.1")
else:
    print(f"[FAIL] Test 2: expected 'ip:10.0.0.1', got '{key_anon}'")

mock_bad_token = make_mock_request(auth_header="Bearer this.is.garbage")
key_bad = user_or_ip_key(mock_bad_token)
if key_bad.startswith("ip:"):
    print(f"[PASS] Test 3: bad token falls back to IP keying ({key_bad})")
else:
    print(f"[FAIL] Test 3: bad token did not fall back to IP, got '{key_bad}'")

# ── Test 4: 429 friendly message from a minimal app ──────────────────────────

import threading
import time
import urllib.request
import urllib.error

from fastapi import FastAPI, Request as StarletteRequest
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
import uvicorn

test_app = FastAPI()
test_limiter = Limiter(key_func=get_remote_address)
test_app.state.limiter = test_limiter


async def friendly_rate_limit_handler(request: StarletteRequest, exc: RateLimitExceeded) -> JSONResponse:
    return JSONResponse(
        status_code=429,
        content={
            "error": "rate_limit_exceeded",
            "detail": "You're going a bit fast. Please wait a moment and try again.",
            "retry_after_seconds": 60,
        },
        headers={"Retry-After": "60"},
    )


test_app.add_exception_handler(RateLimitExceeded, friendly_rate_limit_handler)


@test_app.get("/test-limited")
@test_limiter.limit("3/minute")
def limited_endpoint(request: StarletteRequest):
    return {"ok": True}


server = uvicorn.Server(uvicorn.Config(test_app, port=18765, log_level="error"))
thread = threading.Thread(target=server.run, daemon=True)
thread.start()
time.sleep(2)

# Hit it 4 times — 4th must be 429
hit_429 = False
for i in range(1, 5):
    try:
        with urllib.request.urlopen(f"http://localhost:18765/test-limited", timeout=5) as resp:
            status = resp.status
    except urllib.error.HTTPError as e:
        status = e.code
        if status == 429:
            body = e.read().decode()
            hit_429 = True
            if '"rate_limit_exceeded"' in body and "going a bit fast" in body and "retry_after_seconds" in body:
                print(f"[PASS] Test 4: request {i} → 429 with correct friendly body")
                print(f"       Body: {body.strip()}")
            else:
                print(f"[FAIL] Test 4: 429 body missing expected fields: {body}")
    if status != 429 and i <= 3:
        pass  # expected success

if not hit_429:
    print("[FAIL] Test 4: never hit 429 after 4 requests at 3/minute limit")

server.should_exit = True
time.sleep(1)

print("\nAll tests complete.")
