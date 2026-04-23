"""Content validation for uploaded PDFs."""

from io import BytesIO

import magic
from fastapi import HTTPException
from pypdf import PdfReader

MIN_EXTRACTED_CHARS = 500
MAX_EXTRACTED_CHARS = 50_000  # matches settings.MAX_EXTRACTED_CHARS
MAX_PDF_PAGES = 100


def validate_pdf_bytes(data: bytes) -> None:
    """MIME check — trust this over the client-provided content type."""
    mime = magic.from_buffer(data[:4096], mime=True)
    if mime != "application/pdf":
        raise HTTPException(400, f"File is not a PDF (detected {mime})")


def validate_pdf_structure(data: bytes) -> int:
    """Parse the PDF header and return the page count.

    Raises 400 on corrupt PDF or if over MAX_PDF_PAGES.
    """
    try:
        reader = PdfReader(BytesIO(data))
        pages = len(reader.pages)
    except Exception:
        raise HTTPException(400, "PDF is corrupted or unreadable")

    if pages > MAX_PDF_PAGES:
        raise HTTPException(
            400,
            f"PDF has too many pages ({pages}); max is {MAX_PDF_PAGES}",
        )
    return pages


def validate_extracted_text(text: str) -> None:
    """Raise 400 if the extracted text is too short to be useful.

    Truncation for overly-long text is handled upstream via settings.MAX_EXTRACTED_CHARS;
    this function only rejects PDFs that produced almost nothing.
    """
    stripped = text.strip()
    if len(stripped) < MIN_EXTRACTED_CHARS:
        raise HTTPException(
            400,
            f"PDF text is too short to study from (found {len(stripped)} characters, need at least {MIN_EXTRACTED_CHARS})",
        )
