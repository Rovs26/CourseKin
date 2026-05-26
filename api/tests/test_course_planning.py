from collections import defaultdict
from datetime import date
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.api.routes import planning
from app.core.auth import CurrentUser
from app.core.utils import utc_now_iso
from app.db.database import Base
from app.db.models import CourseObligation, PreparationMilestone, Project, Source
from app.schemas.planning import (
    BuildPreparationPlanRequest,
    CourseObligationReviewRequest,
    PreparationMilestoneUpdateRequest,
    SyllabusExtractionRequest,
)
from app.services.planning_service import _normalize_obligations
from app.services.preparation_service import rebuild_preparation_plan


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
            course_code="CHEM 101",
            term="First Semester 2026-2027",
            user_id="user-1",
            created_at=now,
            updated_at=now,
        )
    )
    db.add(
        Source(
            id="syllabus-1",
            project_id="course-1",
            title="Syllabus",
            type="text",
            purpose="syllabus",
            status="processed",
            text="Quiz 1 is due on 2026-08-17.",
            created_at=now,
            updated_at=now,
        )
    )
    db.commit()
    return now


def test_syllabus_extraction_normalizes_uncertain_dates():
    obligations = _normalize_obligations(
        {
            "obligations": [
                {
                    "title": "First Quiz",
                    "obligation_type": "quiz",
                    "due_date": "August sometime",
                    "details": None,
                    "grading_criteria": None,
                    "confidence": "medium",
                    "uncertain_fields": [],
                }
            ]
        }
    )

    assert obligations[0]["due_date"] is None
    assert obligations[0]["uncertain_fields"] == ["due_date"]
    assert obligations[0]["details"] is None
    assert obligations[0]["grading_criteria"] is None


def test_only_syllabus_sources_can_start_extraction(db):
    now = _seed_course(db)
    material = Source(
        id="notes-1",
        project_id="course-1",
        title="Notes",
        type="text",
        purpose="study_material",
        status="processed",
        text="Lecture notes",
        created_at=now,
        updated_at=now,
    )
    db.add(material)
    db.commit()

    with pytest.raises(HTTPException, match="Mark this source as a syllabus"):
        planning.extract_syllabus_obligations.__wrapped__(
            MagicMock(),
            "course-1",
            SyllabusExtractionRequest(source_id="notes-1"),
            db,
            CurrentUser("user-1", "student@example.com", None, True),
        )


def test_confirmed_items_only_are_exported_to_calendar(db):
    now = _seed_course(db)
    proposed = CourseObligation(
        id="obligation-1",
        project_id="course-1",
        source_id="syllabus-1",
        title="Quiz 1",
        obligation_type="quiz",
        due_date="2026-08-17",
        details="Chapters 1 and 2",
        grading_criteria=None,
        confidence="high",
        uncertain_fields=[],
        status="proposed",
        created_at=now,
        updated_at=now,
    )
    unreviewed = CourseObligation(
        id="obligation-2",
        project_id="course-1",
        source_id="syllabus-1",
        title="Unconfirmed Exam",
        obligation_type="exam",
        due_date="2026-09-01",
        details=None,
        grading_criteria=None,
        confidence="medium",
        uncertain_fields=[],
        status="proposed",
        created_at=now,
        updated_at=now,
    )
    db.add_all([proposed, unreviewed])
    db.commit()
    user = CurrentUser("user-1", "student@example.com", None, True)

    planning.review_course_obligation(
        "course-1",
        "obligation-1",
        CourseObligationReviewRequest(
            title="Quiz 1",
            obligation_type="quiz",
            due_date="2026-08-18",
            details="Verified chapters 1 and 2",
            status="confirmed",
        ),
        db,
        user,
    )
    response = planning.export_confirmed_obligations_calendar("course-1", db, user)
    calendar = response.body.decode()

    assert "DTSTART;VALUE=DATE:20260818" in calendar
    assert "Organic Chemistry I - Quiz 1" in calendar
    assert "Unconfirmed Exam" not in calendar


def test_preparation_plan_balances_sessions_and_preserves_completed_work(db):
    now = _seed_course(db)
    obligations = [
        CourseObligation(
            id=f"quiz-{index}",
            project_id="course-1",
            source_id="syllabus-1",
            title=f"Quiz {index}",
            obligation_type="quiz",
            due_date="2026-08-10",
            details=None,
            grading_criteria=None,
            confidence="high",
            uncertain_fields=[],
            status="confirmed",
            created_at=now,
            updated_at=now,
        )
        for index in (1, 2)
    ]
    db.add_all(obligations)
    db.commit()

    milestones = rebuild_preparation_plan(
        db,
        "course-1",
        obligations,
        daily_capacity_minutes=60,
        today=date(2026, 8, 1),
    )
    totals: dict[str, int] = defaultdict(int)
    for item in milestones:
        totals[item.scheduled_date] += item.estimated_minutes

    assert len(milestones) == 8
    assert max(totals.values()) <= 60
    assert all(item.scheduled_date < "2026-08-10" for item in milestones)

    completed = milestones[0]
    completed.status = "completed"
    completed.completed_at = now
    db.commit()
    rebuild_preparation_plan(
        db,
        "course-1",
        obligations,
        daily_capacity_minutes=60,
        today=date(2026, 8, 2),
    )

    preserved = db.get(PreparationMilestone, completed.id)
    assert preserved is not None
    assert preserved.status == "completed"


def test_runway_reports_progress_after_student_completes_a_session(db):
    now = _seed_course(db)
    db.add(
        CourseObligation(
            id="confirmed-quiz",
            project_id="course-1",
            source_id="syllabus-1",
            title="Quiz 1",
            obligation_type="quiz",
            due_date="2099-08-17",
            details=None,
            grading_criteria=None,
            confidence="high",
            uncertain_fields=[],
            status="confirmed",
            created_at=now,
            updated_at=now,
        )
    )
    db.commit()
    user = CurrentUser("user-1", "student@example.com", None, True)

    runway = planning.build_preparation_runway(
        "course-1",
        BuildPreparationPlanRequest(daily_capacity_minutes=120),
        db,
        user,
    )
    assert runway["total_sessions"] == 4
    assert runway["items"][0]["missing_materials"]

    milestone_id = runway["items"][0]["milestones"][0]["id"]
    planning.update_preparation_milestone(
        "course-1",
        milestone_id,
        PreparationMilestoneUpdateRequest(status="completed"),
        db,
        user,
    )
    refreshed = planning.get_preparation_runway("course-1", 120, "2099-08-01", db, user)

    assert refreshed["completed_sessions"] == 1
    assert refreshed["preparation_progress_percent"] == 25
