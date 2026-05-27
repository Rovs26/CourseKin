"""Notebook (study card) routes. Cards can be created manually, converted
from confused stream entries, or seeded from quiz gaps. Supports SM-2
style spaced-repetition scheduling via the /review endpoint."""

from datetime import date, datetime, timedelta, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.auth import CurrentUser, get_current_user, require_owner
from app.core.rate_limit import limiter
from app.core.utils import utc_now_iso
from app.db.database import get_db
from app.db.models import CourseStreamEntry, NotebookCard, Project
from app.schemas.notebook import (
    ConvertStreamEntryToCardRequest,
    NotebookCardCreateRequest,
    NotebookCardListResponse,
    NotebookCardResponse,
    NotebookCardReviewRequest,
    NotebookCardUpdateRequest,
)

router = APIRouter(tags=["Notebook"])


def _require_owned_project(db: Session, project_id: str, current_user: CurrentUser) -> Project:
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    require_owner(current_user, project.user_id)
    return project


def _card_to_dict(item: NotebookCard) -> dict:
    return {
        "id": item.id,
        "project_id": item.project_id,
        "user_id": item.user_id,
        "source_stream_entry_id": item.source_stream_entry_id,
        "origin": item.origin,
        "front": item.front,
        "back": item.back,
        "tags": item.tags or [],
        "ease_factor": item.ease_factor,
        "interval_days": item.interval_days,
        "repetitions": item.repetitions,
        "due_date": item.due_date,
        "last_reviewed_at": item.last_reviewed_at,
        "last_quality": item.last_quality,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
    }


def _apply_sm2(card: NotebookCard, quality: int) -> None:
    """SuperMemo 2 (SM-2) scheduling. quality is 0-5 (0-2 = fail, 3-5 = pass)."""
    if quality < 3:
        card.repetitions = 0
        card.interval_days = 1
    else:
        if card.repetitions == 0:
            card.interval_days = 1
        elif card.repetitions == 1:
            card.interval_days = 6
        else:
            card.interval_days = max(1, round((card.interval_days or 1) * card.ease_factor))
        card.repetitions += 1
        new_ease = card.ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
        card.ease_factor = max(1.3, round(new_ease, 3))

    today = date.today()
    card.due_date = (today + timedelta(days=card.interval_days)).isoformat()
    card.last_reviewed_at = utc_now_iso()
    card.last_quality = quality


