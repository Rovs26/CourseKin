from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.auth import CurrentUser, get_current_user, require_owner
from app.core.rate_limit import limiter
from app.core.utils import utc_now_iso
from app.db.database import get_db
from app.db.models import CourseObligation, Job, PreparationMilestone, Project, Source
from app.schemas.job import JobResponse
from app.schemas.planning import (
    BuildPreparationPlanRequest,
    CourseObligationListResponse,
    CourseObligationResponse,
    CourseObligationReviewRequest,
    PreparationMilestoneResponse,
    PreparationMilestoneUpdateRequest,
    PreparationRunwayResponse,
    SyllabusExtractionRequest,
)
from app.services.generation_guard_service import require_generation_challenge
from app.services.preparation_service import rebuild_preparation_plan
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


def _milestone_to_dict(item: PreparationMilestone) -> dict:
    return {
        "id": item.id,
        "project_id": item.project_id,
        "obligation_id": item.obligation_id,
        "title": item.title,
        "milestone_type": item.milestone_type,
        "sequence": item.sequence,
        "scheduled_date": item.scheduled_date,
        "estimated_minutes": item.estimated_minutes,
        "status": item.status,
        "completed_at": item.completed_at,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
    }


def _runway_to_dict(
    db: Session,
    project_id: str,
    daily_capacity_minutes: int,
    planning_date: date,
) -> dict:
    obligations = (
        db.query(CourseObligation)
        .filter(
            CourseObligation.project_id == project_id,
            CourseObligation.status == "confirmed",
        )
        .order_by(CourseObligation.due_date.asc(), CourseObligation.created_at.asc())
        .all()
    )
    obligation_ids = [item.id for item in obligations]
    milestones = (
        db.query(PreparationMilestone)
        .filter(PreparationMilestone.obligation_id.in_(obligation_ids))
        .order_by(PreparationMilestone.scheduled_date.asc(), PreparationMilestone.sequence.asc())
        .all()
        if obligation_ids
        else []
    )
    milestones_by_obligation: dict[str, list[PreparationMilestone]] = defaultdict(list)
    for item in milestones:
        milestones_by_obligation[item.obligation_id].append(item)

    has_supporting_material = (
        db.query(Source)
        .filter(
            Source.project_id == project_id,
            Source.status == "processed",
            Source.purpose.in_(["study_material", "lecture_notes", "assignment_brief"]),
        )
        .first()
        is not None
    )
    items = []
    total_sessions = 0
    completed_sessions = 0
    for obligation in obligations:
        item_milestones = milestones_by_obligation[obligation.id]
        active_items = [item for item in item_milestones if item.status != "skipped"]
        completed = sum(item.status == "completed" for item in active_items)
        total = len(active_items)
        total_sessions += total
        completed_sessions += completed
        next_planned = next((item for item in active_items if item.status == "planned"), None)
        if next_planned:
            next_action = f"{next_planned.title} on {next_planned.scheduled_date}"
        elif obligation.due_date and date.fromisoformat(obligation.due_date) < planning_date:
            next_action = "This deadline has passed. Confirm a revised date or mark the work complete."
        elif total == 0:
            next_action = "Build or rebalance a preparation plan for this deadline."
        else:
            next_action = None
        items.append(
            {
                "obligation": _obligation_to_dict(obligation),
                "milestones": [_milestone_to_dict(item) for item in item_milestones],
                "preparation_progress_percent": round((completed / total) * 100) if total else 0,
                "missing_materials": []
                if has_supporting_material
                else ["Add lecture notes or study material for grounded preparation."],
                "next_action": next_action,
            }
        )

    day_totals: dict[str, dict[str, int]] = defaultdict(lambda: {"minutes": 0, "count": 0})
    for item in milestones:
        if item.status != "skipped":
            day_totals[item.scheduled_date]["minutes"] += item.estimated_minutes
            day_totals[item.scheduled_date]["count"] += 1
    daily_load = [
        {
            "date": item_date,
            "estimated_minutes": totals["minutes"],
            "session_count": totals["count"],
            "exceeds_capacity": totals["minutes"] > daily_capacity_minutes,
        }
        for item_date, totals in sorted(day_totals.items())
    ]
    return {
        "items": items,
        "daily_load": daily_load,
        "confirmed_without_due_date": [
            _obligation_to_dict(item) for item in obligations if item.due_date is None
        ],
        "total_sessions": total_sessions,
        "completed_sessions": completed_sessions,
        "preparation_progress_percent": round((completed_sessions / total_sessions) * 100)
        if total_sessions
        else 0,
        "daily_capacity_minutes": daily_capacity_minutes,
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

    existing_plan_basis = (item.title, item.obligation_type, item.due_date, item.status)
    item.title = payload.title
    item.obligation_type = payload.obligation_type
    item.due_date = payload.due_date
    item.details = payload.details
    item.grading_criteria = payload.grading_criteria
    item.status = payload.status
    item.uncertain_fields = []
    item.updated_at = utc_now_iso()
    updated_plan_basis = (item.title, item.obligation_type, item.due_date, item.status)
    if payload.status != "confirmed" or existing_plan_basis != updated_plan_basis:
        db.query(PreparationMilestone).filter(
            PreparationMilestone.obligation_id == item.id,
            PreparationMilestone.status != "completed",
        ).delete(synchronize_session=False)
    db.commit()
    db.refresh(item)
    return _obligation_to_dict(item)


@router.get(
    "/projects/{project_id}/planning/runway",
    response_model=PreparationRunwayResponse,
)
def get_preparation_runway(
    project_id: str,
    daily_capacity_minutes: int = 120,
    planning_date: str | None = None,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    _require_owned_project(db, project_id, current_user)
    capacity = min(max(daily_capacity_minutes, 30), 360)
    try:
        reference_date = date.fromisoformat(planning_date) if planning_date else date.today()
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="Planning date must use YYYY-MM-DD format") from exc
    return _runway_to_dict(db, project_id, capacity, reference_date)


@router.post(
    "/projects/{project_id}/planning/runway/build",
    response_model=PreparationRunwayResponse,
)
def build_preparation_runway(
    project_id: str,
    payload: BuildPreparationPlanRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    _require_owned_project(db, project_id, current_user)
    obligations = (
        db.query(CourseObligation)
        .filter(
            CourseObligation.project_id == project_id,
            CourseObligation.status == "confirmed",
        )
        .all()
    )
    planning_date = (
        date.fromisoformat(payload.planning_start_date)
        if payload.planning_start_date
        else date.today()
    )
    rebuild_preparation_plan(
        db,
        project_id,
        obligations,
        payload.daily_capacity_minutes,
        planning_date,
    )
    return _runway_to_dict(db, project_id, payload.daily_capacity_minutes, planning_date)


@router.patch(
    "/projects/{project_id}/planning/milestones/{milestone_id}",
    response_model=PreparationMilestoneResponse,
)
def update_preparation_milestone(
    project_id: str,
    milestone_id: str,
    payload: PreparationMilestoneUpdateRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    _require_owned_project(db, project_id, current_user)
    item = db.get(PreparationMilestone, milestone_id)
    if not item or item.project_id != project_id:
        raise HTTPException(status_code=404, detail="Preparation milestone not found")
    item.status = payload.status
    item.completed_at = utc_now_iso() if payload.status == "completed" else None
    item.updated_at = utc_now_iso()
    db.commit()
    db.refresh(item)
    return _milestone_to_dict(item)


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
