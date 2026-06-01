"""Audio E1 routes — consent, upload-url, transcribe.

Per docs/audio_e1_design.md. The feature is gated by `settings.AUDIO_E1_ENABLED`;
when False every endpoint returns 404 so a partially-rolled-out instance
behaves identically to a not-yet-shipped feature.

Processing model:
- Browser uploads directly to R2 via presigned PUT (storage_service).
- /audio/transcribe creates a Job and schedules a background task that
  downloads from R2, runs Whisper, runs the summary LLM, materializes a
  CourseStreamEntry with entry_type="audio_transcript", and deletes the
  raw audio object from R2.
"""

from __future__ import annotations

import logging
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.auth import CurrentUser, get_current_user, require_owner
from app.core.config import settings
from app.core.rate_limit import limiter
from app.core.utils import utc_now_iso
from app.db.database import SessionLocal, get_db
from app.db.models import (
    CourseStreamEntry,
    Job,
    NotebookCard,
    Project,
    UserAudioConsent,
)
from app.schemas.audio import (
    AudioCardAcceptRequest,
    AudioConsentRequest,
    AudioConsentStatus,
    AudioStreamEntryResponse,
    AudioTranscribeRequest,
    AudioUploadUrlRequest,
    AudioUploadUrlResponse,
)
from app.schemas.job import JobResponse
from app.schemas.notebook import NotebookCardResponse
from app.services.audio_service import (
    summarize_transcript,
    transcribe_audio_bytes,
)
from app.services.generation_guard_service import require_generation_challenge
from app.services.storage_service import (
    delete_object,
    download_audio_to_bytes,
    generate_presigned_put_audio,
)
from app.services.usage_service import (
    check_daily_cap,
    check_monthly_quota,
    lock_quota_for_user,
    record_usage,
    release_reserved_cost,
    reserve_usage,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Audio"])


def _require_feature_enabled() -> None:
    if not settings.AUDIO_E1_ENABLED:
        # Behave as if the routes do not exist when the flag is off.
        raise HTTPException(status_code=404, detail="Not Found")


def _require_owned_project(db: Session, project_id: str, current_user: CurrentUser) -> Project:
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    require_owner(current_user, project.user_id)
    return project


def _latest_consent(db: Session, user_id: str) -> UserAudioConsent | None:
    return (
        db.query(UserAudioConsent)
        .filter(UserAudioConsent.user_id == user_id)
        .order_by(UserAudioConsent.accepted_at.desc())
        .first()
    )


@router.get(
    "/projects/{project_id}/audio/consent",
    response_model=AudioConsentStatus,
)
def get_audio_consent_status(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    _require_feature_enabled()
    _require_owned_project(db, project_id, current_user)
    latest = _latest_consent(db, current_user.user_id)
    accepted_version = latest.consent_version if latest else None
    needs = accepted_version != settings.AUDIO_CONSENT_VERSION
    return {
        "consent_required_version": settings.AUDIO_CONSENT_VERSION,
        "accepted_version": accepted_version,
        "accepted_at": latest.accepted_at if latest else None,
        "needs_consent": needs,
    }


@router.post(
    "/projects/{project_id}/audio/consent",
    response_model=AudioConsentStatus,
)
@limiter.limit("20/hour")
def post_audio_consent(
    request: Request,
    project_id: str,
    payload: AudioConsentRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    _require_feature_enabled()
    _require_owned_project(db, project_id, current_user)
    if payload.consent_version != settings.AUDIO_CONSENT_VERSION:
        raise HTTPException(
            status_code=409,
            detail=(
                "Consent version is out of date. "
                "Reload to see the current statement."
            ),
        )
    now = utc_now_iso()
    db.add(
        UserAudioConsent(
            id=str(uuid4()),
            user_id=current_user.user_id,
            consent_version=payload.consent_version,
            accepted_at=now,
            accepted_user_agent=payload.user_agent,
        )
    )
    db.commit()
    return {
        "consent_required_version": settings.AUDIO_CONSENT_VERSION,
        "accepted_version": payload.consent_version,
        "accepted_at": now,
        "needs_consent": False,
    }


@router.post(
    "/projects/{project_id}/audio/upload-url",
    response_model=AudioUploadUrlResponse,
)
@limiter.limit("5/hour;15/day")
def create_audio_upload_url(
    request: Request,
    project_id: str,
    payload: AudioUploadUrlRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    _require_feature_enabled()
    _require_owned_project(db, project_id, current_user)
    # Consent gate — required before issuing a presign URL.
    latest = _latest_consent(db, current_user.user_id)
    if not latest or latest.consent_version != settings.AUDIO_CONSENT_VERSION:
        raise HTTPException(status_code=403, detail="Audio consent required")
    if payload.size_bytes > settings.AUDIO_MAX_FILE_BYTES:
        raise HTTPException(status_code=413, detail="Audio file is too large")
    return generate_presigned_put_audio(
        user_id=current_user.user_id,
        filename=payload.filename,
        content_type=payload.content_type,
        size_bytes=payload.size_bytes,
        max_bytes=settings.AUDIO_MAX_FILE_BYTES,
    )


def _run_audio_transcription_in_background(
    job_id: str,
    project_id: str,
    user_id: str,
    storage_key: str,
    original_filename: str,
) -> None:
    db = SessionLocal()
    try:
        job = db.get(Job, job_id)
        if not job:
            return
        try:
            job.stage = "transcribing"
            job.updated_at = utc_now_iso()
            db.commit()

            audio_bytes = download_audio_to_bytes(
                storage_key, max_bytes=settings.AUDIO_MAX_FILE_BYTES
            )
            transcript, whisper_meta = transcribe_audio_bytes(
                filename=original_filename,
                audio_bytes=audio_bytes,
            )
            duration_seconds = whisper_meta.get("duration_seconds", 0)
            language = whisper_meta.get("language")
            if duration_seconds and duration_seconds > settings.AUDIO_MAX_DURATION_SECONDS:
                raise ValueError(
                    "Audio exceeds the 60 minute per-upload cap"
                )

            project = db.get(Project, project_id)
            course_context = [f"Course title: {project.title}"] if project else []

            job.stage = "summarizing"
            job.updated_at = utc_now_iso()
            db.commit()

            summary_payload, summary_meta = summarize_transcript(
                transcript, course_context=course_context
            )

            now = utc_now_iso()
            entry = CourseStreamEntry(
                id=str(uuid4()),
                project_id=project_id,
                user_id=user_id,
                entry_type="audio_transcript",
                content=summary_payload.get("summary") or "",
                audio_payload={
                    "transcript": transcript,
                    "duration_seconds": duration_seconds,
                    "audio_filename": original_filename,
                    "language": language,
                    "language_warning": summary_payload.get("language_warning"),
                    "candidate_cards": summary_payload.get("cards") or [],
                    "job_id": job_id,
                },
                created_at=now,
                updated_at=now,
            )
            db.add(entry)
            job.status = "completed"
            job.stage = "completed"
            job.updated_at = now
            db.commit()

            # Reconcile reservation with actuals.
            total_cost = (
                float(whisper_meta.get("cost_usd") or 0.0)
                + float(summary_meta.get("cost_usd") or 0.0)
            )
            try:
                record_usage(
                    db=db,
                    user_id=user_id,
                    job_id=job_id,
                    model=summary_meta.get("model", settings.AUDIO_SUMMARY_MODEL),
                    prompt_tokens=summary_meta.get("prompt_tokens", 0),
                    completion_tokens=summary_meta.get("completion_tokens", 0),
                    cost_usd=total_cost,
                )
            except Exception:
                db.rollback()
        except Exception as exc:
            logger.exception("Audio transcription failed: job=%s error=%s", job_id, exc)
            job.status = "failed"
            job.stage = "failed"
            job.error_message = str(exc)[:500]
            job.updated_at = utc_now_iso()
            db.commit()
            try:
                release_reserved_cost(db, user_id, job_id)
            except Exception:
                db.rollback()
        finally:
            # Always delete the raw audio object — per design doc §5 retention.
            try:
                delete_object(storage_key)
            except Exception as exc:
                logger.warning("Failed to delete audio object %s: %s", storage_key, exc)
    finally:
        db.close()


@router.post(
    "/projects/{project_id}/audio/transcribe",
    response_model=JobResponse,
)
@limiter.limit("5/hour;15/day")
def start_audio_transcription(
    request: Request,
    project_id: str,
    payload: AudioTranscribeRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    _require_feature_enabled()
    _require_owned_project(db, project_id, current_user)
    latest = _latest_consent(db, current_user.user_id)
    if not latest or latest.consent_version != settings.AUDIO_CONSENT_VERSION:
        raise HTTPException(status_code=403, detail="Audio consent required")

    if not payload.storage_key.startswith(f"audio-temp/{current_user.user_id}/"):
        raise HTTPException(status_code=403, detail="Access denied")

    require_generation_challenge(request, payload.turnstile_token, current_user.user_id, db)
    lock_quota_for_user(current_user.user_id, db)
    check_daily_cap(user_id=current_user.user_id, db=db)
    check_monthly_quota(user_id=current_user.user_id, db=db)

    now = utc_now_iso()
    job = Job(
        id=str(uuid4()),
        project_id=project_id,
        source_id=None,
        user_id=current_user.user_id,
        job_type="transcribe-audio",
        status="queued",
        stage="queued",
        generation_options={"storage_key": payload.storage_key},
        created_at=now,
        updated_at=now,
        error_message=None,
    )
    db.add(job)
    reserve_usage(db, current_user.user_id, job.id)
    db.commit()
    db.refresh(job)

    background_tasks.add_task(
        _run_audio_transcription_in_background,
        job_id=job.id,
        project_id=project_id,
        user_id=current_user.user_id,
        storage_key=payload.storage_key,
        original_filename=payload.original_filename,
    )

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


@router.post(
    "/projects/{project_id}/audio/entries/{entry_id}/cards/accept",
    response_model=NotebookCardResponse,
)
@limiter.limit("60/hour")
def accept_audio_candidate_card(
    request: Request,
    project_id: str,
    entry_id: str,
    payload: AudioCardAcceptRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Persist one candidate flashcard from an audio_transcript entry into the notebook."""
    _require_feature_enabled()
    _require_owned_project(db, project_id, current_user)

    entry = db.get(CourseStreamEntry, entry_id)
    if (
        not entry
        or entry.project_id != project_id
        or entry.user_id != current_user.user_id
        or entry.entry_type != "audio_transcript"
    ):
        raise HTTPException(status_code=404, detail="Audio entry not found")

    now = utc_now_iso()
    today = now.split("T", 1)[0]
    card = NotebookCard(
        id=str(uuid4()),
        user_id=current_user.user_id,
        project_id=project_id,
        source_stream_entry_id=entry.id,
        source_audio_entry_id=entry.id,
        origin="stream_entry",
        front=payload.front,
        back=payload.back,
        tags=[payload.tag] if payload.tag else [],
        ease_factor=2.5,
        interval_days=0,
        repetitions=0,
        due_date=today,
        last_reviewed_at=None,
        last_quality=None,
        created_at=now,
        updated_at=now,
    )
    db.add(card)
    db.commit()
    db.refresh(card)
    return {
        "id": card.id,
        "project_id": card.project_id,
        "user_id": card.user_id,
        "source_stream_entry_id": card.source_stream_entry_id,
        "origin": card.origin,
        "front": card.front,
        "back": card.back,
        "tags": card.tags or [],
        "ease_factor": card.ease_factor,
        "interval_days": card.interval_days,
        "repetitions": card.repetitions,
        "due_date": card.due_date,
        "last_reviewed_at": card.last_reviewed_at,
        "last_quality": card.last_quality,
        "created_at": card.created_at,
        "updated_at": card.updated_at,
    }
