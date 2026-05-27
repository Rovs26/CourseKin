from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.api.routes import reviewer as reviewer_routes
from app.core.auth import CurrentUser
from app.core.utils import utc_now_iso
from app.db.database import Base
from app.db.models import Project, QuizAttempt, Reviewer
from app.schemas.reviewer import QuizAttemptAnswerRequest, QuizAttemptRequest


@pytest.fixture()
def db():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    try:
        yield session
    finally:
        session.close()


def _seed_notebook(db):
    now = utc_now_iso()
    db.add(
        Project(
            id="course-1",
            title="Biology",
            project_type="school",
            age_bracket="college",
            learning_mode="deep",
            field_of_study="Life Science",
            source_mode="source-only",
            user_id="user-1",
            created_at=now,
            updated_at=now,
        )
    )
    db.add(
        Reviewer(
            project_id="course-1",
            status="ready",
            output_type="full-reviewer",
            version=3,
            content_json={
                "quiz": [
                    {
                        "topic": "Cell membrane transport",
                        "question": "What controls movement across a cell boundary?",
                        "choices": ["Cell membrane", "Nucleus"],
                        "answer": "Cell membrane",
                        "rationale": "The membrane regulates movement into and out of the cell.",
                    },
                    {
                        "topic": "Cell structure",
                        "question": "Where is DNA generally stored?",
                        "choices": ["Ribosome", "Nucleus"],
                        "answer": "Nucleus",
                        "rationale": "The nucleus contains genetic material.",
                    },
                ],
                "_evidence": {
                    "quiz": [
                        {"status": "supported", "citations": []},
                        {"status": "supported", "citations": []},
                    ]
                },
            },
            created_at=now,
            updated_at=now,
        )
    )
    db.commit()


def test_quiz_attempt_is_scored_by_current_notebook_and_exposes_focus_question(db):
    _seed_notebook(db)
    user = CurrentUser("user-1", "student@example.com", None, True)
    attempt = reviewer_routes.record_quiz_attempt.__wrapped__(
        MagicMock(),
        "course-1",
        QuizAttemptRequest(
            reviewer_version=3,
            duration_seconds=42,
            answers=[
                QuizAttemptAnswerRequest(item_index=0, selected_answer="Nucleus"),
                QuizAttemptAnswerRequest(item_index=1, selected_answer="Nucleus"),
            ],
        ),
        db,
        user,
    )

    assert attempt["correct_answers"] == 1
    assert attempt["score_percent"] == 50
    assert attempt["results"][0]["is_correct"] is False
    assert attempt["results"][0]["topic"] == "Cell membrane transport"
    assert db.query(QuizAttempt).count() == 1

    summary = reviewer_routes.get_quiz_practice_summary("course-1", db, user)
    assert summary["total_attempts"] == 1
    assert summary["practice_signal"] == "early"
    assert summary["focus_topics"][0]["topic"] == "Cell membrane transport"
    assert summary["focus_topics"][0]["status"] == "needs_review"
    assert summary["focus_questions"][0]["question"].startswith("What controls")


def test_quiz_attempt_rejects_stale_or_incomplete_notebook_answers(db):
    _seed_notebook(db)
    user = CurrentUser("user-1", "student@example.com", None, True)

    with pytest.raises(HTTPException, match="notebook changed"):
        reviewer_routes.record_quiz_attempt.__wrapped__(
            MagicMock(),
            "course-1",
            QuizAttemptRequest(
                reviewer_version=2,
                answers=[QuizAttemptAnswerRequest(item_index=0, selected_answer="Cell membrane")],
            ),
            db,
            user,
        )

    with pytest.raises(HTTPException, match="Answer every quiz question"):
        reviewer_routes.record_quiz_attempt.__wrapped__(
            MagicMock(),
            "course-1",
            QuizAttemptRequest(
                reviewer_version=3,
                answers=[QuizAttemptAnswerRequest(item_index=0, selected_answer="Cell membrane")],
            ),
            db,
            user,
        )


def test_older_notebook_quiz_attempts_are_kept_without_topic_claims(db):
    _seed_notebook(db)
    reviewer = db.get(Reviewer, "course-1")
    reviewer.content_json = {
        **reviewer.content_json,
        "quiz": [
            {key: value for key, value in item.items() if key != "topic"}
            for item in reviewer.content_json["quiz"]
        ],
    }
    db.commit()
    user = CurrentUser("user-1", "student@example.com", None, True)

    attempt = reviewer_routes.record_quiz_attempt.__wrapped__(
        MagicMock(),
        "course-1",
        QuizAttemptRequest(
            reviewer_version=3,
            answers=[
                QuizAttemptAnswerRequest(item_index=0, selected_answer="Cell membrane"),
                QuizAttemptAnswerRequest(item_index=1, selected_answer="Nucleus"),
            ],
        ),
        db,
        user,
    )
    summary = reviewer_routes.get_quiz_practice_summary("course-1", db, user)

    assert attempt["results"][0]["topic"] is None
    assert summary["focus_topics"] == []
