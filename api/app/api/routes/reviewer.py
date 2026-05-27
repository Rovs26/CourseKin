import logging
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.responses import Response
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.auth import CurrentUser, get_current_user, require_owner
from app.core.rate_limit import limiter
from app.core.utils import utc_now_iso
from app.db.database import get_db
from app.db.models import Job, Project, QuizAttempt, Reviewer, ReviewerFeedback, Source
from app.schemas.job import JobResponse
from app.schemas.reviewer import (
    ReviewerResponse,
    ReviewerRegenerateRequest,
    BatchGenerateRequest,
    BatchGenerateResponse,
    CustomPdfRequest,
    ReviewerFeedbackRequest,
    ReviewerFeedbackResponse,
    QuizAttemptRequest,
    QuizAttemptResponse,
    QuizPracticeSummaryResponse,
)
from app.services.generation_guard_service import require_generation_challenge
from app.services.notebook_service import seed_remedial_cards_from_quiz_results
from app.services.usage_service import (
    check_daily_cap,
    check_monthly_quota,
    lock_quota_for_user,
    reserve_usage,
)
from app.services.pdf_export_service import generate_reviewer_pdf
from app.services.templates import get_template

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Reviewer"])


def _reviewer_to_dict(reviewer: Reviewer):
    return {
        "project_id": reviewer.project_id,
        "source_id": reviewer.source_id,
        "status": reviewer.status,
        "output_type": reviewer.output_type,
        "version": reviewer.version,
        "content_json": reviewer.content_json,
        "created_at": reviewer.created_at,
        "updated_at": reviewer.updated_at,
    }


def _job_to_dict(job: Job):
    return {
        "id": job.id,
        "project_id": job.project_id,
        "source_id": job.source_id,
        "job_type": job.job_type,
        "status": job.status,
        "stage": job.stage,
        "created_at": job.created_at,
        "updated_at": job.updated_at,
        "error_message": job.error_message,
    }


def _quiz_attempt_to_dict(attempt: QuizAttempt):
    return {
        "id": attempt.id,
        "project_id": attempt.project_id,
        "reviewer_version": attempt.reviewer_version,
        "results": attempt.results,
        "total_questions": attempt.total_questions,
        "correct_answers": attempt.correct_answers,
        "score_percent": attempt.score_percent,
        "duration_seconds": attempt.duration_seconds,
        "created_at": attempt.created_at,
    }


def _pick_source_for_regenerate(db: Session, project_id: str, source_id: str | None = None):
    if source_id:
        source = db.get(Source, source_id)
        if not source:
            raise HTTPException(status_code=404, detail="Source not found")
        if source.project_id != project_id:
            raise HTTPException(status_code=400, detail="Source does not belong to project")
        return source

    current_reviewer = db.get(Reviewer, project_id)
    if current_reviewer and current_reviewer.source_id:
        source = db.get(Source, current_reviewer.source_id)
        if source and source.project_id == project_id:
            return source

    source = (
        db.query(Source)
        .filter(Source.project_id == project_id)
        .order_by(Source.created_at.desc())
        .first()
    )

    if not source:
        raise HTTPException(status_code=400, detail="No sources found for project")

    return source


