from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.api.routes import sources, stream
from app.core.auth import CurrentUser
from app.core.utils import utc_now_iso
from app.db.database import Base
from app.db.models import (
    CourseObligation,
    CourseStreamEntry,
    CourseStreamEntrySource,
    Job,
    Project,
    Source,
)
from app.schemas.stream import (
    CourseAnswerRequest,
    CourseCoachingRequest,
    CourseConfusionStatusUpdate,
    CourseStreamEntryWriteRequest,
)
from app.services import course_answer_service, course_coaching_service
from app.services.course_answer_service import normalize_grounded_answer
from app.services.course_coaching_service import normalize_grounded_coaching


@pytest.fixture()
def db():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    try:
        yield session
    finally:
        session.close()


def _seed_course(db):
    now = utc_now_iso()
    db.add(
        Project(
            id="course-1",
            title="Organic Chemistry I",
            project_type="school",
            age_bracket="college",
            learning_mode="deep",
            field_of_study="Chemistry",
            source_mode="source-only",
            user_id="user-1",
            created_at=now,
            updated_at=now,
        )
    )
    db.commit()


def _seed_source(db, source_id="source-1", project_id="course-1"):
    now = utc_now_iso()
    db.add(
        Source(
            id=source_id,
            project_id=project_id,
            title="Lecture Week 1",
            type="pdf",
            status="processed",
            purpose="lecture_notes",
            text="Strong acids dissociate completely in aqueous solution.",
            created_at=now,
            updated_at=now,
        )
    )
    db.commit()


def _seed_confirmed_assignment(db, grading_criteria="Use two supported examples."):
    now = utc_now_iso()
    db.add(
        CourseObligation(
            id="assignment-1",
            project_id="course-1",
            source_id="source-1",
            title="Acid Strength Reflection",
            obligation_type="assignment",
            due_date="2026-06-05",
            details="Explain acid strength in 500 words.",
            grading_criteria=grading_criteria,
            confidence="high",
            uncertain_fields=[],
            status="confirmed",
            created_at=now,
            updated_at=now,
        )
    )
    db.commit()


def test_student_can_create_edit_and_delete_private_stream_entries(db):
    _seed_course(db)
    user = CurrentUser("user-1", "student@example.com", None, True)

    created = stream.create_course_stream_entry.__wrapped__(
        MagicMock(),
        "course-1",
        CourseStreamEntryWriteRequest(entry_type="note", content="  Acids donate protons.  "),
        db,
        user,
    )

    assert created["entry_type"] == "note"
    assert created["content"] == "Acids donate protons."

    listing = stream.list_course_stream_entries("course-1", 100, 0, db, user)
    assert listing["total"] == 1
    assert listing["items"][0]["id"] == created["id"]

    updated = stream.update_course_stream_entry.__wrapped__(
        MagicMock(),
        "course-1",
        created["id"],
        CourseStreamEntryWriteRequest(entry_type="question", content="Why are strong acids complete?"),
        db,
        user,
    )
    assert updated["entry_type"] == "question"

    stream.delete_course_stream_entry.__wrapped__(
        MagicMock(), "course-1", created["id"], db, user
    )
    assert stream.list_course_stream_entries("course-1", 100, 0, db, user)["total"] == 0


def test_reflection_entries_link_only_materials_from_same_course(db):
    _seed_course(db)
    _seed_source(db)
    _seed_source(db, source_id="outside-source", project_id="course-2")
    user = CurrentUser("user-1", "student@example.com", None, True)

    created = stream.create_course_stream_entry.__wrapped__(
        MagicMock(),
        "course-1",
        CourseStreamEntryWriteRequest(
            entry_type="reflection",
            content="I can describe proton donation, but equilibrium is still unclear.",
            linked_source_ids=["source-1"],
        ),
        db,
        user,
    )

    assert created["entry_type"] == "reflection"
    assert created["linked_sources"][0]["id"] == "source-1"
    assert created["linked_sources"][0]["purpose"] == "lecture_notes"
    assert db.query(CourseStreamEntrySource).count() == 1

    with pytest.raises(HTTPException) as exc_info:
        stream.update_course_stream_entry.__wrapped__(
            MagicMock(),
            "course-1",
            created["id"],
            CourseStreamEntryWriteRequest(
                entry_type="reflection",
                content="Should not be saved.",
                linked_source_ids=["outside-source"],
            ),
            db,
            user,
        )
    assert exc_info.value.status_code == 400

    stream.delete_course_stream_entry.__wrapped__(
        MagicMock(), "course-1", created["id"], db, user
    )
    assert db.query(CourseStreamEntrySource).count() == 0


