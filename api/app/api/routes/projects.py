from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Depends, Request
from sqlalchemy.orm import Session

from app.core.auth import CurrentUser, get_current_user, require_owner
from app.core.rate_limit import limiter
from app.core.utils import utc_now_iso
from app.db.database import get_db
from app.db.models import Project, Source, Job, Reviewer
from app.schemas.project import (
    ProjectCreate,
    ProjectUpdate,
    ProjectResponse,
    ProjectListResponse,
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
        "user_id": project.user_id,
        "created_at": project.created_at,
        "updated_at": project.updated_at,
    }


@router.post("", response_model=ProjectResponse)
@limiter.limit("20/minute")
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
        user_id=current_user.user_id,  # always from verified JWT, never from body
        created_at=now,
        updated_at=now,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return _project_to_dict(project)


@router.get("", response_model=ProjectListResponse)
def list_projects(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    items = (
        db.query(Project)
        .filter(Project.user_id == current_user.user_id)
        .all()
    )
    return {"items": [_project_to_dict(item) for item in items], "total": len(items)}


@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(
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
        if source.file_path:
            path = Path(source.file_path)
            if path.exists():
                path.unlink()

    # Cascade delete related records
    db.query(Source).filter(Source.project_id == project_id).delete()
    db.query(Job).filter(Job.project_id == project_id).delete()
    reviewer = db.get(Reviewer, project_id)
    if reviewer:
        db.delete(reviewer)

    db.delete(project)
    db.commit()
    return {"message": "Project deleted successfully"}
