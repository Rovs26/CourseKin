import logging
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.auth import CurrentUser, get_current_user, require_owner
from app.core.rate_limit import limiter
from app.core.utils import utc_now_iso
from app.db.database import get_db
from app.db.models import Project, Reviewer, ReviewerFeedback, Job, Source
from app.schemas.job import JobResponse
from app.schemas.reviewer import (
    ReviewerResponse,
    ReviewerRegenerateRequest,
    BatchGenerateRequest,
    BatchGenerateResponse,
    CustomPdfRequest,
    ReviewerFeedbackRequest,
    ReviewerFeedbackResponse,
)
from app.services.generation_guard_service import require_generation_challenge
from app.services.usage_service import (
    check_daily_cap,
    check_monthly_quota,
    lock_quota_for_user,
    reserve_usage,
)
from app.services.pdf_export_service import generate_reviewer_pdf
from app.services.templates import get_template

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Reviewer"])


def _reviewer_to_dict(reviewer: Reviewer):
    return {
        "project_id": reviewer.project_id,
        "source_id": reviewer.source_id,
        "status": reviewer.status,
        "output_type": reviewer.output_type,
        "version": reviewer.version,
        "content_json": reviewer.content_json,
        "created_at": reviewer.created_at,
        "updated_at": reviewer.updated_at,
    }


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


def _pick_source_for_regenerate(db: Session, project_id: str, source_id: str | None = None):
    if source_id:
        source = db.get(Source, source_id)
        if not source:
            raise HTTPException(status_code=404, detail="Source not found")
        if source.project_id != project_id:
            raise HTTPException(status_code=400, detail="Source does not belong to project")
        return source

    current_reviewer = db.get(Reviewer, project_id)
    if current_reviewer and current_reviewer.source_id:
        source = db.get(Source, current_reviewer.source_id)
        if source and source.project_id == project_id:
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


