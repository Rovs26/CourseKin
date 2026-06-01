"""Calendar export — read-only .ics feed across all of a user's courses.

Calendar apps can't authenticate with a Clerk bearer, so the feed is gated by
an unguessable per-user token (UserCalendarToken). The token can be rotated to
revoke a previously-shared subscription URL.

The feed aggregates everything dated that the user has on their plan:
- confirmed CourseObligation deadlines (all-day VEVENT)
- planned PreparationMilestone study sessions (all-day VEVENT)
- CourseTask items that have a due_date (all-day VEVENT)
"""

from __future__ import annotations

import secrets
from datetime import date, datetime, timedelta, timezone
from uuid import uuid4

from sqlalchemy.orm import Session

from app.core.utils import utc_now_iso
from app.db.models import (
    CourseObligation,
    CourseTask,
    PreparationMilestone,
    Project,
    UserCalendarToken,
)


def _new_token() -> str:
    return secrets.token_urlsafe(32)


def get_or_create_token(db: Session, user_id: str) -> UserCalendarToken:
    record = db.get(UserCalendarToken, user_id)
    if record:
        return record
    now = utc_now_iso()
    record = UserCalendarToken(
        user_id=user_id,
        token=_new_token(),
        created_at=now,
        updated_at=now,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def rotate_token(db: Session, user_id: str) -> UserCalendarToken:
    record = get_or_create_token(db, user_id)
    record.token = _new_token()
    record.updated_at = utc_now_iso()
    db.commit()
    db.refresh(record)
    return record


def resolve_user_id(db: Session, token: str) -> str | None:
    record = (
        db.query(UserCalendarToken)
        .filter(UserCalendarToken.token == token)
        .first()
    )
    return record.user_id if record else None


def _ics_escape(value: str) -> str:
    return (
        value.replace("\\", "\\\\")
        .replace(";", "\\;")
        .replace(",", "\\,")
        .replace("\n", "\\n")
    )


def _all_day_event(uid: str, day: str, summary: str, description: str, stamp: str) -> list[str]:
    start = date.fromisoformat(day)
    end = start + timedelta(days=1)
    return [
        "BEGIN:VEVENT",
        f"UID:{uid}@coursekin.app",
        f"DTSTAMP:{stamp}",
        f"DTSTART;VALUE=DATE:{start.strftime('%Y%m%d')}",
        f"DTEND;VALUE=DATE:{end.strftime('%Y%m%d')}",
        f"SUMMARY:{_ics_escape(summary)}",
        f"DESCRIPTION:{_ics_escape(description)}",
        "END:VEVENT",
    ]


def build_feed(db: Session, user_id: str) -> str:
    """Build the full .ics document for every course the user owns."""
    projects = db.query(Project).filter(Project.user_id == user_id).all()
    titles = {p.id: p.title for p in projects}
    project_ids = list(titles.keys())

    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//CourseKin//Study Calendar//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "X-WR-CALNAME:CourseKin",
    ]

    if project_ids:
        obligations = (
            db.query(CourseObligation)
            .filter(
                CourseObligation.project_id.in_(project_ids),
                CourseObligation.status == "confirmed",
                CourseObligation.due_date.isnot(None),
            )
            .all()
        )
        for item in obligations:
            course = titles.get(item.project_id, "Course")
            lines.extend(
                _all_day_event(
                    uid=f"obligation-{item.id}",
                    day=item.due_date,
                    summary=f"{course} — {item.title}",
                    description=item.details or "Confirmed CourseKin deadline",
                    stamp=stamp,
                )
            )

        milestones = (
            db.query(PreparationMilestone)
            .filter(
                PreparationMilestone.project_id.in_(project_ids),
                PreparationMilestone.status == "planned",
            )
            .all()
        )
        for item in milestones:
            course = titles.get(item.project_id, "Course")
            lines.extend(
                _all_day_event(
                    uid=f"milestone-{item.id}",
                    day=item.scheduled_date,
                    summary=f"{course} — {item.title}",
                    description=f"Study session (~{item.estimated_minutes} min)",
                    stamp=stamp,
                )
            )

        tasks = (
            db.query(CourseTask)
            .filter(
                CourseTask.user_id == user_id,
                CourseTask.status == "open",
                CourseTask.due_date.isnot(None),
            )
            .all()
        )
        for item in tasks:
            course = titles.get(item.project_id, "Course")
            lines.extend(
                _all_day_event(
                    uid=f"task-{item.id}",
                    day=item.due_date,
                    summary=f"{course} — {item.title}",
                    description=item.notes or "CourseKin task",
                    stamp=stamp,
                )
            )

    lines.append("END:VCALENDAR")
    return "\r\n".join(lines) + "\r\n"
