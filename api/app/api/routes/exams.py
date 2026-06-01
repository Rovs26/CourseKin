"""Phase I — timed mock exam routes."""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.auth import CurrentUser, get_current_user, require_owner
from app.core.rate_limit import limiter
from app.core.utils import utc_now_iso
from app.db.database import get_db
from app.db.models import MockExamSession, Project
from app.schemas.exam import (
    MockExamCreateRequest,
    MockExamGradedResponse,
    MockExamListResponse,
    MockExamSelfGradeRequest,
    MockExamSessionResponse,
    MockExamSubmitRequest,
)
from app.services.mock_exam_service import (
    build_exam_session,
    grade_exam,
    self_grade_answer,
    session_to_graded_dict,
    session_to_in_progress_dict,
    session_to_summary_dict,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Exams"])


def _require_owned_project(
    db: Session, project_id: str, current_user: CurrentUser
) -> Project:
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    require_owner(current_user, project.user_id)
    return project


def _require_owned_session(
    db: Session, project_id: str, session_id: str, current_user: CurrentUser
) -> MockExamSession:
    _require_owned_project(db, project_id, current_user)
    session = db.get(MockExamSession, session_id)
    if (
        not session
        or session.project_id != project_id
        or session.user_id != current_user.user_id
    ):
        raise HTTPException(status_code=404, detail="Exam not found")
    return session


def _maybe_expire(db: Session, session: MockExamSession) -> None:
    if session.status != "in_progress":
        return
    try:
        deadline = datetime.fromisoformat(session.deadline_at.replace("Z", "+00:00"))
    except ValueError:
        return
    if datetime.now(timezone.utc) > deadline:
        session.status = "expired"
        session.updated_at = utc_now_iso()
        db.commit()
        db.refresh(session)


@router.post(
    "/projects/{project_id}/exams",
    response_model=MockExamSessionResponse,
)
@limiter.limit("20/hour")
def create_mock_exam(
    request: Request,
    project_id: str,
    payload: MockExamCreateRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    _require_owned_project(db, project_id, current_user)
    try:
        session = build_exam_session(
            db,
            project_id=project_id,
            user_id=current_user.user_id,
            obligation_id=payload.obligation_id,
            title=payload.title,
            difficulty=payload.difficulty,
            target_minutes=payload.target_minutes,
            question_count=payload.question_count,
            confidence_before=payload.confidence_before,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return session_to_in_progress_dict(session)


@router.get(
    "/projects/{project_id}/exams",
    response_model=MockExamListResponse,
)
def list_mock_exams(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    _require_owned_project(db, project_id, current_user)
    rows = (
        db.query(MockExamSession)
        .filter(
            MockExamSession.project_id == project_id,
            MockExamSession.user_id == current_user.user_id,
        )
        .order_by(MockExamSession.created_at.desc())
        .limit(50)
        .all()
    )
    return {
        "items": [session_to_summary_dict(r) for r in rows],
        "total": len(rows),
    }


@router.get(
    "/projects/{project_id}/exams/{exam_id}",
    response_model=MockExamSessionResponse | MockExamGradedResponse,
)
def get_mock_exam(
    project_id: str,
    exam_id: str,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    session = _require_owned_session(db, project_id, exam_id, current_user)
    _maybe_expire(db, session)
    if session.status == "submitted":
        # Verdicts (incl. any later self-grades) are persisted on the session.
        return session_to_graded_dict(session)
    return session_to_in_progress_dict(session)


@router.post(
    "/projects/{project_id}/exams/{exam_id}/submit",
    response_model=MockExamGradedResponse,
)
@limiter.limit("30/hour")
def submit_mock_exam(
    request: Request,
    project_id: str,
    exam_id: str,
    payload: MockExamSubmitRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    session = _require_owned_session(db, project_id, exam_id, current_user)
    _maybe_expire(db, session)
    if session.status == "submitted":
        raise HTTPException(status_code=409, detail="Exam already submitted")
    if session.status == "expired":
        # Still grade what they have so they get feedback.
        session.status = "in_progress"
    try:
        session, per_question, remedial = grade_exam(
            db,
            session,
            answers=payload.answers,
            confidence_after=payload.confidence_after,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return session_to_graded_dict(session, per_question, remedial)


@router.post(
    "/projects/{project_id}/exams/{exam_id}/self-grade",
    response_model=MockExamGradedResponse,
)
@limiter.limit("120/hour")
def self_grade_mock_exam(
    request: Request,
    project_id: str,
    exam_id: str,
    payload: MockExamSelfGradeRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    session = _require_owned_session(db, project_id, exam_id, current_user)
    if session.status != "submitted":
        raise HTTPException(status_code=409, detail="Exam is not in a graded state")
    try:
        session, per_question, remedial = self_grade_answer(
            db,
            session,
            question_id=payload.question_id,
            verdict=payload.verdict,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return session_to_graded_dict(session, per_question, remedial)
