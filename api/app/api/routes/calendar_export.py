"""Calendar subscription routes — issue/rotate a per-user token and serve the
read-only .ics feed that calendar apps poll.

The feed endpoint is intentionally token-authenticated (no Clerk bearer) because
Apple/Google Calendar cannot attach an Authorization header to a subscription.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session

from app.core.auth import CurrentUser, get_current_user
from app.core.rate_limit import limiter
from app.db.database import get_db
from app.schemas.calendar_export import CalendarSubscriptionResponse
from app.services.calendar_export_service import (
    build_feed,
    get_or_create_token,
    resolve_user_id,
    rotate_token,
)

router = APIRouter(tags=["Calendar"])


def _subscription_urls(request: Request, token: str) -> CalendarSubscriptionResponse:
    base = str(request.base_url).rstrip("/")
    feed_url = f"{base}/calendar/feed/{token}.ics"
    # webcal:// makes most desktop calendar apps offer one-click subscribe.
    webcal_url = feed_url.replace("https://", "webcal://").replace("http://", "webcal://")
    return CalendarSubscriptionResponse(
        token=token,
        feed_url=feed_url,
        webcal_url=webcal_url,
    )


@router.get("/calendar/subscription", response_model=CalendarSubscriptionResponse)
def get_calendar_subscription(
    request: Request,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    record = get_or_create_token(db, current_user.user_id)
    return _subscription_urls(request, record.token)


@router.post("/calendar/subscription/rotate", response_model=CalendarSubscriptionResponse)
@limiter.limit("10/hour")
def rotate_calendar_subscription(
    request: Request,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    record = rotate_token(db, current_user.user_id)
    return _subscription_urls(request, record.token)


@router.get("/calendar/feed/{token}.ics")
@limiter.limit("60/hour")
def get_calendar_feed(
    request: Request,
    token: str,
    db: Session = Depends(get_db),
):
    user_id = resolve_user_id(db, token)
    if not user_id:
        raise HTTPException(status_code=404, detail="Calendar feed not found")
    content = build_feed(db, user_id)
    return Response(
        content=content,
        media_type="text/calendar; charset=utf-8",
        headers={"Content-Disposition": 'inline; filename="coursekin.ics"'},
    )
