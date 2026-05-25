"""Index source text into stable evidence chunks for cited reviewer generation."""

from sqlalchemy.orm import Session

from app.core.utils import utc_now_iso
from app.db.models import Source, SourceChunk

CHUNK_SIZE = 1200
CHUNK_OVERLAP = 120


def _split_text(text: str) -> list[str]:
    normalized = text.strip()
    if not normalized:
        return []

    chunks: list[str] = []
    start = 0
    while start < len(normalized):
        end = min(start + CHUNK_SIZE, len(normalized))
        if end < len(normalized):
            paragraph_break = normalized.rfind("\n\n", start + CHUNK_SIZE // 2, end)
            sentence_break = normalized.rfind(". ", start + CHUNK_SIZE // 2, end)
            split_at = max(paragraph_break, sentence_break)
            if split_at > start:
                end = split_at + (1 if split_at == sentence_break else 0)

        chunk = normalized[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end >= len(normalized):
            break
        start = max(end - CHUNK_OVERLAP, start + 1)

    return chunks


def _chunk_id(source_id: str, ordinal: int) -> str:
    return f"{source_id}:chunk-{ordinal:04d}"


def index_source_chunks(
    db: Session,
    source: Source,
    page_texts: list[tuple[int | None, str]] | None = None,
) -> list[SourceChunk]:
    """Replace source chunks with deterministic IDs derived from source and order."""
    db.query(SourceChunk).filter(SourceChunk.source_id == source.id).delete()
    material = page_texts if page_texts is not None else [(None, source.text or "")]
    chunks: list[SourceChunk] = []
    ordinal = 1
    now = utc_now_iso()

    for page_number, text in material:
        for chunk_text in _split_text(text):
            chunk = SourceChunk(
                id=_chunk_id(source.id, ordinal),
                source_id=source.id,
                project_id=source.project_id,
                ordinal=ordinal,
                page_number=page_number,
                text=chunk_text,
                created_at=now,
            )
            db.add(chunk)
            chunks.append(chunk)
            ordinal += 1

    return chunks


def ensure_source_chunks(db: Session, source: Source) -> list[SourceChunk]:
    chunks = (
        db.query(SourceChunk)
        .filter(SourceChunk.source_id == source.id)
        .order_by(SourceChunk.ordinal.asc())
        .all()
    )
    if chunks:
        return chunks
    chunks = index_source_chunks(db, source)
    db.flush()
    return chunks


def serialize_chunks(chunks: list[SourceChunk]) -> list[dict]:
    return [
        {
            "id": chunk.id,
            "source_id": chunk.source_id,
            "page_number": chunk.page_number,
            "text": chunk.text,
        }
        for chunk in chunks
    ]