def test_question_enters_confusion_inbox_and_queues_course_only_answer(db):
    _seed_course(db)
    _seed_source(db)
    user = CurrentUser("user-1", "student@example.com", None, True)
    question = stream.create_course_stream_entry.__wrapped__(
        MagicMock(),
        "course-1",
        CourseStreamEntryWriteRequest(
            entry_type="question",
            content="Why are strong acids complete?",
            linked_source_ids=["source-1"],
        ),
        db,
        user,
    )

    assert question["confusion_status"] == "open"
    job = stream.request_course_answer.__wrapped__(
        MagicMock(),
        "course-1",
        question["id"],
        CourseAnswerRequest(explanation_mode="simplified"),
        db,
        user,
    )
    saved = db.get(CourseStreamEntry, question["id"])

    assert job["job_type"] == "answer-course-question"
    assert saved.answer_status == "queued"
    assert saved.answer_mode == "simplified"
    assert db.get(Job, job["id"]).generation_options["source_ids"] == ["source-1"]
    assert db.get(Job, job["id"]).generation_options["explanation_mode"] == "simplified"

    resolved = stream.update_course_confusion_status(
        "course-1",
        question["id"],
        CourseConfusionStatusUpdate(status="resolved"),
        db,
        user,
    )
    assert resolved["confusion_status"] == "resolved"


def test_editing_answered_question_invalidates_stale_answer(db):
    _seed_course(db)
    _seed_source(db)
    user = CurrentUser("user-1", "student@example.com", None, True)
    question = stream.create_course_stream_entry.__wrapped__(
        MagicMock(),
        "course-1",
        CourseStreamEntryWriteRequest(
            entry_type="question",
            content="Original question",
            linked_source_ids=["source-1"],
        ),
        db,
        user,
    )
    item = db.get(CourseStreamEntry, question["id"])
    item.answer_status = "answered"
    item.answer_content = "Old answer"
    item.answer_evidence = {"status": "supported", "citations": []}
    item.answer_job_id = "old-job"
    db.commit()

    updated = stream.update_course_stream_entry.__wrapped__(
        MagicMock(),
        "course-1",
        question["id"],
        CourseStreamEntryWriteRequest(
            entry_type="question",
            content="Updated question",
            linked_source_ids=["source-1"],
        ),
        db,
        user,
    )

    assert updated["answer_status"] is None
    assert updated["answer_content"] is None
    assert updated["answer_job_id"] is None


def test_course_answer_requires_valid_course_citation():
    chunks = [
        {
            "id": "source-1:chunk-0001",
            "source_id": "source-1",
            "source_title": "Lecture Week 1",
            "page_number": 3,
            "text": "Strong acids dissociate completely in aqueous solution.",
        }
    ]
    unsupported = normalize_grounded_answer(
        {"answer": "This cannot be shown.", "citations": ["made-up"]},
        chunks,
    )
    supported = normalize_grounded_answer(
        {"answer": "Strong acids dissociate completely.", "citations": ["source-1:chunk-0001"]},
        chunks,
    )

    assert unsupported["answer_status"] == "insufficient_evidence"
    assert unsupported["answer_content"] is None
    assert supported["answer_status"] == "answered"
    assert supported["answer_evidence"]["citations"][0]["page_number"] == 3


