"""Smoke-test for usage_service: check_monthly_quota + record_usage.

Run from the api/ directory:
    python scripts/test_quota.py

Creates an in-memory SQLite DB, inserts fake UsageLog rows, and verifies
that check_monthly_quota raises 402 only after the limit is crossed.
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi import HTTPException

from app.db.database import Base
from app.db.models import UsageLog
from app.core.config import settings
from app.services.usage_service import check_monthly_quota, record_usage

# ── Setup ──────────────────────────────────────────────────────────────────────
engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
Base.metadata.create_all(engine)
Session = sessionmaker(bind=engine)
db = Session()

TEST_USER = "test-user-quota-smoke"

print(f"FREE_TIER_MONTHLY_USD = ${settings.FREE_TIER_MONTHLY_USD:.4f}")
print()

# ── Test 1: no usage → quota check passes ─────────────────────────────────────
try:
    check_monthly_quota(user_id=TEST_USER, db=db)
    print("[PASS] Test 1: no usage — quota check passes (no exception)")
except HTTPException:
    print("[FAIL] Test 1: quota check raised 402 with zero usage")

# ── Test 2: record_usage inserts a row ────────────────────────────────────────
record_usage(
    db=db,
    user_id=TEST_USER,
    job_id="job-001",
    model="gpt-4.1-nano",
    prompt_tokens=1000,
    completion_tokens=500,
    cost_usd=0.10,
)
row_count = db.query(UsageLog).filter(UsageLog.user_id == TEST_USER).count()
if row_count == 1:
    print("[PASS] Test 2: record_usage inserted 1 row")
else:
    print(f"[FAIL] Test 2: expected 1 row, got {row_count}")

# ── Test 3: below limit → quota check still passes ───────────────────────────
try:
    check_monthly_quota(user_id=TEST_USER, db=db)
    print("[PASS] Test 3: below limit — quota check passes")
except HTTPException:
    print("[FAIL] Test 3: quota raised 402 when below limit")

# ── Test 4: cached usage has cost_usd = 0 ────────────────────────────────────
record_usage(
    db=db,
    user_id=TEST_USER,
    job_id="job-002",
    model="gpt-4.1-nano",
    prompt_tokens=500,
    completion_tokens=200,
    cost_usd=9999.0,   # should be overridden to 0 when cached=True
    cached=True,
)
cached_row = db.query(UsageLog).filter(UsageLog.job_id == "job-002").first()
if cached_row and cached_row.cost_usd == 0.0:
    print("[PASS] Test 4: cached row has cost_usd = 0.0")
else:
    print(f"[FAIL] Test 4: cached row cost_usd = {cached_row.cost_usd if cached_row else 'MISSING'}")

# ── Test 5: push over limit → 402 raised ─────────────────────────────────────
remaining = settings.FREE_TIER_MONTHLY_USD - 0.10   # already spent 0.10 above
record_usage(
    db=db,
    user_id=TEST_USER,
    job_id="job-003",
    model="gpt-4.1-nano",
    prompt_tokens=0,
    completion_tokens=0,
    cost_usd=remaining + 0.01,   # just over the limit
)
try:
    check_monthly_quota(user_id=TEST_USER, db=db)
    print("[FAIL] Test 5: no exception raised when over limit")
except HTTPException as e:
    if e.status_code == 402:
        print(f"[PASS] Test 5: over limit — 402 raised correctly: {e.detail[:60]}...")
    else:
        print(f"[FAIL] Test 5: wrong status code {e.status_code}")

# ── Test 6: different user is unaffected ─────────────────────────────────────
try:
    check_monthly_quota(user_id="other-user-unaffected", db=db)
    print("[PASS] Test 6: different user is unaffected by first user's usage")
except HTTPException:
    print("[FAIL] Test 6: different user incorrectly got 402")

# ── Done ──────────────────────────────────────────────────────────────────────
db.close()
print("\nAll tests complete.")
