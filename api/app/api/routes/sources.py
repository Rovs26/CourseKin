import logging
import tempfile
from pathlib import Path
from uuid import uuid4

import requests as http_requests
from bs4 import BeautifulSoup
from fastapi import APIRouter, HTTPException, Depends, Request
from sqlalchemy.orm import Session

from app.core.auth import CurrentUser, get_current_user, require_owner
from app.core.rate_limit import limiter
from app.core.utils import utc_now_iso
from app.db.database import get_db
from app.db.models import Project, Source
from app.schemas.source import (
    PresignUploadRequest,
    FinalizeUploadRequest,
    SourceTextCreate,
    SourceUrlCreate,
    SourceResponse,
    SourceListResponse,
)
from app.core.security import validate_url_safe
from app.services import storage_service
from app.services.pdf_service import extract_pdf_text

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Sources"])

MAX_PDF_BYTES = 25 * 1024 * 1024   # 25 MB — matches R2 presign cap
MAX_TEXT_SIZE = 500 * 1024          # 500 KB
MAX_URL_RESPONSE_SIZE = 5 * 1024 * 1024  # 5 MB
MIN_TEXT_CHARS = 500
MAX_TEXT_CHARS = 50_000


def _source_to_dict(source: Source):
    return {
        "id": source.id,
        "project_id": source.project_id,
        "title": source.title,
        "type": source.type,
        "status": source.status,
        "created_at": source.created_at,
        "updated_at": source.updated_at,
    }


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
        created_at=now,
        updated_at=now,
    )
    db.add(source)
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

    # SSRF protection: block internal/private IPs
    validate_url_safe(url_str)

    try:
        resp = http_requests.get(
            url_str,
            timeout=15,
            headers={"User-Agent": "Mozilla/5.0"},
            stream=True,
        )
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
        raise HTTPException(status_code=400, detail=f"Failed to fetch URL: {str(e)}")

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
        created_at=now,
        updated_at=now,
    )
    db.add(source)
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
    The storage_key is validated to start with uploads/<user_id>/ to prevent
    cross-user key injection.
    """
    project = db.get(Project, payload.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    require_owner(current_user, project.user_id)

    # Security: verify the key is scoped to this user — prevents one user from
    # finalizing another user's upload key.
    expected_prefix = f"uploads/{current_user.user_id}/"
    if not payload.storage_key.startswith(expected_prefix):
        raise HTTPException(status_code=403, detail="Access denied")

    # Download bytes from R2
    pdf_bytes = storage_service.download_to_bytes(payload.storage_key)

    # Size guard (belt-and-suspenders; R2 ContentLength constraint on presign does this too)
    if len(pdf_bytes) > MAX_PDF_BYTES:
        storage_service.delete_object(payload.storage_key)
        raise HTTPException(status_code=400, detail="PDF is too large (max 25 MB)")

    # Extract text via temp file (extract_pdf_text works on file paths)
    extracted_text = ""
    try:
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            tmp.write(pdf_bytes)
            tmp_path = tmp.name

        extracted_text = extract_pdf_text(tmp_path)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"PDF text extraction failed: {str(e)}")
    finally:
        try:
            Path(tmp_path).unlink(missing_ok=True)
        except Exception:
            pass

    if not extracted_text.strip():
        raise HTTPException(status_code=400, detail="PDF extraction failed: no readable text found")

    if len(extracted_text) < MIN_TEXT_CHARS:
        raise HTTPException(
            status_code=400,
            detail=f"PDF has too little text (found {len(extracted_text)} chars, need at least {MIN_TEXT_CHARS})"
        )

    # Truncate to MAX_TEXT_CHARS — matches the OpenAI generation limit
    if len(extracted_text) > MAX_TEXT_CHARS:
        extracted_text = extracted_text[:MAX_TEXT_CHARS]

    now = utc_now_iso()
    source = Source(
        id=str(uuid4()),
        project_id=payload.project_id,
        title=payload.title,
        type="pdf",
        status="processed",
        storage_key=payload.storage_key,
        text=extracted_text,
        created_at=now,
        updated_at=now,
    )
    db.add(source)
    db.commit()
    db.refresh(source)
    return _source_to_dict(source)


# ── List / get / delete ───────────────────────────────────────────────────────

@router.get("/projects/{project_id}/sources", response_model=SourceListResponse)
def list_project_sources(
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
def get_source(
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


@router.delete("/sources/{source_id}")
def delete_source(
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
        storage_service.delete_object(source.storage_key)

    # Clean up legacy local file if present (pre-R2 rows)
    if source.file_path:
        path = Path(source.file_path)
        if path.exists():
            path.unlink()

    db.delete(source)
    db.commit()
    return {"message": "Source deleted successfully"}
