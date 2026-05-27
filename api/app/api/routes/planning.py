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
from app.db.models import CourseObligation, CourseTask, Job, PreparationMilestone, Project, Source
from app.schemas.job import JobResponse
from app.schemas.planning import (
    BuildPreparationPlanRequest,
    CalendarAgendaResponse,
    CourseObligationListResponse,
    CourseObligationResponse,
    CourseObligationReviewRequest,
    CourseTaskCreateRequest,
    CourseTaskListResponse,
    CourseTaskResponse,
    CourseTaskUpdateRequest,
    PreparationMilestoneResponse,
    PreparationMilestoneUpdateRequest,
    PreparationReminderListResponse,
    PreparationRunwayResponse,
    ReminderPreferenceResponse,
    ReminderPreferenceUpdateRequest,
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


def _proposal_snapshot_from_item(item: CourseObligation) -> dict:
    return {
        "title": item.title,
        "obligation_type": item.obligation_type,
        "due_date": item.due_date,
        "details": item.details,
        "grading_criteria": item.grading_criteria,
        "confidence": item.confidence,
        "uncertain_fields": item.uncertain_fields or [],
    }


def _review_snapshot(payload: CourseObligationReviewRequest) -> dict:
    return {
        "title": payload.title,
        "obligation_type": payload.obligation_type,
        "due_date": payload.due_date,
        "details": payload.details,
        "grading_criteria": payload.grading_criteria,
        "status": payload.status,
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


def _task_to_dict(item: CourseTask, project: Project) -> dict:
    return {
        "id": item.id,
        "project_id": item.project_id,
        "project_title": project.title,
        "course_code": project.course_code,
        "title": item.title,
        "notes": item.notes,
        "due_date": item.due_date,
        "priority": item.priority,
        "status": item.status,
        "origin": item.origin,
        "completed_at": item.completed_at,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
    }


def _parse_reference_date(value: str | None) -> date:
    try:
        return date.fromisoformat(value) if value else date.today()
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="Planning date must use YYYY-MM-DD format") from exc


def _calendar_range(
    start_date: str | None,
    end_date: str | None,
    reference_date: date,
) -> tuple[date, date]:
    first_day = date(reference_date.year, reference_date.month, 1)
    next_month = (
        date(reference_date.year + 1, 1, 1)
        if reference_date.month == 12
        else date(reference_date.year, reference_date.month + 1, 1)
    )
    try:
        start = date.fromisoformat(start_date) if start_date else first_day
        end = date.fromisoformat(end_date) if end_date else next_month - timedelta(days=1)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="Calendar dates must use YYYY-MM-DD format") from exc
    if start > end:
        raise HTTPException(status_code=422, detail="Calendar start date must be before end date")
    if (end - start).days > 366:
        raise HTTPException(status_code=422, detail="Calendar range cannot exceed one year")
    return start, end


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

    now = utc_now_iso()
    existing_plan_basis = (item.title, item.obligation_type, item.due_date, item.status)
    if item.proposal_snapshot is None and item.status == "proposed":
        item.proposal_snapshot = _proposal_snapshot_from_item(item)
    if item.reviewed_snapshot is None:
        item.reviewed_snapshot = _review_snapshot(payload)
        item.reviewed_at = now
    item.title = payload.title
    item.obligation_type = payload.obligation_type
    item.due_date = payload.due_date
    item.details = payload.details
    item.grading_criteria = payload.grading_criteria
    item.status = payload.status
    item.uncertain_fields = []
    item.updated_at = now
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
    reference_date = _parse_reference_date(planning_date)
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


