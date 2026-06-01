"""Natural-language day planner routes.

Suggest-then-confirm flow: POST /planner/suggest parses free text into
time-blocked suggestions that slot around the user's existing planned study
sessions and planner blocks. The client reviews, then POST /planner/blocks
persists the accepted blocks. Standard list/update/delete round out CRUD.
"""

from datetime import date
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.auth import CurrentUser, get_current_user, require_owner
from app.core.rate_limit import limiter
from app.core.utils import utc_now_iso
from app.db.database import get_db
from app.db.models import CourseTask, PlannerBlock, PreparationMilestone, Project
from app.schemas.planner import (
    AssistantChatRequest,
    AssistantChatResponse,
    PlannerBlockListResponse,
    PlannerBlockResponse,
    PlannerBlockUpdateRequest,
    PlannerConfirmRequest,
    PlannerSuggestion,
    PlannerSuggestRequest,
    PlannerSuggestResponse,
)
from app.services.generation_guard_service import require_generation_challenge
from app.services.planner_service import (
    busy_from_sessions,
    chat_with_assistant,
    parse_plan_text,
    suggest_schedule,
)
from app.services.usage_service import (
    check_daily_cap,
    check_monthly_quota,
    lock_quota_for_user,
    record_usage,
)

router = APIRouter(tags=["Planner"])


def _block_to_dict(item: PlannerBlock) -> dict:
    return {
        "id": item.id,
        "project_id": item.project_id,
        "title": item.title,
        "notes": item.notes,
        "kind": item.kind,
        "scheduled_date": item.scheduled_date,
        "start_time": item.start_time,
        "duration_minutes": item.duration_minutes,
        "status": item.status,
        "origin": item.origin,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
    }


def _gather_existing_busy(db: Session, user_id: str, dates: set[str]) -> dict:
    """Build the busy map for the relevant dates from the user's planned study
    sessions (preparation milestones for owned projects) and existing planner
    blocks, so suggestions don't double-book."""
    if not dates:
        return {}

    sessions: list[dict] = []

    owned_project_ids = [
        row[0]
        for row in db.query(Project.id).filter(Project.user_id == user_id).all()
    ]
    if owned_project_ids:
        milestones = (
            db.query(PreparationMilestone)
            .filter(
                PreparationMilestone.project_id.in_(owned_project_ids),
                PreparationMilestone.scheduled_date.in_(dates),
                PreparationMilestone.status == "planned",
            )
            .all()
        )
        for m in milestones:
            sessions.append(
                {
                    "scheduled_date": m.scheduled_date,
                    "estimated_minutes": m.estimated_minutes,
                    "start_time": None,
                }
            )

    blocks = (
        db.query(PlannerBlock)
        .filter(
            PlannerBlock.user_id == user_id,
            PlannerBlock.scheduled_date.in_(dates),
            PlannerBlock.status == "planned",
        )
        .all()
    )
    for b in blocks:
        sessions.append(
            {
                "scheduled_date": b.scheduled_date,
                "estimated_minutes": b.duration_minutes,
                "start_time": b.start_time,
            }
        )

    return busy_from_sessions(sessions)


