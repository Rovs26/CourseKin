import logging
import tempfile
from pathlib import Path
from urllib.parse import urljoin
from uuid import uuid4

import requests as http_requests
from bs4 import BeautifulSoup
from fastapi import APIRouter, HTTPException, Depends, Request
from sqlalchemy.orm import Session

from app.core.auth import CurrentUser, get_current_user, require_owner
from app.core.rate_limit import limiter
from app.core.utils import utc_now_iso
from app.db.database import get_db
from app.db.models import (
    CourseObligation,
    CourseStreamEntry,
    CourseStreamEntrySource,
    PreparationMilestone,
    Project,
    Source,
    SourceChunk,
)
from app.schemas.source import (
    PresignUploadRequest,
    FinalizeUploadRequest,
    SourceTextCreate,
    SourceUrlCreate,
    SourceResponse,
    SourceListResponse,
    SourcePurposeUpdate,
    SourceChunkListResponse,
    SyllabusPrefillRequest,
    SyllabusPrefillResponse,
)
from app.core.security import validate_url_safe
from app.services import storage_service
from app.services.pdf_service import extract_pdf_pages
from app.services.source_chunk_service import index_source_chunks
from app.services.syllabus_prefill_service import extract_syllabus_metadata
from app.services.usage_service import (
    check_daily_cap,
    check_monthly_quota,
    lock_quota_for_user,
    record_usage,
)
from app.services.validation_service import (
    validate_pdf_bytes,
    validate_pdf_structure,
    validate_extracted_text,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Sources"])

MAX_PDF_BYTES = 25 * 1024 * 1024   # 25 MB — matches R2 presign cap
MAX_TEXT_SIZE = 500 * 1024          # 500 KB
MAX_URL_RESPONSE_SIZE = 5 * 1024 * 1024  # 5 MB
MAX_TEXT_CHARS = 50_000
MAX_REDIRECTS = 5


def _truncate_pages(page_texts: list[tuple[int, str]], limit: int) -> list[tuple[int, str]]:
    remaining = limit
    truncated: list[tuple[int, str]] = []
    for page_number, text in page_texts:
        if remaining <= 0:
            break
        text_slice = text[:remaining].strip()
        if text_slice:
            truncated.append((page_number, text_slice))
            remaining -= len(text_slice)
    return truncated


@router.post("/syllabus/prefill", response_model=SyllabusPrefillResponse)
@limiter.limit("10/hour;30/day")
def prefill_from_syllabus(
    request: Request,
    payload: SyllabusPrefillRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Best-effort extract course fields from pasted syllabus text (pre-project)."""
    lock_quota_for_user(current_user.user_id, db)
    check_daily_cap(current_user.user_id, db)
    check_monthly_quota(current_user.user_id, db)
    metadata, usage = extract_syllabus_metadata(payload.text)
    record_usage(db=db, user_id=current_user.user_id, job_id=None, **usage)
    return SyllabusPrefillResponse(**metadata)


def _source_to_dict(source: Source):
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


def _fetch_public_url(url: str):
    """Fetch a public page while validating every redirect destination."""
    current_url = url
    for _ in range(MAX_REDIRECTS + 1):
        validate_url_safe(current_url)
        resp = http_requests.get(
            current_url,
            timeout=15,
            headers={"User-Agent": "CourseKin/1.0"},
            stream=True,
            allow_redirects=False,
        )
        if resp.is_redirect or resp.is_permanent_redirect:
            location = resp.headers.get("Location")
            resp.close()
            if not location:
                raise HTTPException(status_code=400, detail="URL redirect is missing a destination")
            current_url = urljoin(current_url, location)
            continue
        return resp
    raise HTTPException(status_code=400, detail="URL redirects too many times")


# ── Text source ───────────────────────────────────────────────────────────────

@router.post("/sources/text", response_model=SourceResponse)
@limiter.limit("30/hour")
def create_text_source(
    request: Request,
    payload: SourceTextCreate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    project = db.get(Project, payload.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    require_owner(current_user, project.user_id)

    text_content = payload.text or ""
    if len(text_content.encode("utf-8")) > MAX_TEXT_SIZE:
        raise HTTPException(status_code=400, detail="Text source is too large (max 500 KB)")

    now = utc_now_iso()
    source = Source(
        id=str(uuid4()),
        project_id=payload.project_id,
        title=payload.title,
        type="text",
        status="processed" if text_content.strip() else "uploaded",
        text=payload.text,
        purpose=payload.purpose,
        created_at=now,
        updated_at=now,
    )
    db.add(source)
    db.flush()
    index_source_chunks(db, source)
    db.commit()
    db.refresh(source)
    return _source_to_dict(source)


# ── URL source ────────────────────────────────────────────────────────────────

@router.post("/sources/url", response_model=SourceResponse)
@limiter.limit("20/hour")
def create_url_source(
    request: Request,
    payload: SourceUrlCreate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    project = db.get(Project, payload.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    require_owner(current_user, project.user_id)

    url_str = str(payload.url)

    try:
        resp = _fetch_public_url(url_str)
        resp.raise_for_status()

        content_length = int(resp.headers.get("Content-Length", 0))
        if content_length > MAX_URL_RESPONSE_SIZE:
            resp.close()
            raise HTTPException(status_code=400, detail="URL page is too large (max 5 MB)")

        chunks = []
        total = 0
        for chunk in resp.iter_content(chunk_size=64 * 1024):
            total += len(chunk)
            if total > MAX_URL_RESPONSE_SIZE:
                resp.close()
                raise HTTPException(status_code=400, detail="URL page is too large (max 5 MB)")
            chunks.append(chunk)

        html_text = b"".join(chunks).decode("utf-8", errors="replace")
        soup = BeautifulSoup(html_text, "html.parser")
        for tag in soup(["script", "style", "nav", "footer", "header"]):
            tag.decompose()
        extracted_text = soup.get_text(separator="\n", strip=True)
    except HTTPException:
        raise
    except Exception as e:
        logger.warning("URL fetch failed for %s: %s", url_str, e)
        raise HTTPException(status_code=400, detail="Failed to fetch or parse the URL. Check that it is publicly accessible.")

    if not extracted_text.strip():
        raise HTTPException(status_code=400, detail="No readable text found at that URL")

    now = utc_now_iso()
    source = Source(
        id=str(uuid4()),
        project_id=payload.project_id,
        title=payload.title,
        type="url",
        status="processed",
        url=url_str,
        text=extracted_text,
        purpose=payload.purpose,
        created_at=now,
        updated_at=now,
    )
    db.add(source)
    db.flush()
    index_source_chunks(db, source)
    db.commit()
    db.refresh(source)
    return _source_to_dict(source)


# ── PDF upload — presign + finalize ──────────────────────────────────────────

@router.post("/sources/upload/presign")
@limiter.limit("20/hour")
def presign_upload(
    request: Request,
    payload: PresignUploadRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Step 1 of 3 — return a presigned PUT URL for direct browser→R2 upload.

    The client uses this URL to PUT the file bytes directly to R2,
    then calls /sources/upload/finalize to register the source.
    """
    project = db.get(Project, payload.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    require_owner(current_user, project.user_id)

    return storage_service.generate_presigned_put(
        user_id=current_user.user_id,
        filename=payload.filename,
        content_type=payload.content_type,
        size_bytes=payload.size_bytes,
    )


@router.post("/sources/upload/finalize", response_model=SourceResponse)
@limiter.limit("20/hour")
def finalize_upload(
    request: Request,
    payload: FinalizeUploadRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Step 3 of 3 — after the client has PUT to R2, register the source.

    Downloads the object from R2, extracts PDF text, creates the Source row.
    The storage_key is validated to start with temp/<user_id>/ to prevent
    cross-user key injection.
    """
    project = db.get(Project, payload.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    require_owner(current_user, project.user_id)

    # Security: verify the key is scoped to this user — prevents one user from
    # finalizing another user's upload key.
    expected_prefix = f"temp/{current_user.user_id}/"
    if not payload.storage_key.startswith(expected_prefix):
        raise HTTPException(status_code=403, detail="Access denied")

    extracted_text = ""
    page_texts: list[tuple[int, str]] = []
    try:
        # Inspect length before downloading; the read is also bounded.
        pdf_bytes = storage_service.download_to_bytes(payload.storage_key, MAX_PDF_BYTES)
        validate_pdf_bytes(pdf_bytes)
        validate_pdf_structure(pdf_bytes)

        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            tmp.write(pdf_bytes)
            tmp_path = tmp.name

        page_texts = extract_pdf_pages(tmp_path)
        extracted_text = "\n\n".join(text for _, text in page_texts).strip()
        validate_extracted_text(extracted_text)
    except HTTPException:
        storage_service.delete_object(payload.storage_key)
        raise
    except Exception as e:
        storage_service.delete_object(payload.storage_key)
        raise HTTPException(status_code=400, detail=f"PDF text extraction failed: {str(e)}")
    finally:
        try:
            if "tmp_path" in locals():
                Path(tmp_path).unlink(missing_ok=True)
        except Exception:
            pass

    # Truncate to MAX_TEXT_CHARS — matches the OpenAI generation limit
    if len(extracted_text) > MAX_TEXT_CHARS:
        page_texts = _truncate_pages(page_texts, MAX_TEXT_CHARS)
        extracted_text = "\n\n".join(text for _, text in page_texts).strip()

    final_storage_key = storage_service.promote_temp_object(payload.storage_key, current_user.user_id)
    now = utc_now_iso()
    source = Source(
        id=str(uuid4()),
        project_id=payload.project_id,
        title=payload.title,
        type="pdf",
        status="processed",
        storage_key=final_storage_key,
        text=extracted_text,
        purpose=payload.purpose,
        created_at=now,
        updated_at=now,
    )
    db.add(source)
    db.flush()
    index_source_chunks(db, source, page_texts=[(page, text) for page, text in page_texts])
    db.commit()
    db.refresh(source)
    return _source_to_dict(source)


# ── List / get / delete ───────────────────────────────────────────────────────

@router.get("/projects/{project_id}/sources", response_model=SourceListResponse)
@limiter.limit("120/hour")
def list_project_sources(
    request: Request,
    project_id: str,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    require_owner(current_user, project.user_id)

    items = db.query(Source).filter(Source.project_id == project_id).all()
    return {"items": [_source_to_dict(item) for item in items], "total": len(items)}


@router.get("/sources/item/{source_id}", response_model=SourceResponse)
@limiter.limit("120/hour")
def get_source(
    request: Request,
    source_id: str,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    source = db.get(Source, source_id)
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")

    project = db.get(Project, source.project_id)
    require_owner(current_user, project.user_id if project else None)

    return _source_to_dict(source)


@router.get(
    "/sources/item/{source_id}/chunks",
    response_model=SourceChunkListResponse,
)
@limiter.limit("120/hour")
def list_source_chunks(
    request: Request,
    source_id: str,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    source = db.get(Source, source_id)
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    project = db.get(Project, source.project_id)
    require_owner(current_user, project.user_id if project else None)

    chunks = (
        db.query(SourceChunk)
        .filter(SourceChunk.source_id == source_id)
        .order_by(SourceChunk.ordinal.asc())
        .all()
    )
    return {
        "source_id": source.id,
        "source_title": source.title,
        "items": [
            {
                "id": chunk.id,
                "source_id": chunk.source_id,
                "ordinal": chunk.ordinal,
                "page_number": chunk.page_number,
                "text": chunk.text,
            }
            for chunk in chunks
        ],
    }


@router.patch("/sources/{source_id}/purpose", response_model=SourceResponse)
@limiter.limit("30/hour")
def update_source_purpose(
    request: Request,
    source_id: str,
    payload: SourcePurposeUpdate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    source = db.get(Source, source_id)
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    project = db.get(Project, source.project_id)
    require_owner(current_user, project.user_id if project else None)

    source.purpose = payload.purpose
    source.updated_at = utc_now_iso()
    db.commit()
    db.refresh(source)
    return _source_to_dict(source)


@router.delete("/sources/{source_id}")
@limiter.limit("30/hour")
def delete_source(
    request: Request,
    source_id: str,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    source = db.get(Source, source_id)
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")

    project = db.get(Project, source.project_id)
    require_owner(current_user, project.user_id if project else None)

    # Clean up R2 object if present
    if source.storage_key:
        storage_service.delete_object(source.storage_key, strict=True)

    # Clean up legacy local file if present (pre-R2 rows)
    if source.file_path:
        path = Path(source.file_path)
        if path.exists():
            path.unlink()

    obligation_ids = [
        item.id
        for item in db.query(CourseObligation).filter(CourseObligation.source_id == source_id).all()
    ]
    if obligation_ids:
        db.query(PreparationMilestone).filter(
            PreparationMilestone.obligation_id.in_(obligation_ids)
        ).delete(synchronize_session=False)
    db.query(CourseObligation).filter(CourseObligation.source_id == source_id).delete()
    linked_entry_ids = [
        link.entry_id
        for link in db.query(CourseStreamEntrySource).filter(
            CourseStreamEntrySource.source_id == source_id
        ).all()
    ]
    if linked_entry_ids:
        for entry in db.query(CourseStreamEntry).filter(
            CourseStreamEntry.id.in_(linked_entry_ids)
        ).all():
            entry.answer_status = None
            entry.answer_mode = None
            entry.answer_content = None
            entry.answer_evidence = None
            entry.answer_job_id = None
            entry.answer_generated_at = None
            entry.coaching_status = None
            entry.coaching_output = None
            entry.coaching_evidence = None
            entry.coaching_job_id = None
            entry.coaching_generated_at = None
            entry.updated_at = utc_now_iso()
    db.query(CourseStreamEntrySource).filter(
        CourseStreamEntrySource.source_id == source_id
    ).delete()
    db.query(SourceChunk).filter(SourceChunk.source_id == source_id).delete()
    db.delete(source)
    db.commit()
    return {"message": "Source deleted successfully"}