def test_course_answer_worker_persists_grounded_answer(monkeypatch, db):
    _seed_course(db)
    _seed_source(db)
    user = CurrentUser("user-1", "student@example.com", None, True)
    question = stream.create_course_stream_entry.__wrapped__(
        MagicMock(),
        "course-1",
        CourseStreamEntryWriteRequest(
            entry_type="question",
            content="What does a strong acid do?",
            linked_source_ids=["source-1"],
        ),
        db,
        user,
    )
    job = stream.request_course_answer.__wrapped__(
        MagicMock(), "course-1", question["id"], CourseAnswerRequest(), db, user
    )
    session_factory = sessionmaker(bind=db.bind)
    monkeypatch.setattr(course_answer_service, "SessionLocal", session_factory)
    monkeypatch.setattr(
        course_answer_service,
        "_call_openai",
        lambda *args: (
            {
                "answer": "A strong acid dissociates completely in aqueous solution.",
                "citations": ["source-1:chunk-0001"],
            },
            {
                "model": "gpt-4.1-nano",
                "prompt_tokens": 10,
                "completion_tokens": 10,
                "cost_usd": 0.00001,
            },
        ),
    )

    course_answer_service.run_course_answer_in_background(
        job_id=job["id"],
        project_id="course-1",
        entry_id=question["id"],
        source_chunks=[
            {
                "id": "source-1:chunk-0001",
                "source_id": "source-1",
                "source_title": "Lecture Week 1",
                "page_number": None,
                "text": "Strong acids dissociate completely in aqueous solution.",
            }
        ],
        user_id="user-1",
    )
    db.expire_all()
    stored = db.get(CourseStreamEntry, question["id"])
    completed_job = db.get(Job, job["id"])
    assert stored.answer_status == "answered"
    assert stored.answer_evidence["source_scope"] == "course_materials_only"
    assert completed_job.status == "completed"


def test_assignment_coaching_requires_confirmed_rubric_and_queues_grounded_request(db):
    _seed_course(db)
    _seed_source(db)
    _seed_confirmed_assignment(db)
    user = CurrentUser("user-1", "student@example.com", None, True)

    result = stream.request_coursework_coaching.__wrapped__(
        MagicMock(),
        "course-1",
        CourseCoachingRequest(
            coaching_mode="assignment_plan",
            content="Help me plan the steps before I start drafting.",
            obligation_id="assignment-1",
            linked_source_ids=["source-1"],
        ),
        db,
        user,
    )
    job = db.get(Job, result["coaching_job_id"])

    assert result["entry_type"] == "coaching"
    assert result["coaching_status"] == "queued"
    assert result["coaching_context"]["obligation"]["grading_criteria"] == "Use two supported examples."
    assert job.job_type == "coach-coursework"
    assert job.generation_options["source_ids"] == ["source-1"]


def test_assignment_coaching_rejects_task_without_rubric_evidence(db):
    _seed_course(db)
    _seed_source(db)
    _seed_confirmed_assignment(db, grading_criteria=None)
    user = CurrentUser("user-1", "student@example.com", None, True)

    with pytest.raises(HTTPException) as exc_info:
        stream.request_coursework_coaching.__wrapped__(
            MagicMock(),
            "course-1",
            CourseCoachingRequest(
                coaching_mode="draft_feedback",
                content="Where does this short draft miss the task?",
                obligation_id="assignment-1",
                linked_source_ids=["source-1"],
            ),
            db,
            user,
        )

    assert exc_info.value.status_code == 400
    assert "grading criteria" in exc_info.value.detail