@router.get(
    "/projects/{project_id}/planning/reminder-preferences",
    response_model=ReminderPreferenceResponse,
)
def get_reminder_preferences(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    project = _require_owned_project(db, project_id, current_user)
    return {
        "project_id": project.id,
        "enabled": project.reminders_enabled,
        "lead_days": project.reminder_lead_days,
    }


@router.patch(
    "/projects/{project_id}/planning/reminder-preferences",
    response_model=ReminderPreferenceResponse,
)
def update_reminder_preferences(
    project_id: str,
    payload: ReminderPreferenceUpdateRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    project = _require_owned_project(db, project_id, current_user)
    project.reminders_enabled = payload.enabled
    project.reminder_lead_days = payload.lead_days
    project.updated_at = utc_now_iso()
    db.commit()
    return {
        "project_id": project.id,
        "enabled": project.reminders_enabled,
        "lead_days": project.reminder_lead_days,
    }


@router.get("/planning/reminders", response_model=PreparationReminderListResponse)
def list_preparation_reminders(
    reference_date: str | None = None,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    today = _parse_reference_date(reference_date)
    projects = (
        db.query(Project)
        .filter(
            Project.user_id == current_user.user_id,
            Project.reminders_enabled.is_(True),
        )
        .all()
    )
    if not projects:
        return {"items": [], "total": 0, "reference_date": today.isoformat()}

    projects_by_id = {project.id: project for project in projects}
    project_ids = list(projects_by_id)
    milestones = (
        db.query(PreparationMilestone)
        .filter(
            PreparationMilestone.project_id.in_(project_ids),
            PreparationMilestone.status == "planned",
        )
        .all()
    )
    obligation_ids = {item.obligation_id for item in milestones}
    obligations_by_id = {
        item.id: item
        for item in db.query(CourseObligation)
        .filter(
            CourseObligation.id.in_(obligation_ids),
            CourseObligation.status == "confirmed",
        )
        .all()
    } if obligation_ids else {}

    reminders = []
    for milestone in milestones:
        project = projects_by_id[milestone.project_id]
        obligation = obligations_by_id.get(milestone.obligation_id)
        if obligation is None:
            continue
        scheduled_date = date.fromisoformat(milestone.scheduled_date)
        days_until = (scheduled_date - today).days
        if days_until > project.reminder_lead_days:
            continue
        urgency = "overdue" if days_until < 0 else "today" if days_until == 0 else "upcoming"
        reminders.append(
            {
                "milestone_id": milestone.id,
                "project_id": project.id,
                "project_title": project.title,
                "course_code": project.course_code,
                "obligation_id": obligation.id,
                "obligation_title": obligation.title,
                "obligation_due_date": obligation.due_date,
                "milestone_title": milestone.title,
                "scheduled_date": milestone.scheduled_date,
                "estimated_minutes": milestone.estimated_minutes,
                "urgency": urgency,
                "days_until": days_until,
            }
        )
    urgency_order = {"today": 0, "overdue": 1, "upcoming": 2}
    reminders.sort(
        key=lambda item: (
            urgency_order[item["urgency"]],
            -item["days_until"] if item["urgency"] == "overdue" else item["days_until"],
            item["scheduled_date"],
        )
    )
    return {"items": reminders[:20], "total": len(reminders), "reference_date": today.isoformat()}


@router.get("/planning/tasks", response_model=CourseTaskListResponse)
def list_course_tasks(
    include_completed: bool = False,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    projects = db.query(Project).filter(Project.user_id == current_user.user_id).all()
    projects_by_id = {project.id: project for project in projects}
    if not projects_by_id:
        return {"items": [], "total": 0}
    query = db.query(CourseTask).filter(
        CourseTask.user_id == current_user.user_id,
        CourseTask.project_id.in_(projects_by_id),
    )
    if not include_completed:
        query = query.filter(CourseTask.status == "open")
    tasks = query.all()
    tasks.sort(
        key=lambda item: (
            item.status == "completed",
            item.due_date is None,
            item.due_date or "",
            {"high": 0, "medium": 1, "low": 2}.get(item.priority, 3),
            item.created_at,
        )
    )
    return {
        "items": [_task_to_dict(item, projects_by_id[item.project_id]) for item in tasks],
        "total": len(tasks),
    }


@router.post(
    "/projects/{project_id}/planning/tasks",
    response_model=CourseTaskResponse,
)
@limiter.limit("60/hour")
def create_course_task(
    request: Request,
    project_id: str,
    payload: CourseTaskCreateRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    project = _require_owned_project(db, project_id, current_user)
    now = utc_now_iso()
    task = CourseTask(
        id=str(uuid4()),
        user_id=current_user.user_id,
        project_id=project_id,
        title=payload.title,
        notes=payload.notes,
        due_date=payload.due_date,
        priority=payload.priority,
        status="open",
        origin="student",
        completed_at=None,
        created_at=now,
        updated_at=now,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return _task_to_dict(task, project)


@router.patch(
    "/projects/{project_id}/planning/tasks/{task_id}",
    response_model=CourseTaskResponse,
)
@limiter.limit("120/hour")
def update_course_task(
    request: Request,
    project_id: str,
    task_id: str,
    payload: CourseTaskUpdateRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    project = _require_owned_project(db, project_id, current_user)
    task = db.get(CourseTask, task_id)
    if not task or task.project_id != project_id or task.user_id != current_user.user_id:
        raise HTTPException(status_code=404, detail="Task not found")
    updates = payload.model_dump(exclude_unset=True)
    for key in ("title", "notes", "due_date", "priority", "status"):
        if key in updates:
            setattr(task, key, updates[key])
    if "status" in updates:
        task.completed_at = utc_now_iso() if task.status == "completed" else None
    task.updated_at = utc_now_iso()
    db.commit()
    db.refresh(task)
    return _task_to_dict(task, project)


@router.delete("/projects/{project_id}/planning/tasks/{task_id}", status_code=204)
@limiter.limit("60/hour")
def delete_course_task(
    request: Request,
    project_id: str,
    task_id: str,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    _require_owned_project(db, project_id, current_user)
    task = db.get(CourseTask, task_id)
    if not task or task.project_id != project_id or task.user_id != current_user.user_id:
        raise HTTPException(status_code=404, detail="Task not found")
    db.delete(task)
    db.commit()
    return None


@router.get("/planning/calendar", response_model=CalendarAgendaResponse)
def get_calendar_agenda(
    start_date: str | None = None,
    end_date: str | None = None,
    reference_date: str | None = None,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    today = _parse_reference_date(reference_date)
    start, end = _calendar_range(start_date, end_date, today)
    start_value = start.isoformat()
    end_value = end.isoformat()
    projects = db.query(Project).filter(Project.user_id == current_user.user_id).all()
    projects_by_id = {project.id: project for project in projects}
    if not projects_by_id:
        return {
            "items": [],
            "unscheduled_tasks": [],
            "start_date": start_value,
            "end_date": end_value,
            "reference_date": today.isoformat(),
            "open_tasks": 0,
            "overdue_tasks": 0,
            "upcoming_deadlines": 0,
        }
    project_ids = list(projects_by_id)
    obligations = (
        db.query(CourseObligation)
        .filter(
            CourseObligation.project_id.in_(project_ids),
            CourseObligation.status == "confirmed",
        )
        .all()
    )
    obligations_by_id = {item.id: item for item in obligations}
    items = []
    for obligation in obligations:
        if obligation.due_date and start_value <= obligation.due_date <= end_value:
            project = projects_by_id[obligation.project_id]
            items.append(
                {
                    "id": obligation.id,
                    "item_type": "deadline",
                    "project_id": project.id,
                    "project_title": project.title,
                    "course_code": project.course_code,
                    "title": obligation.title,
                    "date": obligation.due_date,
                    "status": obligation.status,
                    "details": obligation.details,
                    "priority": None,
                    "estimated_minutes": None,
                    "obligation_id": obligation.id,
                }
            )
    milestones = db.query(PreparationMilestone).filter(
        PreparationMilestone.project_id.in_(project_ids),
        PreparationMilestone.scheduled_date >= start_value,
        PreparationMilestone.scheduled_date <= end_value,
    ).all()
    for milestone in milestones:
        obligation = obligations_by_id.get(milestone.obligation_id)
        if obligation is None:
            continue
        project = projects_by_id[milestone.project_id]
        items.append(
            {
                "id": milestone.id,
                "item_type": "preparation_session",
                "project_id": project.id,
                "project_title": project.title,
                "course_code": project.course_code,
                "title": milestone.title,
                "date": milestone.scheduled_date,
                "status": milestone.status,
                "details": f"Preparing for {obligation.title}",
                "priority": None,
                "estimated_minutes": milestone.estimated_minutes,
                "obligation_id": obligation.id,
            }
        )
    tasks = db.query(CourseTask).filter(
        CourseTask.user_id == current_user.user_id,
        CourseTask.project_id.in_(project_ids),
    ).all()
    for task in tasks:
        if task.due_date and start_value <= task.due_date <= end_value:
            project = projects_by_id[task.project_id]
            items.append(
                {
                    "id": task.id,
                    "item_type": "task",
                    "project_id": project.id,
                    "project_title": project.title,
                    "course_code": project.course_code,
                    "title": task.title,
                    "date": task.due_date,
                    "status": task.status,
                    "details": task.notes,
                    "priority": task.priority,
                    "estimated_minutes": None,
                    "obligation_id": None,
                }
            )
    items.sort(key=lambda item: (item["date"], item["item_type"], item["title"].casefold()))
    open_tasks = [item for item in tasks if item.status == "open"]
    undated = [item for item in open_tasks if item.due_date is None]
    undated.sort(key=lambda item: ({"high": 0, "medium": 1, "low": 2}[item.priority], item.created_at))
    return {
        "items": items,
        "unscheduled_tasks": [
            _task_to_dict(item, projects_by_id[item.project_id]) for item in undated
        ],
        "start_date": start_value,
        "end_date": end_value,
        "reference_date": today.isoformat(),
        "open_tasks": len(open_tasks),
        "overdue_tasks": sum(
            item.due_date is not None and item.due_date < today.isoformat()
            for item in open_tasks
        ),
        "upcoming_deadlines": sum(
            item.due_date is not None and item.due_date >= today.isoformat()
            for item in obligations
        ),
    }


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