def _build_assistant_context(db: Session, user_id: str) -> str:
    """Compact, grounded snapshot of the student's courses, open tasks, and
    upcoming study sessions for the assistant to reason over."""
    today = date.today().isoformat()
    lines: list[str] = [f"Today: {today}"]

    projects = (
        db.query(Project)
        .filter(Project.user_id == user_id)
        .order_by(Project.created_at.desc())
        .all()
    )
    title_by_id = {p.id: (p.course_code or p.title) for p in projects}
    if projects:
        lines.append(
            "Courses: " + ", ".join(title_by_id[p.id] for p in projects[:12])
        )
    else:
        lines.append("Courses: none yet")

    open_tasks = (
        db.query(CourseTask)
        .filter(CourseTask.user_id == user_id, CourseTask.status == "open")
        .order_by(CourseTask.due_date.is_(None), CourseTask.due_date.asc())
        .limit(15)
        .all()
    )
    if open_tasks:
        lines.append("Open tasks:")
        for t in open_tasks:
            course = title_by_id.get(t.project_id, "")
            due = f"due {t.due_date}" if t.due_date else "no date"
            lines.append(f"- {t.title} ({course}; {due}; {t.priority} priority)")
    else:
        lines.append("Open tasks: none")

    if projects:
        owned_ids = list(title_by_id.keys())
        sessions = (
            db.query(PreparationMilestone)
            .filter(
                PreparationMilestone.project_id.in_(owned_ids),
                PreparationMilestone.scheduled_date >= today,
                PreparationMilestone.status == "planned",
            )
            .order_by(PreparationMilestone.scheduled_date.asc())
            .limit(12)
            .all()
        )
        if sessions:
            lines.append("Upcoming study sessions:")
            for s in sessions:
                course = title_by_id.get(s.project_id, "")
                lines.append(
                    f"- {s.scheduled_date}: {s.title} ({course}; {s.estimated_minutes} min)"
                )

    return "\n".join(lines)