@router.get(
    "/projects/{project_id}/notebook/cards",
    response_model=NotebookCardListResponse,
)
def list_notebook_cards(
    project_id: str,
    only_due: bool = False,
    tag: str | None = None,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    _require_owned_project(db, project_id, current_user)
    cards = (
        db.query(NotebookCard)
        .filter(
            NotebookCard.project_id == project_id,
            NotebookCard.user_id == current_user.user_id,
        )
        .all()
    )

    today_iso = date.today().isoformat()
    due_now = sum(
        1 for c in cards if c.due_date is None or c.due_date <= today_iso
    )

    if only_due:
        cards = [c for c in cards if c.due_date is None or c.due_date <= today_iso]

    if tag:
        tag_norm = tag.strip().lower()
        cards = [c for c in cards if c.tags and tag_norm in c.tags]

    cards.sort(
        key=lambda c: (
            c.due_date or "9999-99-99",
            c.created_at,
        )
    )
    return {
        "items": [_card_to_dict(c) for c in cards],
        "total": len(cards),
        "due_now": due_now,
    }


@router.post(
    "/projects/{project_id}/notebook/cards",
    response_model=NotebookCardResponse,
)
@limiter.limit("60/hour")
def create_notebook_card(
    request: Request,
    project_id: str,
    payload: NotebookCardCreateRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    _require_owned_project(db, project_id, current_user)

    source_entry_id = None
    origin = "manual"
    if payload.source_stream_entry_id:
        entry = db.get(CourseStreamEntry, payload.source_stream_entry_id)
        if (
            not entry
            or entry.project_id != project_id
            or entry.user_id != current_user.user_id
        ):
            raise HTTPException(status_code=404, detail="Stream entry not found")
        source_entry_id = entry.id
        origin = "stream_entry"

    now = utc_now_iso()
    today_iso = date.today().isoformat()
    card = NotebookCard(
        id=str(uuid4()),
        user_id=current_user.user_id,
        project_id=project_id,
        source_stream_entry_id=source_entry_id,
        origin=origin,
        front=payload.front,
        back=payload.back,
        tags=payload.tags,
        ease_factor=2.5,
        interval_days=0,
        repetitions=0,
        due_date=today_iso,
        last_reviewed_at=None,
        last_quality=None,
        created_at=now,
        updated_at=now,
    )
    db.add(card)
    db.commit()
    db.refresh(card)
    return _card_to_dict(card)


@router.patch(
    "/projects/{project_id}/notebook/cards/{card_id}",
    response_model=NotebookCardResponse,
)
@limiter.limit("120/hour")
def update_notebook_card(
    request: Request,
    project_id: str,
    card_id: str,
    payload: NotebookCardUpdateRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    _require_owned_project(db, project_id, current_user)
    card = db.get(NotebookCard, card_id)
    if (
        not card
        or card.project_id != project_id
        or card.user_id != current_user.user_id
    ):
        raise HTTPException(status_code=404, detail="Card not found")
    updates = payload.model_dump(exclude_unset=True)
    for key in ("front", "back", "tags"):
        if key in updates:
            setattr(card, key, updates[key])
    card.updated_at = utc_now_iso()
    db.commit()
    db.refresh(card)
    return _card_to_dict(card)


@router.delete(
    "/projects/{project_id}/notebook/cards/{card_id}", status_code=204
)
@limiter.limit("60/hour")
def delete_notebook_card(
    request: Request,
    project_id: str,
    card_id: str,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    _require_owned_project(db, project_id, current_user)
    card = db.get(NotebookCard, card_id)
    if (
        not card
        or card.project_id != project_id
        or card.user_id != current_user.user_id
    ):
        raise HTTPException(status_code=404, detail="Card not found")
    db.delete(card)
    db.commit()
    return None


@router.post(
    "/projects/{project_id}/notebook/cards/{card_id}/review",
    response_model=NotebookCardResponse,
)
@limiter.limit("240/hour")
def review_notebook_card(
    request: Request,
    project_id: str,
    card_id: str,
    payload: NotebookCardReviewRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Record a review of a card and reschedule using SM-2."""
    _require_owned_project(db, project_id, current_user)
    card = db.get(NotebookCard, card_id)
    if (
        not card
        or card.project_id != project_id
        or card.user_id != current_user.user_id
    ):
        raise HTTPException(status_code=404, detail="Card not found")
    _apply_sm2(card, payload.quality)
    card.updated_at = utc_now_iso()
    db.commit()
    db.refresh(card)
    return _card_to_dict(card)


@router.post(
    "/projects/{project_id}/stream/entries/{entry_id}/convert-to-card",
    response_model=NotebookCardResponse,
)
@limiter.limit("60/hour")
def convert_stream_entry_to_card(
    request: Request,
    project_id: str,
    entry_id: str,
    payload: ConvertStreamEntryToCardRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Convert a stream entry (typically a confusion/question) into a study card.
    Front is auto-filled from the entry content. Back is taken from the request
    payload, or left blank for the student to fill / for AI to draft later."""
    _require_owned_project(db, project_id, current_user)
    entry = db.get(CourseStreamEntry, entry_id)
    if (
        not entry
        or entry.project_id != project_id
        or entry.user_id != current_user.user_id
    ):
        raise HTTPException(status_code=404, detail="Stream entry not found")

    # If this entry has already been converted, return the existing card so the
    # client can de-duplicate transparently.
    existing = (
        db.query(NotebookCard)
        .filter(
            NotebookCard.project_id == project_id,
            NotebookCard.user_id == current_user.user_id,
            NotebookCard.source_stream_entry_id == entry.id,
        )
        .first()
    )
    if existing:
        return _card_to_dict(existing)

    now = utc_now_iso()
    today_iso = date.today().isoformat()
    front_text = entry.content[:4000]
    card = NotebookCard(
        id=str(uuid4()),
        user_id=current_user.user_id,
        project_id=project_id,
        source_stream_entry_id=entry.id,
        origin="stream_entry",
        front=front_text,
        back=payload.back,
        tags=None,
        ease_factor=2.5,
        interval_days=0,
        repetitions=0,
        due_date=today_iso,
        last_reviewed_at=None,
        last_quality=None,
        created_at=now,
        updated_at=now,
    )
    db.add(card)
    db.commit()
    db.refresh(card)
    return _card_to_dict(card)