@router.get("/projects/{project_id}/reviewer", response_model=ReviewerResponse)
def get_project_reviewer(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    require_owner(current_user, project.user_id)

    reviewer = db.get(Reviewer, project_id)
    if not reviewer:
        return {
            "project_id": project_id,
            "source_id": None,
            "status": "not-ready",
            "output_type": "full-reviewer",
            "version": 1,
            "content_json": None,
            "created_at": None,
            "updated_at": None,
        }

    return _reviewer_to_dict(reviewer)


@router.post(
    "/projects/{project_id}/reviewer/feedback",
    response_model=ReviewerFeedbackResponse,
)
@limiter.limit("120/hour")
def record_reviewer_feedback(
    request: Request,
    project_id: str,
    payload: ReviewerFeedbackRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    require_owner(current_user, project.user_id)

    reviewer = db.get(Reviewer, project_id)
    if not reviewer or not isinstance(reviewer.content_json, dict):
        raise HTTPException(status_code=400, detail="No reviewer content to rate")

    item_index = -1 if payload.section == "summary" else payload.item_index
    if payload.section == "summary" and payload.item_index is not None:
        raise HTTPException(status_code=400, detail="Summary feedback does not accept item_index")
    if payload.section != "summary":
        items = reviewer.content_json.get(payload.section)
        if (
            not isinstance(item_index, int)
            or item_index < 0
            or not isinstance(items, list)
            or item_index >= len(items)
        ):
            raise HTTPException(status_code=400, detail="Feedback item does not exist")

    feedback = (
        db.query(ReviewerFeedback)
        .filter(
            ReviewerFeedback.user_id == current_user.user_id,
            ReviewerFeedback.project_id == project_id,
            ReviewerFeedback.reviewer_version == reviewer.version,
            ReviewerFeedback.section == payload.section,
            ReviewerFeedback.item_index == item_index,
        )
        .first()
    )
    now = utc_now_iso()
    if feedback:
        feedback.rating = payload.rating
        feedback.comment = payload.comment
        feedback.updated_at = now
    else:
        feedback = ReviewerFeedback(
            id=str(uuid4()),
            user_id=current_user.user_id,
            project_id=project_id,
            reviewer_version=reviewer.version,
            section=payload.section,
            item_index=item_index,
            rating=payload.rating,
            comment=payload.comment,
            created_at=now,
            updated_at=now,
        )
        db.add(feedback)

    db.commit()
    db.refresh(feedback)
    return {
        "id": feedback.id,
        "project_id": feedback.project_id,
        "reviewer_version": feedback.reviewer_version,
        "section": feedback.section,
        "item_index": None if feedback.item_index == -1 else feedback.item_index,
        "rating": feedback.rating,
        "comment": feedback.comment,
        "created_at": feedback.created_at,
        "updated_at": feedback.updated_at,
    }


@router.post(
    "/projects/{project_id}/reviewer/quiz-attempts",
    response_model=QuizAttemptResponse,
)
@limiter.limit("120/hour")
def record_quiz_attempt(
    request: Request,
    project_id: str,
    payload: QuizAttemptRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    require_owner(current_user, project.user_id)

    reviewer = db.get(Reviewer, project_id)
    if (
        not reviewer
        or reviewer.version != payload.reviewer_version
        or not isinstance(reviewer.content_json, dict)
    ):
        raise HTTPException(status_code=400, detail="This notebook changed. Reload before practicing.")

    quiz = reviewer.content_json.get("quiz")
    if not isinstance(quiz, list) or not quiz:
        raise HTTPException(status_code=400, detail="No quiz is available in this notebook")
    if len(payload.answers) != len(quiz):
        raise HTTPException(status_code=400, detail="Answer every quiz question before submitting")

    answer_by_index = {answer.item_index: answer.selected_answer for answer in payload.answers}
    if set(answer_by_index) != set(range(len(quiz))):
        raise HTTPException(status_code=400, detail="Answer every quiz question before submitting")

    evidence = reviewer.content_json.get("_evidence", {})
    quiz_evidence = evidence.get("quiz", []) if isinstance(evidence, dict) else []
    results: list[dict] = []
    for index, item in enumerate(quiz):
        if not isinstance(item, dict):
            raise HTTPException(status_code=400, detail="Quiz content is malformed")
        choices = item.get("choices")
        correct_answer = item.get("answer")
        selected_answer = answer_by_index[index]
        if (
            not isinstance(choices, list)
            or not isinstance(correct_answer, str)
            or selected_answer not in choices
        ):
            raise HTTPException(status_code=400, detail="Select an available answer for each question")
        raw_topic = item.get("topic")
        topic = (
            raw_topic.strip()[:120]
            if isinstance(raw_topic, str) and raw_topic.strip()
            else None
        )
        result = {
            "item_index": index,
            "question": str(item.get("question", "")),
            "selected_answer": selected_answer,
            "correct_answer": correct_answer,
            "rationale": str(item.get("rationale", "")),
            "is_correct": selected_answer == correct_answer,
            "topic": topic,
            "evidence": quiz_evidence[index]
            if index < len(quiz_evidence) and isinstance(quiz_evidence[index], dict)
            else None,
        }
        results.append(result)

    correct_answers = sum(1 for result in results if result["is_correct"])
    now = utc_now_iso()
    attempt = QuizAttempt(
        id=str(uuid4()),
        user_id=current_user.user_id,
        project_id=project_id,
        reviewer_version=reviewer.version,
        results=results,
        total_questions=len(results),
        correct_answers=correct_answers,
        score_percent=round((correct_answers / len(results)) * 100),
        duration_seconds=payload.duration_seconds,
        created_at=now,
    )
    db.add(attempt)
    db.commit()
    db.refresh(attempt)

    # Seed remedial notebook cards for any missed questions. Best-effort —
    # failures here must not break the quiz submission flow.
    try:
        seeded = seed_remedial_cards_from_quiz_results(
            db,
            user_id=current_user.user_id,
            project_id=project_id,
            results=results,
        )
        if seeded:
            db.commit()
    except Exception:  # noqa: BLE001
        logger.exception("Failed to seed remedial notebook cards from quiz attempt")
        db.rollback()

    return _quiz_attempt_to_dict(attempt)


@router.get(
    "/projects/{project_id}/reviewer/practice-summary",
    response_model=QuizPracticeSummaryResponse,
)
def get_quiz_practice_summary(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    require_owner(current_user, project.user_id)

    totals = (
        db.query(
            func.count(QuizAttempt.id),
            func.coalesce(func.sum(QuizAttempt.total_questions), 0),
            func.coalesce(func.sum(QuizAttempt.correct_answers), 0),
            func.max(QuizAttempt.score_percent),
        )
        .filter(
            QuizAttempt.project_id == project_id,
            QuizAttempt.user_id == current_user.user_id,
        )
        .one()
    )
    total_attempts = int(totals[0])
    if total_attempts == 0:
        return {
            "total_attempts": 0,
            "total_answered": 0,
            "total_correct": 0,
            "latest_score_percent": None,
            "best_score_percent": None,
            "practice_signal": "no_practice",
            "practice_signal_label": "No practice recorded",
            "signal_note": "Take a notebook quiz to begin measuring recall. Preparation sessions alone do not show mastery.",
            "next_action": "Take the quiz in this notebook and review every missed answer.",
            "focus_topics": [],
            "focus_questions": [],
            "recent_attempts": [],
        }

    attempts = (
        db.query(QuizAttempt)
        .filter(
            QuizAttempt.project_id == project_id,
            QuizAttempt.user_id == current_user.user_id,
        )
        .order_by(QuizAttempt.created_at.desc())
        .limit(10)
        .all()
    )
    latest = attempts[0]
    focus_questions = [result for result in latest.results if not result["is_correct"]][:3]
    topic_totals: dict[str, dict] = {}
    for attempt in attempts:
        for result in attempt.results:
            if not isinstance(result, dict):
                continue
            raw_topic = result.get("topic")
            if not isinstance(raw_topic, str) or not raw_topic.strip():
                continue
            topic = raw_topic.strip()
            key = topic.casefold()
            stats = topic_totals.setdefault(
                key,
                {
                    "topic": topic,
                    "questions_answered": 0,
                    "correct_answers": 0,
                    "missed_count": 0,
                },
            )
            stats["questions_answered"] += 1
            if result.get("is_correct") is True:
                stats["correct_answers"] += 1
            else:
                stats["missed_count"] += 1

    focus_topics = []
    for stats in topic_totals.values():
        score_percent = round(
            (stats["correct_answers"] / stats["questions_answered"]) * 100
        )
        if stats["missed_count"] and score_percent < 70:
            status = "needs_review"
            action = f"Review the cited explanation for {stats['topic']}, then retry it."
        elif stats["missed_count"]:
            status = "practicing"
            action = f"Keep practicing {stats['topic']} to make recall more consistent."
        else:
            status = "recall_improving"
            action = f"Recheck {stats['topic']} later with new practice material."
        focus_topics.append(
            {
                **stats,
                "score_percent": score_percent,
                "status": status,
                "recommended_action": action,
            }
        )
    status_order = {"needs_review": 0, "practicing": 1, "recall_improving": 2}
    focus_topics.sort(
        key=lambda item: (
            status_order[item["status"]],
            item["score_percent"],
            -item["missed_count"],
            item["topic"].casefold(),
        )
    )
    focus_topics = focus_topics[:5]
    if total_attempts == 1:
        signal = "early"
        label = "First check-in recorded"
        note = "One quiz attempt is an early recall signal, not an exam readiness score."
    elif latest.score_percent < 70:
        signal = "needs_review"
        label = "Review recommended"
        note = "Recent quiz results show material worth reviewing before your next assessment."
    else:
        signal = "building"
        label = "Recall is building"
        note = "Recent quiz results are promising, but this is not an exam readiness score."

    if focus_topics and focus_topics[0]["status"] == "needs_review":
        next_action = (
            f"Focus first on {focus_topics[0]['topic']}, then retry a short quiz."
        )
    elif focus_questions:
        next_action = "Review the missed questions below, then retry this quiz."
    else:
        next_action = "Revisit this quiz later or build new questions from additional material."
    return {
        "total_attempts": total_attempts,
        "total_answered": int(totals[1]),
        "total_correct": int(totals[2]),
        "latest_score_percent": latest.score_percent,
        "best_score_percent": int(totals[3]),
        "practice_signal": signal,
        "practice_signal_label": label,
        "signal_note": note,
        "next_action": next_action,
        "focus_topics": focus_topics,
        "focus_questions": focus_questions,
        "recent_attempts": [_quiz_attempt_to_dict(attempt) for attempt in attempts],
    }


@router.get("/projects/{project_id}/reviewer/export/pdf")
def export_reviewer_pdf(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    require_owner(current_user, project.user_id)

    reviewer = db.get(Reviewer, project_id)
    if not reviewer or not reviewer.content_json:
        raise HTTPException(status_code=400, detail="No reviewer content to export")

    template_name = None
    if project.template_id:
        template = get_template(project.template_id)
        if template:
            template_name = template.name

    pdf_bytes = generate_reviewer_pdf(
        project_title=project.title,
        field_of_study=project.field_of_study,
        version=reviewer.version,
        content=reviewer.content_json,
        template_name=template_name,
    )

    safe_title = project.title.lower().replace(" ", "-")[:50]
    filename = f"{safe_title}-reviewer-v{reviewer.version}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


@router.get("/projects/{project_id}/reviewer/download/pdf")
def download_reviewer_pdf(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Same as export/pdf but forces browser download via attachment disposition."""
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    require_owner(current_user, project.user_id)

    reviewer = db.get(Reviewer, project_id)
    if not reviewer or not reviewer.content_json:
        raise HTTPException(status_code=400, detail="No reviewer content to export")

    template_name = None
    if project.template_id:
        template = get_template(project.template_id)
        if template:
            template_name = template.name

    pdf_bytes = generate_reviewer_pdf(
        project_title=project.title,
        field_of_study=project.field_of_study,
        version=reviewer.version,
        content=reviewer.content_json,
        template_name=template_name,
    )

    safe_title = project.title.lower().replace(" ", "-")[:50]
    filename = f"{safe_title}-reviewer-v{reviewer.version}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/projects/{project_id}/reviewer/export/custom-pdf")
def export_custom_pdf(
    project_id: str,
    payload: CustomPdfRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Generate PDF with custom section order and visibility from the export editor."""
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    require_owner(current_user, project.user_id)

    reviewer = db.get(Reviewer, project_id)
    if not reviewer or not reviewer.content_json:
        raise HTTPException(status_code=400, detail="No reviewer content to export")

    template_name = None
    if project.template_id:
        template = get_template(project.template_id)
        if template:
            template_name = template.name

    pdf_bytes = generate_reviewer_pdf(
        project_title=project.title,
        field_of_study=project.field_of_study,
        version=reviewer.version,
        content=reviewer.content_json,
        template_name=template_name,
        section_order=payload.section_order,
        visible_sections=payload.visible_sections,
    )

    safe_title = project.title.lower().replace(" ", "-")[:50]
    filename = f"{safe_title}-reviewer-v{reviewer.version}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/reviewer/regenerate", response_model=JobResponse)
@limiter.limit("10/hour;30/day;100/month")
def regenerate_reviewer(
    request: Request,
    payload: ReviewerRegenerateRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    project = db.get(Project, payload.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    require_owner(current_user, project.user_id)

    source = _pick_source_for_regenerate(db, payload.project_id, payload.source_id)

    source_text = (source.text or "").strip()
    if not source_text:
        raise HTTPException(
            status_code=400,
            detail="Selected source has no usable extracted text yet"
        )

    require_generation_challenge(request, payload.turnstile_token, current_user.user_id, db)
    lock_quota_for_user(current_user.user_id, db)
    check_daily_cap(user_id=current_user.user_id, db=db)
    check_monthly_quota(user_id=current_user.user_id, db=db)

    now = utc_now_iso()

    existing_reviewer = db.get(Reviewer, payload.project_id)
    if existing_reviewer:
        existing_reviewer.status = "stale"
        existing_reviewer.updated_at = now

    sections = payload.sections
    counts = payload.counts.model_dump(exclude_none=True) if payload.counts else None
    if sections is None and counts is None and project.template_id:
        template = get_template(project.template_id)
        if template:
            sections = template.sections
            counts = dict(template.counts)

    job = Job(
        id=str(uuid4()),
        project_id=payload.project_id,
        source_id=source.id,
        user_id=current_user.user_id,
        job_type="regenerate-reviewer",
        status="queued",
        stage="queued",
        generation_options={
            "sections": sections,
            "counts": counts,
            "merge_mode": payload.merge_mode,
        },
        created_at=now,
        updated_at=now,
        error_message=None,
    )

    db.add(job)
    reserve_usage(db, current_user.user_id, job.id)
    db.commit()
    db.refresh(job)

    return _job_to_dict(job)


@router.post("/reviewer/batch-generate", response_model=BatchGenerateResponse)
@limiter.limit("10/hour;30/day;100/month")
def batch_generate_reviewer(
    request: Request,
    payload: BatchGenerateRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Generate from multiple sources in one request. Each source runs sequentially
    and appends its content to the shared project reviewer."""
    project = db.get(Project, payload.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    require_owner(current_user, project.user_id)

    if not payload.sources:
        raise HTTPException(status_code=400, detail="At least one source config is required")

    # Cap batch size — prevents 1 request from triggering N unbounded AI calls
    MAX_BATCH_SOURCES = 5
    if len(payload.sources) > MAX_BATCH_SOURCES:
        raise HTTPException(
            status_code=400,
            detail=f"Batch is limited to {MAX_BATCH_SOURCES} sources per request",
        )

    require_generation_challenge(request, payload.turnstile_token, current_user.user_id, db)
    lock_quota_for_user(current_user.user_id, db)
    check_daily_cap(user_id=current_user.user_id, db=db, requested_generations=len(payload.sources))
    check_monthly_quota(user_id=current_user.user_id, db=db, requested_generations=len(payload.sources))

    now = utc_now_iso()
    batch_id = str(uuid4())

    # Mark existing reviewer as stale
    existing_reviewer = db.get(Reviewer, payload.project_id)
    if existing_reviewer:
        existing_reviewer.status = "stale"
        existing_reviewer.updated_at = now

    # Create a job for each source and validate
    job_ids = []

    for sc in payload.sources:
        source = db.get(Source, sc.source_id)
        if not source:
            raise HTTPException(status_code=404, detail=f"Source {sc.source_id} not found")
        if source.project_id != payload.project_id:
            raise HTTPException(status_code=400, detail=f"Source {sc.source_id} does not belong to project")

        source_text = (source.text or "").strip()
        if not source_text:
            raise HTTPException(
                status_code=400,
                detail=f"Source '{source.title}' has no usable text"
            )

        job = Job(
            id=str(uuid4()),
            project_id=payload.project_id,
            source_id=source.id,
            user_id=current_user.user_id,
            job_type="batch-generate",
            status="queued",
            stage="queued",
            created_at=now,
            updated_at=now,
            error_message=None,
        )
        counts_dict = sc.counts.model_dump(exclude_none=True) if sc.counts else None

        # Fall back to template defaults
        sections = sc.sections
        if sections is None and counts_dict is None and project.template_id:
            template = get_template(project.template_id)
            if template:
                sections = template.sections
                counts_dict = dict(template.counts)

        job.generation_options = {
            "sections": sections,
            "counts": counts_dict,
            "merge_mode": sc.merge_mode,
        }
        db.add(job)
        reserve_usage(db, current_user.user_id, job.id)
        job_ids.append(job.id)

    db.commit()

    return BatchGenerateResponse(
        batch_id=batch_id,
        project_id=payload.project_id,
        total_sources=len(payload.sources),
        status="processing",
        job_ids=job_ids,
    )
