"""Polar checkout, subscription status, and verified webhook handling."""

import base64
import hashlib
import hmac
import json
import logging
import time
from typing import Literal

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.auth import CurrentUser, get_current_user
from app.core.config import settings
from app.core.rate_limit import limiter
from app.core.utils import utc_now_iso
from app.db.database import get_db
from app.db.models import Subscription, WebhookEvent

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Billing"])
POLAR_API_BASE = "https://api.polar.sh"
PAID_PLANS = {"plus_monthly", "plus_yearly"}


def _is_active_subscription(sub: Subscription | None) -> bool:
    return bool(
        sub
        and sub.plan in PAID_PLANS
        and sub.status == "active"
        and sub.current_period_end > utc_now_iso()
    )


def _plan_from_product_id(product_id: str) -> str | None:
    if product_id and product_id == settings.POLAR_PLUS_MONTHLY_PRODUCT_ID:
        return "plus_monthly"
    if product_id and product_id == settings.POLAR_PLUS_YEARLY_PRODUCT_ID:
        return "plus_yearly"
    return None


def _status_from_polar(polar_status: str) -> str:
    if polar_status in ("active", "trialing"):
        return "active"
    if polar_status == "past_due":
        return "past_due"
    return "canceled"


def _verify_polar_webhook(headers: dict, body: bytes) -> str:
    """Verify a Svix-signed Polar event and return its idempotency identifier."""
    msg_id = headers.get("svix-id") or headers.get("webhook-id", "")
    msg_ts = headers.get("svix-timestamp") or headers.get("webhook-timestamp", "")
    msg_sig = headers.get("svix-signature") or headers.get("webhook-signature", "")
    if not msg_id or not msg_ts or not msg_sig:
        raise HTTPException(status_code=400, detail="Missing webhook signature headers")

    if not settings.POLAR_WEBHOOK_SECRET.strip():
        if settings.APP_ENV == "production":
            raise HTTPException(status_code=500, detail="Webhook secret not configured")
        logger.warning("Polar webhook signature is disabled in development")
        return msg_id

    try:
        if abs(int(time.time()) - int(msg_ts)) > 300:
            raise HTTPException(status_code=400, detail="Webhook timestamp too old")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid webhook timestamp")

    raw_secret = settings.POLAR_WEBHOOK_SECRET.removeprefix("whsec_")
    raw_secret += "=" * (-len(raw_secret) % 4)
    secret_bytes = base64.b64decode(raw_secret)
    signed = f"{msg_id}.{msg_ts}.".encode() + body
    expected = base64.b64encode(hmac.new(secret_bytes, signed, hashlib.sha256).digest()).decode()
    signatures = [value.removeprefix("v1,") for value in msg_sig.split(" ")]
    if not any(hmac.compare_digest(expected, signature) for signature in signatures):
        raise HTTPException(status_code=400, detail="Invalid webhook signature")
    return msg_id


def _upsert_subscription(db: Session, event_type: str, data: dict) -> None:
    metadata = data.get("metadata") or data.get("customer_metadata") or {}
    customer = data.get("customer") or {}
    user_id = (
        metadata.get("user_id")
        or data.get("customer_external_id")
        or customer.get("external_id")
    )
    subscription_id = data.get("id", "")
    if not user_id:
        existing = db.query(Subscription).filter(
            Subscription.polar_subscription_id == subscription_id
        ).first()
        user_id = existing.user_id if existing else None
    if not user_id or not subscription_id:
        raise ValueError("Polar subscription event is missing user or subscription identity")

    product_id = data.get("product_id") or (data.get("product") or {}).get("id", "")
    plan = _plan_from_product_id(product_id)
    status = _status_from_polar(data.get("status", "canceled"))
    if event_type == "subscription.revoked":
        status = "revoked"
    if plan is None:
        logger.warning("Ignoring paid access for unknown Polar product id %s", product_id)
        plan = "free"
        status = "canceled"

    customer_id = data.get("customer_id") or customer.get("id", "")
    if not customer_id:
        raise ValueError("Polar subscription event is missing customer identity")

    now = utc_now_iso()
    sub = db.get(Subscription, user_id)
    if sub is None:
        sub = Subscription(
            user_id=user_id,
            polar_customer_id=customer_id,
            polar_subscription_id=subscription_id,
            plan=plan,
            status=status,
            current_period_end=data.get("current_period_end") or now,
            created_at=now,
            updated_at=now,
        )
        db.add(sub)
    else:
        sub.polar_customer_id = customer_id
        sub.polar_subscription_id = subscription_id
        sub.plan = plan
        sub.status = status
        sub.current_period_end = data.get("current_period_end") or now
        sub.updated_at = now
    logger.info("Subscription processed: user=%s plan=%s status=%s event=%s", user_id, plan, status, event_type)


