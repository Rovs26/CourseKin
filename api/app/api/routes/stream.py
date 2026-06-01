from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session

from app.core.auth import CurrentUser, get_current_user, require_owner
from app.core.rate_limit import limiter
from app.core.utils import utc_now_iso
from app.db.database import get_db
from app.db.models import CourseObligation, CourseStreamEntry, CourseStreamEntrySource, Job, Project, Source
from app.schemas.job import JobResponse
from app.schemas.stream import (
    CourseAnswerRequest,
    CourseCoachingRequest,
    CourseConfusionStatusUpdate,
    CourseStreamEntryListResponse,
    CourseStreamEntryResponse,
    CourseStreamEntryWriteRequest,
    StreamSourceFromEntriesRequest,
)
from app.schemas.source import SourceResponse
from app.services.source_chunk_service import index_source_chunks
from app.services.generation_guard_service import require_generation_challenge
from app.services.usage_service import (
    check_daily_cap,
    check_monthly_quota,
    lock_quota_for_user,
    reserve_usage,
)

router = APIRouter(tags=["Course Stream"])


def _require_owned_project(db: Session, project_id: str, current_user: CurrentUser) -> Project:
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    require_owner(current_user, project.user_id)
    return project


def _source_to_reference(source: Source) -> dict:
    return {
        "id": source.id,
        "title": source.title,
        "type": source.type,
        "status": source.status,
        "purpose": source.purpose,
    }


