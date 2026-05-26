from datetime import date, datetime, timedelta, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.auth import CurrentUser, get_current_user, require_owner
from app.core.rate_limit import limiter
from app.core.utils import utc_now_iso
from app.db.database import get_db
from app.db.models import CourseObligation, Job, Project, Source
from app.schemas.job import JobResponse
from app.schemas.planning import (
    CourseObligationListResponse,
    CourseObligationResponse,
    CourseObligationReviewRequest,
    SyllabusExtractionRequest,
)
from app.services.generation_guard_service import require_generation_challenge
from app.services.usage_service import (
    check_daily_cap,
    check_monthly_quota,
    lock_quota_for_user,
    reserve_usage,
)

router = APIRouter(tags=["Planning"])


def _require_owned_project(db: Session, project_id: str, current_user: CurrentUser) -> Project:
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    require_owner(current_user, project.user_id)
    return project


def _obligation_to_dict(item: CourseObligation) -> dict:
    return {
        "id": item.id,
        "project_id": item.project_id,
        "source_id": item.source_id,
        "title": item.title,
        "obligation_type": item.obligation_type,
        "due_date": item.due_date,
        "details": item.details,
        "grading_criteria": item.grading_criteria,
        "confidence": item.confidence,
        "uncertain_fields": item.uncertain_fields or [],
        "status": item.status,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
    }


def _job_to_dict(job: Job) -> dict:
    return {
        "id": job.id,
        "project_id": job.project_id,
        "source_id": job.source_id,
        "job_type": job.job_type,
        "status": job.status,
        "stage": job.stage,
        "created_at": job.created_at,
        "updated_at": job.updated_at,
        "error_message": job.error_message,
    }


@router.get(
    "/projects/{project_id}/planning/obligations",
    response_model=CourseObligationListResponse,
)
def list_course_obligations(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    _require_owned_project(db, project_id, current_user)
    items = (
        db.query(CourseObligation)
        .filter(CourseObligation.project_id == project_id)
        .order_by(CourseObligation.due_date.asc(), CourseObligation.created_at.asc())
        .all()
    )
    return {"items": [_obligation_to_dict(item) for item in items], "total": len(items)}


@router.post(
    "/projects/{project_id}/planning/extract-syllabus",
    response_model=JobResponse,
)
@limiter.limit("10/hour;30/day;100/month")
def extract_syllabus_obligations(
    request: Request,
    project_id: str,
    payload: SyllabusExtractionRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    _require_owned_project(db, project_id, current_user)
    source = db.get(Source, payload.source_id)
    if not source or source.project_id != project_id:
        raise HTTPException(status_code=404, detail="Syllabus source not found")
    if source.purpose != "syllabus":
        raise HTTPException(status_code=400, detail="Mark this source as a syllabus before extracting tasks")
    if not (source.text or "").strip():
        raise HTTPException(status_code=400, detail="Syllabus source has no usable text")

    require_generation_challenge(request, payload.turnstile_token, current_user.user_id, db)
    lock_quota_for_user(current_user.user_id, db)
    check_daily_cap(user_id=current_user.user_id, db=db)
    check_monthly_quota(user_id=current_user.user_id, db=db)

    now = utc_now_iso()
    job = Job(
        id=str(uuid4()),
        project_id=project_id,
        source_id=source.id,
        user_id=current_user.user_id,
        job_type="extract-syllabus",
        status="queued",
        stage="queued",
        generation_options=None,
        created_at=now,
        updated_at=now,
        error_message=None,
    )
    db.add(job)
    reserve_usage(db, current_user.user_id, job.id)
    db.commit()
    db.refresh(job)
    return _job_to_dict(job)


@router.patch(
    "/projects/{project_id}/planning/obligations/{obligation_id}",
    response_model=CourseObligationResponse,
)
def review_course_obligation(
    project_id: str,
    obligation_id: str,
    payload: CourseObligationReviewRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    _require_owned_project(db, project_id, current_user)
    item = db.get(CourseObligation, obligation_id)
    if not item or item.project_id != project_id:
        raise HTTPException(status_code=404, detail="Obligation not found")

    item.title = payload.title
    item.obligation_type = payload.obligation_type
    item.due_date = payload.due_date
    item.details = payload.details
    item.grading_criteria = payload.grading_criteria
    item.status = payload.status
    item.uncertain_fields = []
    item.updated_at = utc_now_iso()
    db.commit()
    db.refresh(item)
    return _obligation_to_dict(item)


def _ics_escape(value: str) -> str:
    return value.replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\n", "\\n")


@router.get("/projects/{project_id}/planning/calendar.ics")
def export_confirmed_obligations_calendar(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    project = _require_owned_project(db, project_id, current_user)
    items = (
        db.query(CourseObligation)
        .filter(
            CourseObligation.project_id == project_id,
            CourseObligation.status == "confirmed",
            CourseObligation.due_date.isnot(None),
        )
        .order_by(CourseObligation.due_date.asc())
        .all()
    )

    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//CourseKin//Semester Planning//EN"]
    for item in items:
        start = date.fromisoformat(item.due_date)
        end = start + timedelta(days=1)
        description = item.details or "Confirmed CourseKin deadline"
        lines.extend(
            [
                "BEGIN:VEVENT",
                f"UID:{item.id}@coursekin.app",
                f"DTSTAMP:{stamp}",
                f"DTSTART;VALUE=DATE:{start.strftime('%Y%m%d')}",
                f"DTEND;VALUE=DATE:{end.strftime('%Y%m%d')}",
                f"SUMMARY:{_ics_escape(project.title + ' - ' + item.title)}",
                f"DESCRIPTION:{_ics_escape(description)}",
                "END:VEVENT",
            ]
        )
    lines.append("END:VCALENDAR")

    safe_title = "".join(char for char in project.title.lower().replace(" ", "-") if char.isalnum() or char == "-")[:50]
    return Response(
        content="\r\n".join(lines) + "\r\n",
        media_type="text/calendar",
        headers={"Content-Disposition": f'attachment; filename="{safe_title or "course"}-deadlines.ics"'},
    )