@router.get("/projects/{project_id}/reviewer", response_model=ReviewerResponse)
def get_project_reviewer(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    require_owner(current_user, project.user_id)

    reviewer = db.get(Reviewer, project_id)
    if not reviewer:
        return {
            "project_id": project_id,
            "source_id": None,
            "status": "not-ready",
            "output_type": "full-reviewer",
            "version": 1,
            "content_json": None,
            "created_at": None,
            "updated_at": None,
        }

    return _reviewer_to_dict(reviewer)


@router.post(
    "/projects/{project_id}/reviewer/feedback",
    response_model=ReviewerFeedbackResponse,
)
@limiter.limit("120/hour")
def record_reviewer_feedback(
    request: Request,
    project_id: str,
    payload: ReviewerFeedbackRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    require_owner(current_user, project.user_id)

    reviewer = db.get(Reviewer, project_id)
    if not reviewer or not isinstance(reviewer.content_json, dict):
        raise HTTPException(status_code=400, detail="No reviewer content to rate")

    item_index = -1 if payload.section == "summary" else payload.item_index
    if payload.section == "summary" and payload.item_index is not None:
        raise HTTPException(status_code=400, detail="Summary feedback does not accept item_index")
    if payload.section != "summary":
        items = reviewer.content_json.get(payload.section)
        if (
            not isinstance(item_index, int)
            or item_index < 0
            or not isinstance(items, list)
            or item_index >= len(items)
        ):
            raise HTTPException(status_code=400, detail="Feedback item does not exist")

    feedback = (
        db.query(ReviewerFeedback)
        .filter(
            ReviewerFeedback.user_id == current_user.user_id,
            ReviewerFeedback.project_id == project_id,
            ReviewerFeedback.reviewer_version == reviewer.version,
            ReviewerFeedback.section == payload.section,
            ReviewerFeedback.item_index == item_index,
        )
        .first()
    )
    now = utc_now_iso()
    if feedback:
        feedback.rating = payload.rating
        feedback.comment = payload.comment
        feedback.updated_at = now
    else:
        feedback = ReviewerFeedback(
            id=str(uuid4()),
            user_id=current_user.user_id,
            project_id=project_id,
            reviewer_version=reviewer.version,
            section=payload.section,
            item_index=item_index,
            rating=payload.rating,
            comment=payload.comment,
            created_at=now,
            updated_at=now,
        )
        db.add(feedback)

    db.commit()
    db.refresh(feedback)
    return {
        "id": feedback.id,
        "project_id": feedback.project_id,
        "reviewer_version": feedback.reviewer_version,
        "section": feedback.section,
        "item_index": None if feedback.item_index == -1 else feedback.item_index,
        "rating": feedback.rating,
        "comment": feedback.comment,
        "created_at": feedback.created_at,
        "updated_at": feedback.updated_at,
    }


@router.get("/projects/{project_id}/reviewer/export/pdf")
def export_reviewer_pdf(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    require_owner(current_user, project.user_id)

    reviewer = db.get(Reviewer, project_id)
    if not reviewer or not reviewer.content_json:
        raise HTTPException(status_code=400, detail="No reviewer content to export")

    template_name = None
    if project.template_id:
        template = get_template(project.template_id)
        if template:
            template_name = template.name

    pdf_bytes = generate_reviewer_pdf(
        project_title=project.title,
        field_of_study=project.field_of_study,
        version=reviewer.version,
        content=reviewer.content_json,
        template_name=template_name,
    )

    safe_title = project.title.lower().replace(" ", "-")[:50]
    filename = f"{safe_title}-reviewer-v{reviewer.version}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


@router.get("/projects/{project_id}/reviewer/download/pdf")
def download_reviewer_pdf(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Same as export/pdf but forces browser download via attachment disposition."""
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    require_owner(current_user, project.user_id)

    reviewer = db.get(Reviewer, project_id)
    if not reviewer or not reviewer.content_json:
        raise HTTPException(status_code=400, detail="No reviewer content to export")

    template_name = None
    if project.template_id:
        template = get_template(project.template_id)
        if template:
            template_name = template.name

    pdf_bytes = generate_reviewer_pdf(
        project_title=project.title,
        field_of_study=project.field_of_study,
        version=reviewer.version,
        content=reviewer.content_json,
        template_name=template_name,
    )

    safe_title = project.title.lower().replace(" ", "-")[:50]
    filename = f"{safe_title}-reviewer-v{reviewer.version}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/projects/{project_id}/reviewer/export/custom-pdf")
def export_custom_pdf(
    project_id: str,
    payload: CustomPdfRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Generate PDF with custom section order and visibility from the export editor."""
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    require_owner(current_user, project.user_id)

    reviewer = db.get(Reviewer, project_id)
    if not reviewer or not reviewer.content_json:
        raise HTTPException(status_code=400, detail="No reviewer content to export")

    template_name = None
    if project.template_id:
        template = get_template(project.template_id)
        if template:
            template_name = template.name

    pdf_bytes = generate_reviewer_pdf(
        project_title=project.title,
        field_of_study=project.field_of_study,
        version=reviewer.version,
        content=reviewer.content_json,
        template_name=template_name,
        section_order=payload.section_order,
        visible_sections=payload.visible_sections,
    )

    safe_title = project.title.lower().replace(" ", "-")[:50]
    filename = f"{safe_title}-reviewer-v{reviewer.version}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/reviewer/regenerate", response_model=JobResponse)
@limiter.limit("10/hour;30/day;100/month")
def regenerate_reviewer(
    request: Request,
    payload: ReviewerRegenerateRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    project = db.get(Project, payload.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    require_owner(current_user, project.user_id)

    source = _pick_source_for_regenerate(db, payload.project_id, payload.source_id)

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

    existing_reviewer = db.get(Reviewer, payload.project_id)
    if existing_reviewer:
        existing_reviewer.status = "stale"
        existing_reviewer.updated_at = now

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
        job_type="regenerate-reviewer",
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

    return _job_to_dict(job)


@router.post("/reviewer/batch-generate", response_model=BatchGenerateResponse)
@limiter.limit("10/hour;30/day;100/month")
def batch_generate_reviewer(
    request: Request,
    payload: BatchGenerateRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Generate from multiple sources in one request. Each source runs sequentially
    and appends its content to the shared project reviewer."""
    project = db.get(Project, payload.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    require_owner(current_user, project.user_id)

    if not payload.sources:
        raise HTTPException(status_code=400, detail="At least one source config is required")

    # Cap batch size — prevents 1 request from triggering N unbounded AI calls
    MAX_BATCH_SOURCES = 5
    if len(payload.sources) > MAX_BATCH_SOURCES:
        raise HTTPException(
            status_code=400,
            detail=f"Batch is limited to {MAX_BATCH_SOURCES} sources per request",
        )

    require_generation_challenge(request, payload.turnstile_token, current_user.user_id, db)
    lock_quota_for_user(current_user.user_id, db)
    check_daily_cap(user_id=current_user.user_id, db=db, requested_generations=len(payload.sources))
    check_monthly_quota(user_id=current_user.user_id, db=db, requested_generations=len(payload.sources))

    now = utc_now_iso()
    batch_id = str(uuid4())

    # Mark existing reviewer as stale
    existing_reviewer = db.get(Reviewer, payload.project_id)
    if existing_reviewer:
        existing_reviewer.status = "stale"
        existing_reviewer.updated_at = now

    # Create a job for each source and validate
    job_ids = []

    for sc in payload.sources:
        source = db.get(Source, sc.source_id)
        if not source:
            raise HTTPException(status_code=404, detail=f"Source {sc.source_id} not found")
        if source.project_id != payload.project_id:
            raise HTTPException(status_code=400, detail=f"Source {sc.source_id} does not belong to project")

        source_text = (source.text or "").strip()
        if not source_text:
            raise HTTPException(
                status_code=400,
                detail=f"Source '{source.title}' has no usable text"
            )

        job = Job(
            id=str(uuid4()),
            project_id=payload.project_id,
            source_id=source.id,
            user_id=current_user.user_id,
            job_type="batch-generate",
            status="queued",
            stage="queued",
            created_at=now,
            updated_at=now,
            error_message=None,
        )
        counts_dict = sc.counts.model_dump(exclude_none=True) if sc.counts else None

        # Fall back to template defaults
        sections = sc.sections
        if sections is None and counts_dict is None and project.template_id:
            template = get_template(project.template_id)
            if template:
                sections = template.sections
                counts_dict = dict(template.counts)

        job.generation_options = {
            "sections": sections,
            "counts": counts_dict,
            "merge_mode": sc.merge_mode,
        }
        db.add(job)
        reserve_usage(db, current_user.user_id, job.id)
        job_ids.append(job.id)

    db.commit()

    return BatchGenerateResponse(
        batch_id=batch_id,
        project_id=payload.project_id,
        total_sources=len(payload.sources),
        status="processing",
        job_ids=job_ids,
    )
