import logging
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Depends, Request
from sqlalchemy.orm import Session

from app.core.auth import CurrentUser, get_current_user, require_owner
from app.core.rate_limit import limiter
from app.core.utils import utc_now_iso
from app.db.database import get_db
from app.db.models import Project, Source, Job
from app.schemas.job import JobGenerateRequest, JobResponse, JobListResponse
from app.services.generation_guard_service import require_generation_challenge
from app.services.usage_service import (
    check_daily_cap,
    check_monthly_quota,
    lock_quota_for_user,
    reserve_usage,
)
from app.services.templates import get_template

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Jobs"])


def _job_to_dict(job: Job):
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


def _pick_source_for_project(db: Session, project_id: str, source_id: str | None):
    if source_id:
        source = db.get(Source, source_id)
        if not source:
            raise HTTPException(status_code=404, detail="Source not found")
        if source.project_id != project_id:
            raise HTTPException(status_code=400, detail="Source does not belong to project")
        return source

    source = (
        db.query(Source)
        .filter(Source.project_id == project_id)
        .order_by(Source.created_at.desc())
        .first()
    )

    if not source:
        raise HTTPException(status_code=400, detail="No sources found for project")

    return source


@router.post("/jobs/generate", response_model=JobResponse)
@limiter.limit("10/hour;30/day;100/month")
def create_generate_job(
    request: Request,
    payload: JobGenerateRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    project = db.get(Project, payload.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    require_owner(current_user, project.user_id)

    source = _pick_source_for_project(db, payload.project_id, payload.source_id)

    source_text = (source.text or "").strip()
    if not source_text:
        raise HTTPException(
            status_code=400,
            detail="Selected source has no usable extracted text yet"
        )

    require_generation_challenge(request, payload.turnstile_token, current_user.user_id, db)
    lock_quota_for_user(current_user.user_id, db)
    check_daily_cap(user_id=current_user.user_id, db=db)
    check_monthly_quota(user_id=current_user.user_id, db=db)

    now = utc_now_iso()
    sections = payload.sections
    counts = payload.counts.model_dump(exclude_none=True) if payload.counts else None
    if sections is None and counts is None and project.template_id:
        template = get_template(project.template_id)
        if template:
            sections = template.sections
            counts = dict(template.counts)

    job = Job(
        id=str(uuid4()),
        project_id=payload.project_id,
        source_id=source.id,
        user_id=current_user.user_id,
        job_type=payload.job_type,
        status="queued",
        stage="queued",
        generation_options={
            "sections": sections,
            "counts": counts,
            "merge_mode": payload.merge_mode,
        },
        created_at=now,
        updated_at=now,
        error_message=None,
    )

    db.add(job)
    reserve_usage(db, current_user.user_id, job.id)
    db.commit()
    db.refresh(job)

    logger.info(
        "Generation job queued: job=%s project=%s source=%s",
        job.id, job.project_id, job.source_id,
    )

    return _job_to_dict(job)


@router.get("/jobs/{job_id}", response_model=JobResponse)
def get_job(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    job = db.get(Job, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    project = db.get(Project, job.project_id)
    require_owner(current_user, project.user_id if project else None)

    return _job_to_dict(job)


@router.get("/projects/{project_id}/jobs", response_model=JobListResponse)
def list_project_jobs(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    require_owner(current_user, project.user_id)

    items = db.query(Job).filter(Job.project_id == project_id).all()
    return {"items": [_job_to_dict(item) for item in items], "total": len(items)}