def revoke_polar_subscription(subscription_id: str) -> None:
    """Immediately revoke a paid subscription during account deletion."""
    if not settings.POLAR_ACCESS_TOKEN:
        raise HTTPException(status_code=503, detail="Payments are not configured for subscription deletion")
    try:
        response = httpx.delete(
            f"{POLAR_API_BASE}/v1/subscriptions/{subscription_id}",
            headers={"Authorization": f"Bearer {settings.POLAR_ACCESS_TOKEN}"},
            timeout=10,
        )
        response.raise_for_status()
    except httpx.HTTPError as exc:
        logger.error("Polar revoke failed for subscription=%s: %s", subscription_id, exc)
        raise HTTPException(status_code=502, detail="Unable to cancel active subscription")


class CheckoutRequest(BaseModel):
    plan: Literal["plus_monthly", "plus_yearly"]


@router.post("/billing/checkout")
@limiter.limit("5/hour")
def create_checkout(
    request: Request,
    payload: CheckoutRequest,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Create a checkout using Polar product IDs and the current API contract."""
    if not settings.BILLING_ENABLED:
        raise HTTPException(status_code=503, detail="Paid upgrades are not currently enabled")
    if not settings.POLAR_ACCESS_TOKEN:
        raise HTTPException(status_code=503, detail="Payments not configured")

    product_id = (
        settings.POLAR_PLUS_YEARLY_PRODUCT_ID
        if payload.plan == "plus_yearly"
        else settings.POLAR_PLUS_MONTHLY_PRODUCT_ID
    )
    if not product_id:
        raise HTTPException(status_code=503, detail="Plan not configured")

    body = {
        "products": [product_id],
        "success_url": f"{settings.FRONTEND_URL}/settings/billing?upgraded=1",
        "external_customer_id": current_user.user_id,
        "metadata": {"user_id": current_user.user_id},
    }
    if current_user.email:
        body["customer_email"] = current_user.email
    try:
        response = httpx.post(
            f"{POLAR_API_BASE}/v1/checkouts",
            headers={"Authorization": f"Bearer {settings.POLAR_ACCESS_TOKEN}"},
            json=body,
            timeout=10,
        )
        response.raise_for_status()
        return {"checkout_url": response.json()["url"]}
    except (httpx.HTTPError, KeyError) as exc:
        logger.error("Polar checkout failed: %s", exc)
        raise HTTPException(status_code=502, detail="Failed to create checkout session")


@router.get("/billing/subscription")
def get_subscription(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    sub = db.get(Subscription, current_user.user_id)
    if sub is None:
        return {"plan": "free", "status": None, "current_period_end": None}
    return {
        "plan": sub.plan if _is_active_subscription(sub) else "free",
        "status": sub.status,
        "current_period_end": sub.current_period_end,
        "polar_subscription_id": sub.polar_subscription_id,
    }


@router.post("/webhooks/polar", status_code=200)
async def polar_webhook(request: Request, db: Session = Depends(get_db)):
    body = await request.body()
    event_id = _verify_polar_webhook(dict(request.headers), body)
    try:
        event = json.loads(body)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")
    if db.get(WebhookEvent, event_id):
        return {"ok": True, "duplicate": True}

    event_type = event.get("type", "")
    handled = {
        "subscription.created",
        "subscription.updated",
        "subscription.canceled",
        "subscription.revoked",
    }
    try:
        if event_type in handled:
            _upsert_subscription(db, event_type, event.get("data", {}))
        db.add(
            WebhookEvent(
                id=event_id,
                provider="polar",
                event_type=event_type,
                processed_at=utc_now_iso(),
            )
        )
        db.commit()
    except Exception as exc:
        db.rollback()
        logger.error("Polar webhook processing failed event=%s: %s", event_type, exc)
        raise HTTPException(status_code=500, detail="Webhook processing failed")
    return {"ok": True}
