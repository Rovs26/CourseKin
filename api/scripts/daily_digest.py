"""Daily digest emailer — runs once a day via Railway cron (Phase 10).

Queries the last 24 hours and month-to-date from usage_log, jobs, and projects,
then sends an HTML summary email to ADMIN_EMAILS via Resend.

Usage:
    cd api
    python scripts/daily_digest.py
"""

import logging
import sys
import os
from datetime import datetime, timedelta, timezone

import httpx
from sqlalchemy import create_engine, func, select, distinct
from sqlalchemy.orm import Session

# Allow running from api/ without installing the package
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.config import settings
from app.db.models import UsageLog, Job, Project

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
logger = logging.getLogger("daily_digest")

RESEND_EMAILS_URL = "https://api.resend.com/emails"


def get_session() -> Session:
    connect_args = {"check_same_thread": False} if not settings.is_postgres else {}
    engine = create_engine(settings.DATABASE_URL, connect_args=connect_args)
    return Session(engine)


def collect_stats(db: Session) -> dict:
    now = datetime.now(timezone.utc)
    window_24h = (now - timedelta(hours=24)).isoformat()
    mtd_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()

    # ── 24-hour stats ──────────────────────────────────────────────────────────
    gens_24h = db.scalar(
        select(func.count()).select_from(UsageLog).where(UsageLog.created_at >= window_24h)
    ) or 0

    spend_24h = db.scalar(
        select(func.coalesce(func.sum(UsageLog.cost_usd), 0.0))
        .where(UsageLog.created_at >= window_24h, UsageLog.cached == False)  # noqa: E712
    ) or 0.0

    cache_hits_24h = db.scalar(
        select(func.count())
        .select_from(UsageLog)
        .where(UsageLog.created_at >= window_24h, UsageLog.cached == True)  # noqa: E712
    ) or 0

    cache_hit_rate = (cache_hits_24h / gens_24h * 100) if gens_24h else 0.0

    failed_24h = db.scalar(
        select(func.count())
        .select_from(Job)
        .where(Job.created_at >= window_24h, Job.status == "failed")
    ) or 0

    new_users_24h = db.scalar(
        select(func.count(distinct(Project.user_id)))
        .where(Project.created_at >= window_24h, Project.user_id.isnot(None))
    ) or 0

    # ── Month-to-date ──────────────────────────────────────────────────────────
    spend_mtd = db.scalar(
        select(func.coalesce(func.sum(UsageLog.cost_usd), 0.0))
        .where(UsageLog.created_at >= mtd_start, UsageLog.cached == False)  # noqa: E712
    ) or 0.0

    # ── Top-5 users by generations (all time) ──────────────────────────────────
    top_users = db.execute(
        select(UsageLog.user_id, func.count().label("count"))
        .where(UsageLog.created_at >= window_24h)
        .group_by(UsageLog.user_id)
        .order_by(func.count().desc())
        .limit(5)
    ).all()

    return {
        "date": now.strftime("%Y-%m-%d"),
        "gens_24h": gens_24h,
        "spend_24h": spend_24h,
        "spend_mtd": spend_mtd,
        "cache_hits_24h": cache_hits_24h,
        "cache_hit_rate": cache_hit_rate,
        "failed_24h": failed_24h,
        "new_users_24h": new_users_24h,
        "top_users": [(row.user_id, row.count) for row in top_users],
    }


def build_html(stats: dict) -> str:
    top_rows = "".join(
        f"<tr><td style='padding:4px 12px 4px 0'>{uid[:20]}…</td>"
        f"<td style='padding:4px 0'>{count}</td></tr>"
        for uid, count in stats["top_users"]
    ) or "<tr><td colspan='2'>No generations in last 24h</td></tr>"

    return f"""
<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;color:#222;max-width:600px;margin:0 auto">
  <h2>ReviewFlow daily digest — {stats['date']}</h2>

  <h3 style="margin-bottom:4px">Last 24 hours</h3>
  <table style="border-collapse:collapse">
    <tr><td style="padding:4px 16px 4px 0;color:#555">Generations</td>
        <td><strong>{stats['gens_24h']}</strong></td></tr>
    <tr><td style="padding:4px 16px 4px 0;color:#555">OpenAI spend</td>
        <td><strong>${stats['spend_24h']:.4f}</strong></td></tr>
    <tr><td style="padding:4px 16px 4px 0;color:#555">Cache hit rate</td>
        <td><strong>{stats['cache_hit_rate']:.1f}%</strong>
            ({stats['cache_hits_24h']} hits)</td></tr>
    <tr><td style="padding:4px 16px 4px 0;color:#555">Failed jobs</td>
        <td><strong>{stats['failed_24h']}</strong></td></tr>
    <tr><td style="padding:4px 16px 4px 0;color:#555">New users (proxy)</td>
        <td><strong>{stats['new_users_24h']}</strong></td></tr>
  </table>

  <h3 style="margin-bottom:4px">Month-to-date</h3>
  <table style="border-collapse:collapse">
    <tr><td style="padding:4px 16px 4px 0;color:#555">OpenAI spend</td>
        <td><strong>${stats['spend_mtd']:.4f}</strong></td></tr>
  </table>

  <h3 style="margin-bottom:4px">Top 5 users by generations (last 24h)</h3>
  <table style="border-collapse:collapse">
    <tr style="font-weight:bold;color:#555">
      <td style="padding:4px 12px 4px 0">User ID</td>
      <td>Gens</td>
    </tr>
    {top_rows}
  </table>

  <p style="color:#aaa;font-size:12px;margin-top:32px">
    Generated by ReviewFlow daily_digest.py
  </p>
</body>
</html>
""".strip()


def send_email(subject: str, html: str) -> None:
    if not settings.RESEND_API_KEY:
        logger.info("RESEND_API_KEY not set — skipping email send (dry-run mode)")
        return

    recipients = [e.strip() for e in settings.ADMIN_EMAILS.split(",") if e.strip()]
    if not recipients:
        logger.warning("ADMIN_EMAILS is empty — no recipients, skipping send")
        return

    resp = httpx.post(
        RESEND_EMAILS_URL,
        headers={"Authorization": f"Bearer {settings.RESEND_API_KEY}"},
        json={
            "from": "digest@reviewflow.app",
            "to": recipients,
            "subject": subject,
            "html": html,
        },
        timeout=15,
    )
    resp.raise_for_status()
    logger.info("Digest email sent: id=%s", resp.json().get("id"))


def main() -> None:
    logger.info("Collecting stats from %s", settings.DATABASE_URL.split("?")[0])
    with get_session() as db:
        stats = collect_stats(db)

    logger.info(
        "Stats: gens=%d spend_24h=$%.4f spend_mtd=$%.4f failed=%d cache=%.1f%%",
        stats["gens_24h"],
        stats["spend_24h"],
        stats["spend_mtd"],
        stats["failed_24h"],
        stats["cache_hit_rate"],
    )

    html = build_html(stats)
    subject = f"ReviewFlow daily — {stats['date']}"
    send_email(subject, html)
    logger.info("Done")


if __name__ == "__main__":
    main()
