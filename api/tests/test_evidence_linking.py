from unittest.mock import MagicMock

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.api.routes import reviewer as reviewer_routes
from app.core.auth import CurrentUser
from app.core.utils import utc_now_iso
from app.db.database import Base
from app.db.models import Project, Reviewer, ReviewerFeedback, Source
from app.schemas.reviewer import ReviewerFeedbackRequest
from app.services.generation_service import _merge_content, _normalize_evidence
from app.services.pdf_export_service import generate_reviewer_pdf
from app.services.source_chunk_service import index_source_chunks, serialize_chunks


def _db():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine)()


def _source() -> Source:
    return Source(
        id="source-1",
        project_id="project-1",
        title="Week 1 Lecture",
        type="pdf",
        status="processed",
        text="Cell membranes control movement across the cell boundary.",
        created_at=utc_now_iso(),
        updated_at=utc_now_iso(),
    )


def test_source_chunks_keep_stable_ids_and_pdf_page_numbers():
    db = _db()
    try:
        source = _source()
        db.add(source)
        db.flush()

        chunks = index_source_chunks(
            db,
            source,
            page_texts=[(2, "Cell membranes control movement."), (3, "Diffusion is passive.")],
        )
        db.flush()

        assert [chunk.id for chunk in chunks] == [
            "source-1:chunk-0001",
            "source-1:chunk-0002",
        ]
        assert [chunk.page_number for chunk in chunks] == [2, 3]
    finally:
        db.close()


def test_generated_evidence_resolves_only_indexed_source_chunks():
    db = _db()
    try:
        source = _source()
        db.add(source)
        db.flush()
        chunks = index_source_chunks(
            db,
            source,
            page_texts=[(4, "Cell membranes regulate movement across a cell boundary.")],
        )
        prompt_chunks = serialize_chunks(chunks)
        content = {
            "summary": "Cell membranes regulate movement.",
            "key_points": ["Membranes regulate movement.", "Unsupported point."],
            "_evidence": {
                "summary": ["source-1:chunk-0001"],
                "key_points": [["source-1:chunk-0001"], ["made-up-chunk"]],
            },
        }

        normalized = _normalize_evidence(
            content,
            ["summary", "key_points"],
            source.id,
            source.title,
            prompt_chunks,
        )

        summary_citation = normalized["_evidence"]["summary"]["citations"][0]
        assert summary_citation["source_title"] == "Week 1 Lecture"
        assert summary_citation["page_number"] == 4
        assert "Cell membranes regulate movement" in summary_citation["excerpt"]
        assert normalized["_evidence"]["key_points"][0]["status"] == "supported"
        assert normalized["_evidence"]["key_points"][1] == {
            "status": "not_found",
            "citations": [],
        }
    finally:
        db.close()


def test_append_merge_keeps_item_evidence_aligned():
    existing = {
        "key_points": ["First"],
        "_evidence": {"key_points": [{"status": "supported", "citations": [{"chunk_id": "one"}]}]},
        "_meta": {"sources": {"key_points": ["source-1"]}},
    }
    new = {
        "key_points": ["Second"],
        "_evidence": {"key_points": [{"status": "supported", "citations": [{"chunk_id": "two"}]}]},
    }

    merged = _merge_content(existing, new, ["key_points"], "source-2", "append")

    assert merged["key_points"] == ["First", "Second"]
    assert [item["citations"][0]["chunk_id"] for item in merged["_evidence"]["key_points"]] == [
        "one",
        "two",
    ]


def test_pdf_generation_accepts_cited_content():
    pdf = generate_reviewer_pdf(
        project_title="Biology",
        field_of_study="Life Science",
        version=1,
        content={
            "summary": "Cell membranes regulate movement.",
            "_evidence": {
                "summary": {
                    "status": "supported",
                    "citations": [
                        {
                            "source_title": "Week 1 Lecture",
                            "page_number": 4,
                            "excerpt": "Cell membranes regulate movement.",
                        }
                    ],
                }
            },
        },
    )

    assert pdf.startswith(b"%PDF")


def test_reviewer_feedback_is_versioned_and_updates_same_item():
    db = _db()
    try:
        now = utc_now_iso()
        db.add(
            Project(
                id="project-1",
                title="Biology",
                project_type="study",
                age_bracket="adult",
                learning_mode="standard",
                field_of_study="Life Science",
                source_mode="text",
                user_id="user-1",
                created_at=now,
                updated_at=now,
            )
        )
        db.add(
            Reviewer(
                project_id="project-1",
                status="ready",
                output_type="full-reviewer",
                version=2,
                content_json={"key_points": ["First point"]},
                created_at=now,
                updated_at=now,
            )
        )
        db.commit()
        user = CurrentUser("user-1", "student@example.com", None, True)

        first = reviewer_routes.record_reviewer_feedback.__wrapped__(
            MagicMock(),
            "project-1",
            ReviewerFeedbackRequest(section="key_points", item_index=0, rating="accurate"),
            db,
            user,
        )
        second = reviewer_routes.record_reviewer_feedback.__wrapped__(
            MagicMock(),
            "project-1",
            ReviewerFeedbackRequest(section="key_points", item_index=0, rating="unclear"),
            db,
            user,
        )

        assert first["reviewer_version"] == 2
        assert second["rating"] == "unclear"
        assert db.query(ReviewerFeedback).count() == 1
    finally:
        db.close()