@router.post("/planner/chat", response_model=AssistantChatResponse)
@limiter.limit("30/hour;120/day;400/month")
def assistant_chat(
    request: Request,
    payload: AssistantChatRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Conversational study assistant. The model classifies intent and either
    replies (tutor/advisor/study buddy) or proposes a timetable to confirm.

    Confirmation-first: when mode is "plan", suggestions are returned only — the
    client confirms and calls POST /planner/blocks to persist.
    """
    require_generation_challenge(
        request, payload.turnstile_token, current_user.user_id, db
    )
    lock_quota_for_user(current_user.user_id, db)
    check_daily_cap(user_id=current_user.user_id, db=db)
    check_monthly_quota(user_id=current_user.user_id, db=db)

    context = _build_assistant_context(db, current_user.user_id)
    history = [m.model_dump() for m in payload.history]

    try:
        result, usage_meta = chat_with_assistant(payload.message, history, context)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Assistant unavailable: {exc}")

    try:
        record_usage(
            db=db,
            user_id=current_user.user_id,
            job_id=None,
            model=usage_meta["model"],
            prompt_tokens=usage_meta["prompt_tokens"],
            completion_tokens=usage_meta["completion_tokens"],
            cost_usd=usage_meta["cost_usd"],
        )
    except Exception:
        db.rollback()

    suggestions: list[PlannerSuggestion] = []
    if result["mode"] == "plan" and result["blocks"]:
        dates = {b["scheduled_date"] for b in result["blocks"]}
        existing_busy = _gather_existing_busy(db, current_user.user_id, dates)
        scheduled = suggest_schedule(result["blocks"], existing_busy)
        suggestions = [PlannerSuggestion(**s) for s in scheduled]

    mode = "plan" if suggestions else "reply"
    return AssistantChatResponse(
        mode=mode,
        reply=result["reply"],
        suggestions=suggestions,
        model=usage_meta["model"],
        cost_usd=usage_meta["cost_usd"],
    )


@router.post("/planner/suggest", response_model=PlannerSuggestResponse)
@limiter.limit("20/hour;60/day;200/month")
def suggest_plan(
    request: Request,
    payload: PlannerSuggestRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Parse free-text plans into time-blocked suggestions around existing work.

    Confirmation-first: returns suggestions only — the client confirms and then
    calls POST /planner/blocks to persist.
    """
    require_generation_challenge(
        request, payload.turnstile_token, current_user.user_id, db
    )
    lock_quota_for_user(current_user.user_id, db)
    check_daily_cap(user_id=current_user.user_id, db=db)
    check_monthly_quota(user_id=current_user.user_id, db=db)

    try:
        blocks, usage_meta = parse_plan_text(payload.text)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Plan parsing failed: {exc}")

    try:
        record_usage(
            db=db,
            user_id=current_user.user_id,
            job_id=None,
            model=usage_meta["model"],
            prompt_tokens=usage_meta["prompt_tokens"],
            completion_tokens=usage_meta["completion_tokens"],
            cost_usd=usage_meta["cost_usd"],
        )
    except Exception:
        db.rollback()

    dates = {b["scheduled_date"] for b in blocks}
    existing_busy = _gather_existing_busy(db, current_user.user_id, dates)
    suggestions = suggest_schedule(blocks, existing_busy)

    return PlannerSuggestResponse(
        suggestions=[PlannerSuggestion(**s) for s in suggestions],
        model=usage_meta["model"],
        cost_usd=usage_meta["cost_usd"],
    )


@router.post("/planner/blocks", response_model=PlannerBlockListResponse)
@limiter.limit("60/hour")
def create_planner_blocks(
    request: Request,
    payload: PlannerConfirmRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Persist the user-confirmed blocks. Blocks may optionally link to a course
    the user owns; non-course personal blocks are allowed (project_id null)."""
    now = utc_now_iso()
    created: list[PlannerBlock] = []
    for item in payload.blocks:
        if item.project_id is not None:
            project = db.get(Project, item.project_id)
            if not project:
                raise HTTPException(status_code=404, detail="Linked course not found")
            require_owner(current_user, project.user_id)
        block = PlannerBlock(
            id=str(uuid4()),
            user_id=current_user.user_id,
            project_id=item.project_id,
            title=item.title,
            notes=item.notes,
            kind=item.kind,
            scheduled_date=item.scheduled_date,
            start_time=item.start_time,
            duration_minutes=item.duration_minutes,
            status="planned",
            origin="planner",
            created_at=now,
            updated_at=now,
        )
        db.add(block)
        created.append(block)
    db.commit()

    items = [_block_to_dict(b) for b in created]
    return PlannerBlockListResponse(
        items=[PlannerBlockResponse(**i) for i in items], total=len(items)
    )


@router.get("/planner/blocks", response_model=PlannerBlockListResponse)
def list_planner_blocks(
    start_date: str | None = None,
    end_date: str | None = None,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """List the user's planner blocks, optionally bounded by an inclusive date
    range (defaults to all)."""
    query = db.query(PlannerBlock).filter(PlannerBlock.user_id == current_user.user_id)
    if start_date:
        date.fromisoformat(start_date)
        query = query.filter(PlannerBlock.scheduled_date >= start_date)
    if end_date:
        date.fromisoformat(end_date)
        query = query.filter(PlannerBlock.scheduled_date <= end_date)
    rows = query.order_by(
        PlannerBlock.scheduled_date.asc(), PlannerBlock.start_time.asc()
    ).all()
    items = [_block_to_dict(b) for b in rows]
    return PlannerBlockListResponse(
        items=[PlannerBlockResponse(**i) for i in items], total=len(items)
    )


def _owned_block(db: Session, block_id: str, current_user: CurrentUser) -> PlannerBlock:
    block = db.get(PlannerBlock, block_id)
    if not block or block.user_id != current_user.user_id:
        raise HTTPException(status_code=404, detail="Planner block not found")
    return block


@router.patch("/planner/blocks/{block_id}", response_model=PlannerBlockResponse)
@limiter.limit("120/hour")
def update_planner_block(
    request: Request,
    block_id: str,
    payload: PlannerBlockUpdateRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    block = _owned_block(db, block_id, current_user)
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(block, field, value)
    block.updated_at = utc_now_iso()
    db.commit()
    db.refresh(block)
    return PlannerBlockResponse(**_block_to_dict(block))


@router.delete("/planner/blocks/{block_id}", status_code=204)
@limiter.limit("60/hour")
def delete_planner_block(
    request: Request,
    block_id: str,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    block = _owned_block(db, block_id, current_user)
    db.delete(block)
    db.commit()