def _entry_to_dict(item: CourseStreamEntry, linked_sources: list[Source] | None = None) -> dict:
    return {
        "id": item.id,
        "project_id": item.project_id,
        "entry_type": item.entry_type,
        "content": item.content,
        "linked_sources": [_source_to_reference(source) for source in linked_sources or []],
        "confusion_status": item.confusion_status if item.entry_type == "question" else None,
        "answer_status": item.answer_status if item.entry_type == "question" else None,
        "answer_mode": item.answer_mode if item.entry_type == "question" else None,
        "answer_content": item.answer_content if item.entry_type == "question" else None,
        "answer_evidence": item.answer_evidence if item.entry_type == "question" else None,
        "answer_job_id": item.answer_job_id if item.entry_type == "question" else None,
        "answer_generated_at": item.answer_generated_at if item.entry_type == "question" else None,
        "coaching_mode": item.coaching_mode if item.entry_type == "coaching" else None,
        "related_obligation_id": item.related_obligation_id if item.entry_type == "coaching" else None,
        "coaching_context": item.coaching_context if item.entry_type == "coaching" else None,
        "coaching_status": item.coaching_status if item.entry_type == "coaching" else None,
        "coaching_output": item.coaching_output if item.entry_type == "coaching" else None,
        "coaching_evidence": item.coaching_evidence if item.entry_type == "coaching" else None,
        "coaching_job_id": item.coaching_job_id if item.entry_type == "coaching" else None,
        "coaching_generated_at": item.coaching_generated_at if item.entry_type == "coaching" else None,
        "audio_payload": item.audio_payload if item.entry_type == "audio_transcript" else None,
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


def _clear_course_answer(item: CourseStreamEntry) -> None:
    item.answer_status = None
    item.answer_mode = None
    item.answer_content = None
    item.answer_evidence = None
    item.answer_job_id = None
    item.answer_generated_at = None


def _processed_materials(linked_sources: list[Source]) -> list[Source]:
    return [
        source for source in linked_sources if source.status == "processed" and (source.text or "").strip()
    ]


def _obligation_context(item: CourseObligation | None) -> dict | None:
    if not item:
        return None
    return {
        "id": item.id,
        "title": item.title,
        "obligation_type": item.obligation_type,
        "due_date": item.due_date,
        "details": item.details,
        "grading_criteria": item.grading_criteria,
    }


def _linked_sources_by_entry(
    db: Session, entries: list[CourseStreamEntry]
) -> dict[str, list[Source]]:
    if not entries:
        return {}
    entry_ids = [entry.id for entry in entries]
    links = (
        db.query(CourseStreamEntrySource)
        .filter(CourseStreamEntrySource.entry_id.in_(entry_ids))
        .order_by(CourseStreamEntrySource.entry_id, CourseStreamEntrySource.ordinal)
        .all()
    )
    source_ids = [link.source_id for link in links]
    sources = (
        {source.id: source for source in db.query(Source).filter(Source.id.in_(source_ids)).all()}
        if source_ids
        else {}
    )
    linked: dict[str, list[Source]] = {entry_id: [] for entry_id in entry_ids}
    for link in links:
        source = sources.get(link.source_id)
        if source:
            linked[link.entry_id].append(source)
    return linked


def _validate_linked_sources(db: Session, project_id: str, source_ids: list[str]) -> list[Source]:
    if not source_ids:
        return []
    available_sources = {
        source.id: source
        for source in db.query(Source)
        .filter(Source.project_id == project_id, Source.id.in_(source_ids))
        .all()
    }
    if set(available_sources) != set(source_ids):
        raise HTTPException(
            status_code=400,
            detail="Linked course materials must belong to this course workspace",
        )
    return [available_sources[source_id] for source_id in source_ids]


def _replace_linked_sources(
    db: Session,
    entry: CourseStreamEntry,
    linked_sources: list[Source],
    now: str,
) -> None:
    db.query(CourseStreamEntrySource).filter(
        CourseStreamEntrySource.entry_id == entry.id
    ).delete()
    for ordinal, source in enumerate(linked_sources):
        db.add(
            CourseStreamEntrySource(
                id=str(uuid4()),
                entry_id=entry.id,
                source_id=source.id,
                project_id=entry.project_id,
                ordinal=ordinal,
                created_at=now,
            )
        )


@router.get(
    "/projects/{project_id}/stream/entries",
    response_model=CourseStreamEntryListResponse,
)
def list_course_stream_entries(
    project_id: str,
    limit: int = Query(default=100, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    _require_owned_project(db, project_id, current_user)
    query = db.query(CourseStreamEntry).filter(CourseStreamEntry.project_id == project_id)
    total = query.count()
    items = (
        query.order_by(CourseStreamEntry.created_at.desc(), CourseStreamEntry.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    items.reverse()
    linked_sources = _linked_sources_by_entry(db, items)
    return {
        "items": [_entry_to_dict(item, linked_sources.get(item.id)) for item in items],
        "total": total,
    }


@router.post(
    "/projects/{project_id}/stream/entries",
    response_model=CourseStreamEntryResponse,
)
@limiter.limit("120/hour")
def create_course_stream_entry(
    request: Request,
    project_id: str,
    payload: CourseStreamEntryWriteRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    project = _require_owned_project(db, project_id, current_user)
    linked_sources = _validate_linked_sources(db, project_id, payload.linked_source_ids)
    now = utc_now_iso()
    item = CourseStreamEntry(
        id=str(uuid4()),
        project_id=project_id,
        user_id=current_user.user_id,
        entry_type=payload.entry_type,
        content=payload.content,
        confusion_status="open" if payload.entry_type == "question" else None,
        created_at=now,
        updated_at=now,
    )
    project.updated_at = now
    db.add(item)
    _replace_linked_sources(db, item, linked_sources, now)
    db.commit()
    db.refresh(item)
    return _entry_to_dict(item, linked_sources)


@router.patch(
    "/projects/{project_id}/stream/entries/{entry_id}",
    response_model=CourseStreamEntryResponse,
)
@limiter.limit("120/hour")
def update_course_stream_entry(
    request: Request,
    project_id: str,
    entry_id: str,
    payload: CourseStreamEntryWriteRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    project = _require_owned_project(db, project_id, current_user)
    item = db.get(CourseStreamEntry, entry_id)
    if not item or item.project_id != project_id:
        raise HTTPException(status_code=404, detail="Course stream entry not found")
    if item.entry_type == "coaching":
        raise HTTPException(status_code=400, detail="Create a new coaching request instead of editing generated coaching")
    linked_sources = _validate_linked_sources(db, project_id, payload.linked_source_ids)
    existing_sources = _linked_sources_by_entry(db, [item]).get(item.id, [])
    answer_inputs_changed = (
        item.content != payload.content
        or item.entry_type != payload.entry_type
        or [source.id for source in existing_sources] != payload.linked_source_ids
    )
    was_question = item.entry_type == "question"
    item.entry_type = payload.entry_type
    item.content = payload.content
    if payload.entry_type == "question":
        if not was_question:
            item.confusion_status = "open"
        elif not item.confusion_status:
            item.confusion_status = "open"
    else:
        item.confusion_status = None
    if answer_inputs_changed or payload.entry_type != "question":
        _clear_course_answer(item)
    item.updated_at = utc_now_iso()
    project.updated_at = item.updated_at
    _replace_linked_sources(db, item, linked_sources, item.updated_at)
    db.commit()
    db.refresh(item)
    return _entry_to_dict(item, linked_sources)


@router.patch(
    "/projects/{project_id}/stream/entries/{entry_id}/confusion",
    response_model=CourseStreamEntryResponse,
)
def update_course_confusion_status(
    project_id: str,
    entry_id: str,
    payload: CourseConfusionStatusUpdate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    project = _require_owned_project(db, project_id, current_user)
    item = db.get(CourseStreamEntry, entry_id)
    if not item or item.project_id != project_id:
        raise HTTPException(status_code=404, detail="Course stream entry not found")
    if item.entry_type != "question":
        raise HTTPException(status_code=400, detail="Only questions belong in the confusion inbox")
    item.confusion_status = payload.status
    item.updated_at = utc_now_iso()
    project.updated_at = item.updated_at
    db.commit()
    db.refresh(item)
    linked_sources = _linked_sources_by_entry(db, [item]).get(item.id, [])
    return _entry_to_dict(item, linked_sources)


@router.post(
    "/projects/{project_id}/stream/entries/{entry_id}/answer",
    response_model=JobResponse,
)
@limiter.limit("10/hour;30/day;100/month")
def request_course_answer(
    request: Request,
    project_id: str,
    entry_id: str,
    payload: CourseAnswerRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    project = _require_owned_project(db, project_id, current_user)
    item = db.get(CourseStreamEntry, entry_id)
    if not item or item.project_id != project_id:
        raise HTTPException(status_code=404, detail="Course stream entry not found")
    if item.entry_type != "question":
        raise HTTPException(status_code=400, detail="Only questions can request a course answer")
    if item.answer_status in {"queued", "generating"}:
        raise HTTPException(status_code=409, detail="An answer is already being prepared")
    linked_sources = _linked_sources_by_entry(db, [item]).get(item.id, [])
    answer_sources = _processed_materials(linked_sources)
    if not answer_sources:
        raise HTTPException(
            status_code=400,
            detail="Attach at least one processed course material before requesting an answer",
        )

    require_generation_challenge(request, payload.turnstile_token, current_user.user_id, db)
    lock_quota_for_user(current_user.user_id, db)
    check_daily_cap(user_id=current_user.user_id, db=db)
    check_monthly_quota(user_id=current_user.user_id, db=db)

    now = utc_now_iso()
    job = Job(
        id=str(uuid4()),
        project_id=project_id,
        source_id=answer_sources[0].id,
        user_id=current_user.user_id,
        job_type="answer-course-question",
        status="queued",
        stage="queued",
        generation_options={
            "stream_entry_id": item.id,
            "source_ids": [source.id for source in answer_sources],
            "explanation_mode": payload.explanation_mode,
        },
        created_at=now,
        updated_at=now,
        error_message=None,
    )
    item.confusion_status = "open"
    item.answer_status = "queued"
    item.answer_mode = payload.explanation_mode
    item.answer_content = None
    item.answer_evidence = None
    item.answer_job_id = job.id
    item.answer_generated_at = None
    item.updated_at = now
    project.updated_at = now
    db.add(job)
    reserve_usage(db, current_user.user_id, job.id)
    db.commit()
    db.refresh(job)
    return _job_to_dict(job)


@router.post(
    "/projects/{project_id}/stream/coaching",
    response_model=CourseStreamEntryResponse,
)
@limiter.limit("10/hour;30/day;100/month")
def request_coursework_coaching(
    request: Request,
    project_id: str,
    payload: CourseCoachingRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    project = _require_owned_project(db, project_id, current_user)
    linked_sources = _validate_linked_sources(db, project_id, payload.linked_source_ids)
    coaching_sources = _processed_materials(linked_sources)
    if not coaching_sources:
        raise HTTPException(
            status_code=400,
            detail="Attach at least one processed course material before requesting coaching",
        )

    obligation = db.get(CourseObligation, payload.obligation_id) if payload.obligation_id else None
    if payload.obligation_id and (
        not obligation or obligation.project_id != project_id or obligation.status != "confirmed"
    ):
        raise HTTPException(status_code=400, detail="Select a confirmed course obligation")
    if payload.coaching_mode in {"assignment_plan", "draft_feedback"}:
        if not obligation or obligation.obligation_type not in {"assignment", "paper", "project"}:
            raise HTTPException(
                status_code=400,
                detail="Assignment coaching supports confirmed light assignments, short papers, or projects only",
            )
        has_rubric_source = any(source.purpose == "assignment_brief" for source in coaching_sources)
        if not obligation.grading_criteria and not has_rubric_source:
            raise HTTPException(
                status_code=400,
                detail="Add grading criteria or attach an assignment brief for rubric-aware coaching",
            )

    require_generation_challenge(request, payload.turnstile_token, current_user.user_id, db)
    lock_quota_for_user(current_user.user_id, db)
    check_daily_cap(user_id=current_user.user_id, db=db)
    check_monthly_quota(user_id=current_user.user_id, db=db)

    now = utc_now_iso()
    item = CourseStreamEntry(
        id=str(uuid4()),
        project_id=project_id,
        user_id=current_user.user_id,
        entry_type="coaching",
        content=payload.content,
        coaching_mode=payload.coaching_mode,
        related_obligation_id=payload.obligation_id,
        coaching_context={"obligation": _obligation_context(obligation)},
        coaching_status="queued",
        created_at=now,
        updated_at=now,
    )
    job = Job(
        id=str(uuid4()),
        project_id=project_id,
        source_id=coaching_sources[0].id,
        user_id=current_user.user_id,
        job_type="coach-coursework",
        status="queued",
        stage="queued",
        generation_options={
            "stream_entry_id": item.id,
            "source_ids": [source.id for source in coaching_sources],
        },
        created_at=now,
        updated_at=now,
        error_message=None,
    )
    item.coaching_job_id = job.id
    project.updated_at = now
    db.add(item)
    _replace_linked_sources(db, item, linked_sources, now)
    db.add(job)
    reserve_usage(db, current_user.user_id, job.id)
    db.commit()
    db.refresh(item)
    return _entry_to_dict(item, linked_sources)


@router.post(
    "/projects/{project_id}/stream/source-from-entries",
    response_model=SourceResponse,
)
@limiter.limit("20/hour")
def create_source_from_stream_entries(
    request: Request,
    project_id: str,
    payload: StreamSourceFromEntriesRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Compile selected course-stream entries into a text source the reviewer
    generator can use. Keeps stream content private to the student while still
    letting them generate summaries / flashcards / quizzes from their own
    captured notes and reflections."""
    project = _require_owned_project(db, project_id, current_user)

    entries = (
        db.query(CourseStreamEntry)
        .filter(
            CourseStreamEntry.id.in_(payload.entry_ids),
            CourseStreamEntry.project_id == project_id,
            CourseStreamEntry.user_id == current_user.user_id,
        )
        .all()
    )
    if not entries:
        raise HTTPException(status_code=404, detail="No matching stream entries")

    by_id = {entry.id: entry for entry in entries}
    ordered = [by_id[entry_id] for entry_id in payload.entry_ids if entry_id in by_id]

    parts: list[str] = []
    for entry in ordered:
        label = entry.entry_type.capitalize()
        parts.append(f"[{label}] {entry.content.strip()}")
    combined = "\n\n".join(parts).strip()
    if not combined:
        raise HTTPException(status_code=400, detail="Selected entries have no content")

    title = payload.title or f"Course room selection ({len(ordered)} entries)"

    now = utc_now_iso()
    source = Source(
        id=str(uuid4()),
        project_id=project_id,
        title=title[:200],
        type="text",
        status="ready",
        text=combined,
        purpose="lecture_notes",
        created_at=now,
        updated_at=now,
    )
    db.add(source)
    db.commit()
    db.refresh(source)
    index_source_chunks(db, source)

    return {
        "id": source.id,
        "project_id": source.project_id,
        "title": source.title,
        "type": source.type,
        "status": source.status,
        "purpose": source.purpose,
        "created_at": source.created_at,
        "updated_at": source.updated_at,
    }


@router.delete("/projects/{project_id}/stream/entries/{entry_id}")
@limiter.limit("60/hour")
def delete_course_stream_entry(
    request: Request,
    project_id: str,
    entry_id: str,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    project = _require_owned_project(db, project_id, current_user)
    item = db.get(CourseStreamEntry, entry_id)
    if not item or item.project_id != project_id:
        raise HTTPException(status_code=404, detail="Course stream entry not found")
    project.updated_at = utc_now_iso()
    db.query(CourseStreamEntrySource).filter(
        CourseStreamEntrySource.entry_id == item.id
    ).delete()
    db.delete(item)
    db.commit()
    return {"message": "Course stream entry deleted successfully"}