def test_course_coaching_worker_persists_only_cited_guidance(monkeypatch, db):
    _seed_course(db)
    _seed_source(db)
    _seed_confirmed_assignment(db)
    user = CurrentUser("user-1", "student@example.com", None, True)
    entry = stream.request_coursework_coaching.__wrapped__(
        MagicMock(),
        "course-1",
        CourseCoachingRequest(
            coaching_mode="assignment_plan",
            content="Build a checklist for this assignment.",
            obligation_id="assignment-1",
            linked_source_ids=["source-1"],
        ),
        db,
        user,
    )
    session_factory = sessionmaker(bind=db.bind)
    monkeypatch.setattr(course_coaching_service, "SessionLocal", session_factory)
    monkeypatch.setattr(
        course_coaching_service,
        "_call_openai",
        lambda *args: (
            {
                "guidance": "Plan a clear explanation of acid strength.",
                "next_steps": ["Locate two examples from the lecture notes."],
                "rubric_checks": ["Use two supported examples."],
                "questions_for_instructor": [],
                "limitation_note": "Use this plan to write your own submission.",
                "citations": ["source-1:chunk-0001"],
            },
            {
                "model": "gpt-4.1-nano",
                "prompt_tokens": 10,
                "completion_tokens": 10,
                "cost_usd": 0.00001,
            },
        ),
    )

    course_coaching_service.run_course_coaching_in_background(
        job_id=entry["coaching_job_id"],
        project_id="course-1",
        entry_id=entry["id"],
        source_chunks=[
            {
                "id": "source-1:chunk-0001",
                "source_id": "source-1",
                "source_title": "Lecture Week 1",
                "page_number": None,
                "text": "Strong acids dissociate completely in aqueous solution.",
            }
        ],
        user_id="user-1",
    )
    db.expire_all()
    stored = db.get(CourseStreamEntry, entry["id"])

    assert stored.coaching_status == "ready"
    assert stored.coaching_output["next_steps"] == ["Locate two examples from the lecture notes."]
    assert stored.coaching_evidence["source_scope"] == "course_materials_only"


def test_course_coaching_requires_valid_course_citation():
    result = normalize_grounded_coaching(
        {"guidance": "Advice without evidence.", "citations": ["invented-id"]},
        [
            {
                "id": "source-1:chunk-0001",
                "source_id": "source-1",
                "source_title": "Lecture Week 1",
                "text": "Source text.",
            }
        ],
    )

    assert result["coaching_status"] == "insufficient_evidence"
    assert result["coaching_output"] is None


def test_deleting_linked_material_clears_derived_stream_answer(db):
    _seed_course(db)
    _seed_source(db)
    user = CurrentUser("user-1", "student@example.com", None, True)
    question = stream.create_course_stream_entry.__wrapped__(
        MagicMock(),
        "course-1",
        CourseStreamEntryWriteRequest(
            entry_type="question",
            content="What does a strong acid do?",
            linked_source_ids=["source-1"],
        ),
        db,
        user,
    )
    item = db.get(CourseStreamEntry, question["id"])
    item.answer_status = "answered"
    item.answer_mode = "standard"
    item.answer_content = "Derived text."
    item.answer_evidence = {"status": "supported", "citations": [{"excerpt": "Source text."}]}
    now = utc_now_iso()
    coaching = CourseStreamEntry(
        id="coaching-to-clear",
        project_id="course-1",
        user_id="user-1",
        entry_type="coaching",
        content="Help prepare my checklist.",
        coaching_mode="assignment_plan",
        coaching_status="ready",
        coaching_output={"guidance": "Derived guidance."},
        coaching_evidence={"status": "supported", "citations": [{"excerpt": "Source text."}]},
        coaching_job_id="old-coach-job",
        created_at=now,
        updated_at=now,
    )
    db.add(coaching)
    db.add(
        CourseStreamEntrySource(
            id="coach-link",
            entry_id=coaching.id,
            source_id="source-1",
            project_id="course-1",
            ordinal=0,
            created_at=now,
        )
    )
    db.commit()

    sources.delete_source.__wrapped__(MagicMock(), "source-1", db, user)
    db.refresh(item)
    db.refresh(coaching)

    assert item.answer_content is None
    assert item.answer_mode is None
    assert coaching.coaching_output is None
    assert coaching.coaching_evidence is None
    assert coaching.coaching_status is None
    assert item.answer_evidence is None
    assert db.query(CourseStreamEntrySource).count() == 0


def test_stream_entries_are_private_to_the_course_owner(db):
    _seed_course(db)

    with pytest.raises(HTTPException):
        stream.list_course_stream_entries(
            "course-1",
            100,
            0,
            db,
            CurrentUser("user-2", "other@example.com", None, True),
        )


def test_stream_entries_reject_empty_content():
    with pytest.raises(ValidationError):
        CourseStreamEntryWriteRequest(entry_type="note", content="   ")
