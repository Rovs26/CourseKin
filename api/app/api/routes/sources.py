import logging
from pathlib import Path
from uuid import uuid4

import requests as http_requests
from bs4 import BeautifulSoup
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends, Request
from sqlalchemy.orm import Session

from app.core.rate_limit import limiter
from app.core.utils import utc_now_iso
from app.db.database import get_db
from app.db.models import Project, Source
from app.schemas.source import (
    SourceTextCreate,
    SourceUrlCreate,
    SourceResponse,
    SourceListResponse,
)
from app.core.security import validate_url_safe
from app.services.pdf_service import extract_pdf_text

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Sources"])

UPLOAD_DIR = Path("/app/uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

MAX_PDF_SIZE = 20 * 1024 * 1024  # 20 MB
MAX_TEXT_SIZE = 500 * 1024  # 500 KB
MAX_URL_RESPONSE_SIZE = 5 * 1024 * 1024  # 5 MB


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


@router.post("/sources/text", response_model=SourceResponse)
def create_text_source(payload: SourceTextCreate, db: Session = Depends(get_db)):
    project = db.get(Project, payload.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

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


@router.post("/sources/url", response_model=SourceResponse)
@limiter.limit("10/minute")
def create_url_source(request: Request, payload: SourceUrlCreate, db: Session = Depends(get_db)):
    project = db.get(Project, payload.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

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


@router.post("/sources/upload", response_model=SourceResponse)
@limiter.limit("5/minute")
async def create_upload_source(
    request: Request,
    project_id: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    source_id = str(uuid4())
    now = utc_now_iso()

    safe_name = file.filename or f"{source_id}.pdf"
    is_pdf = safe_name.lower().endswith(".pdf")

    if not is_pdf:
        raise HTTPException(status_code=400, detail="Only PDF upload is supported for now")

    file_path = UPLOAD_DIR / f"{source_id}_{safe_name}"

    content = await file.read()
    if len(content) > MAX_PDF_SIZE:
        raise HTTPException(status_code=400, detail="PDF is too large (max 20 MB)")
    file_path.write_bytes(content)

    try:
        extracted_text = extract_pdf_text(str(file_path))
    except Exception as e:
        if file_path.exists():
            file_path.unlink()
        raise HTTPException(status_code=400, detail=f"PDF extraction failed: {str(e)}")

    if not extracted_text.strip():
        if file_path.exists():
            file_path.unlink()
        raise HTTPException(status_code=400, detail="PDF extraction failed: extracted text is empty")

    source = Source(
        id=source_id,
        project_id=project_id,
        title=safe_name,
        type="pdf",
        status="processed",
        file_name=safe_name,
        file_path=str(file_path),
        text=extracted_text,
        created_at=now,
        updated_at=now,
    )
    db.add(source)
    db.commit()
    db.refresh(source)

    return _source_to_dict(source)


@router.get("/projects/{project_id}/sources", response_model=SourceListResponse)
def list_project_sources(project_id: str, db: Session = Depends(get_db)):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    items = db.query(Source).filter(Source.project_id == project_id).all()
    return {"items": [_source_to_dict(item) for item in items], "total": len(items)}


@router.get("/sources/item/{source_id}", response_model=SourceResponse)
def get_source(source_id: str, db: Session = Depends(get_db)):
    source = db.get(Source, source_id)
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    return _source_to_dict(source)


@router.delete("/sources/{source_id}")
def delete_source(source_id: str, db: Session = Depends(get_db)):
    source = db.get(Source, source_id)
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")

    file_path = source.file_path
    if file_path:
        path = Path(file_path)
        if path.exists():
            path.unlink()

    db.delete(source)
    db.commit()
    return {"message": "Source deleted successfully"}