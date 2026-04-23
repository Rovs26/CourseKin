import logging
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, HTTPException, Depends, Request
from sqlalchemy.orm import Session

from app.core.auth import CurrentUser, get_current_user, require_owner
from app.core.rate_limit import limiter
from app.core.utils import utc_now_iso
from app.db.database import get_db
from app.db.models import Project, Source, Job
from app.schemas.job import JobGenerateRequest, JobResponse, JobListResponse
from app.db.models import UsageLog
from app.services.generation_service import run_generation_in_background
from app.services.turnstile_service import verify_turnstile
from app.services.usage_service import check_monthly_quota
from app.services.templates import get_template

# Number of generations before Turnstile is no longer required
TURNSTILE_GENERATION_THRESHOLD = 3

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
    background_tasks: BackgroundTasks,
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

    # Turnstile challenge for the first N generations per user
    prior_count = (
        db.query(UsageLog)
        .filter(UsageLog.user_id == current_user.user_id)
        .count()
    )
    if prior_count < TURNSTILE_GENERATION_THRESHOLD:
        token = payload.turnstile_token
        if not token:
            raise HTTPException(
                status_code=400,
                detail="turnstile_required",
            )
        remote_ip = request.client.host if request.client else None
        if not verify_turnstile(token, remote_ip):
            raise HTTPException(status_code=400, detail="turnstile_failed")

    # Quota check uses the authenticated user_id from the JWT
    check_monthly_quota(user_id=current_user.user_id, db=db)

    now = utc_now_iso()
    job = Job(
        id=str(uuid4()),
        project_id=payload.project_id,
        source_id=source.id,
        job_type=payload.job_type,
        status="processing",
        stage="generating",
        created_at=now,
        updated_at=now,
        error_message=None,
    )

    db.add(job)
    db.commit()
    db.refresh(job)

    sections = payload.sections
    counts = payload.counts.model_dump(exclude_none=True) if payload.counts else None

    # Fall back to template defaults when no explicit sections/counts
    if sections is None and counts is None and project.template_id:
        template = get_template(project.template_id)
        if template:
            sections = template.sections
            counts = dict(template.counts)

    logger.info(
        "Generation job started: job=%s project=%s source=%s",
        job.id, job.project_id, job.source_id,
    )

    background_tasks.add_task(
        run_generation_in_background,
        job_id=job.id,
        project_id=job.project_id,
        source_id=job.source_id,
        source_text=source_text,
        user_id=current_user.user_id,
        sections=sections,
        counts=counts,
        merge_mode=payload.merge_mode,
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
