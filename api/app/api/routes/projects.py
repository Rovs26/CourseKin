from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Depends, Request
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from app.core.auth import CurrentUser, get_current_user, require_owner
from app.core.rate_limit import limiter
from app.core.utils import utc_now_iso
from app.db.database import get_db
from app.db.models import (
    CourseObligation,
    Job,
    PreparationMilestone,
    Project,
    Reviewer,
    ReviewerFeedback,
    Source,
    SourceChunk,
)
from app.services import storage_service
from app.schemas.project import (
    ProjectCreate,
    ProjectUpdate,
    ProjectResponse,
    ProjectListResponse,
    ProjectSummaryListResponse,
)

router = APIRouter(prefix="/projects", tags=["Projects"])


def _project_to_dict(project: Project):
    return {
        "id": project.id,
        "title": project.title,
        "project_type": project.project_type,
        "age_bracket": project.age_bracket,
        "learning_mode": project.learning_mode,
        "field_of_study": project.field_of_study,
        "source_mode": project.source_mode,
        "template_id": project.template_id,
        "course_code": project.course_code,
        "term": project.term,
        "instructor": project.instructor,
        "meeting_schedule": project.meeting_schedule,
        "reminders_enabled": project.reminders_enabled,
        "reminder_lead_days": project.reminder_lead_days,
        "user_id": project.user_id,
        "created_at": project.created_at,
        "updated_at": project.updated_at,
    }


def _coverage_percent(reviewer: Reviewer | None) -> int:
    if reviewer is None or not isinstance(reviewer.content_json, dict):
        return 0
    content = reviewer.content_json
    filled_sections = [
        bool(content.get("summary")),
        bool(content.get("key_points")),
        bool(content.get("definitions")),
        bool(content.get("qa")),
        bool(content.get("quiz")),
        bool(content.get("flashcards")),
    ]
    return round((sum(filled_sections) / len(filled_sections)) * 100)


@router.post("", response_model=ProjectResponse)
@limiter.limit("60/hour")
def create_project(
    request: Request,
    payload: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    now = utc_now_iso()
    project = Project(
        id=str(uuid4()),
        title=payload.title,
        project_type=payload.project_type,
        age_bracket=payload.age_bracket,
        learning_mode=payload.learning_mode,
        field_of_study=payload.field_of_study,
        source_mode=payload.source_mode,
        template_id=payload.template_id,
        course_code=payload.course_code,
        term=payload.term,
        instructor=payload.instructor,
        meeting_schedule=payload.meeting_schedule,
        user_id=current_user.user_id,  # always from verified JWT, never from body
        created_at=now,
        updated_at=now,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return _project_to_dict(project)


@router.get("", response_model=ProjectListResponse)
@limiter.limit("120/hour")
def list_projects(
    request: Request,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    items = (
        db.query(Project)
        .filter(Project.user_id == current_user.user_id)
        .all()
    )
    return {"items": [_project_to_dict(item) for item in items], "total": len(items)}


@router.get("/summaries", response_model=ProjectSummaryListResponse)
@limiter.limit("120/hour")
def list_project_summaries(
    request: Request,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    projects = (
        db.query(Project)
        .filter(Project.user_id == current_user.user_id)
        .order_by(Project.updated_at.desc())
        .all()
    )
    project_ids = [project.id for project in projects]
    if not project_ids:
        return {"items": [], "total": 0}

    source_stats = {
        row.project_id: row
        for row in (
            db.query(
                Source.project_id.label("project_id"),
                func.count(Source.id).label("source_count"),
                func.sum(case((Source.status == "processed", 1), else_=0)).label(
                    "processed_source_count"
                ),
                func.max(Source.updated_at).label("last_source_at"),
            )
            .filter(Source.project_id.in_(project_ids))
            .group_by(Source.project_id)
            .all()
        )
    }

    reviewers_by_project = {
        reviewer.project_id: reviewer
        for reviewer in db.query(Reviewer).filter(Reviewer.project_id.in_(project_ids)).all()
    }

    items = []
    for project in projects:
        stats = source_stats.get(project.id)
        reviewer = reviewers_by_project.get(project.id)
        activity_candidates = [project.updated_at, project.created_at]
        if stats and stats.last_source_at:
            activity_candidates.append(stats.last_source_at)
        if reviewer and reviewer.updated_at:
            activity_candidates.append(reviewer.updated_at)

        items.append(
            {
                "project": _project_to_dict(project),
                "source_count": int(stats.source_count) if stats else 0,
                "processed_source_count": int(stats.processed_source_count or 0) if stats else 0,
                "reviewer_status": reviewer.status if reviewer else "not-ready",
                "reviewer_coverage_percent": _coverage_percent(reviewer),
                "activity_at": max(activity_candidates),
            }
        )

    return {"items": items, "total": len(items)}


@router.get("/{project_id}", response_model=ProjectResponse)
@limiter.limit("120/hour")
def get_project(
    request: Request,
    project_id: str,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    require_owner(current_user, project.user_id)
    return _project_to_dict(project)


@router.patch("/{project_id}", response_model=ProjectResponse)
@limiter.limit("30/minute")
def update_project(
    request: Request,
    project_id: str,
    payload: ProjectUpdate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    require_owner(current_user, project.user_id)

    updates = payload.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(project, key, value)

    project.updated_at = utc_now_iso()
    db.commit()
    db.refresh(project)
    return _project_to_dict(project)


@router.delete("/{project_id}")
@limiter.limit("10/minute")
def delete_project(
    request: Request,
    project_id: str,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    require_owner(current_user, project.user_id)

    # Delete uploaded files for sources
    sources = db.query(Source).filter(Source.project_id == project_id).all()
    for source in sources:
        if source.storage_key:
            storage_service.delete_object(source.storage_key, strict=True)
        if source.file_path:
            path = Path(source.file_path)
            if path.exists():
                path.unlink()

    # Cascade delete related records
    db.query(PreparationMilestone).filter(PreparationMilestone.project_id == project_id).delete()
    db.query(SourceChunk).filter(SourceChunk.project_id == project_id).delete()
    db.query(Source).filter(Source.project_id == project_id).delete()
    db.query(Job).filter(Job.project_id == project_id).delete()
    db.query(ReviewerFeedback).filter(ReviewerFeedback.project_id == project_id).delete()
    db.query(CourseObligation).filter(CourseObligation.project_id == project_id).delete()
    reviewer = db.get(Reviewer, project_id)
    if reviewer:
        db.delete(reviewer)

    db.delete(project)
    db.commit()
    return {"message": "Project deleted successfully"}
