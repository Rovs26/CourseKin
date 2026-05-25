from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.api.routes import billing, sources
from app.api.routes.admin import abuse_summary
from app.core.auth import CurrentUser
from app.core.config import settings
from app.core.utils import utc_now_iso
from app.db.database import Base
from app.db.models import Job, Project, Source, Subscription, UsageLog
from app.services import job_queue_service
from app.services.usage_service import record_usage, reserve_usage


@pytest.fixture()
def db():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    try:
        yield session
    finally:
        session.close()


def test_admin_abuse_summary_counts_failed_jobs(db):
    now = utc_now_iso()
    for index, status in enumerate(("failed", "failed", "completed")):
        db.add(
            Job(
                id=f"job-{index}",
                project_id="project-1",
                job_type="generate-reviewer",
                status=status,
                stage=status,
                attempts=1,
                created_at=now,
                updated_at=now,
            )
        )
    db.commit()

    result = abuse_summary(db, None)

    assert result["high_failure_ratio_24h"] == [
        {"project_id": "project-1", "total": 3, "failed": 2}
    ]


def test_url_fetch_validates_redirect_destinations(monkeypatch):
    redirect_response = MagicMock()
    redirect_response.is_redirect = True
    redirect_response.is_permanent_redirect = False
    redirect_response.headers = {"Location": "http://127.0.0.1/internal"}
    calls = []

    monkeypatch.setattr(sources.http_requests, "get", lambda *args, **kwargs: redirect_response)

    def validate(url: str):
        calls.append(url)
        if "127.0.0.1" in url:
            raise HTTPException(status_code=400, detail="private destination")

    monkeypatch.setattr(sources, "validate_url_safe", validate)

    with pytest.raises(HTTPException):
        sources._fetch_public_url("https://public.example/start")

    assert calls == ["https://public.example/start", "http://127.0.0.1/internal"]


def test_completed_usage_replaces_reserved_cost(db):
    reserve_usage(db, "user-1", "job-1")
    db.commit()
    reserved = db.query(UsageLog).one()
    assert reserved.model == "reserved"
    assert reserved.cost_usd > 0

    record_usage(db, "user-1", "job-1", "gpt-4.1-nano", 100, 25, 0.0001)

    rows = db.query(UsageLog).all()
    assert len(rows) == 1
    assert rows[0].model == "gpt-4.1-nano"
    assert rows[0].cost_usd == pytest.approx(0.0001)


def test_worker_claims_queued_job(monkeypatch, db):
    now = utc_now_iso()
    db.add(
        Project(
            id="project-1",
            title="Title",
            project_type="study",
            age_bracket="adult",
            learning_mode="standard",
            field_of_study="test",
            source_mode="text",
            user_id="user-1",
            created_at=now,
            updated_at=now,
        )
    )
    db.add(
        Source(
            id="source-1",
            project_id="project-1",
            title="Source",
            type="text",
            status="processed",
            text="Useful source content",
            created_at=now,
            updated_at=now,
        )
    )
    db.add(
        Job(
            id="job-1",
            project_id="project-1",
            source_id="source-1",
            user_id="user-1",
            job_type="generate-reviewer",
            status="queued",
            stage="queued",
            generation_options={"sections": ["summary"], "merge_mode": "replace"},
            attempts=0,
            created_at=now,
            updated_at=now,
        )
    )
    db.commit()

    session_factory = sessionmaker(bind=db.bind)
    captured = {}
    monkeypatch.setattr(job_queue_service, "SessionLocal", session_factory)
    monkeypatch.setattr(
        job_queue_service,
        "run_generation_in_background",
        lambda **kwargs: captured.update(kwargs),
    )

    assert job_queue_service.process_next_queued_job() is True
    updated = db.get(Job, "job-1")
    db.refresh(updated)
    assert updated.status == "processing"
    assert updated.attempts == 1
    assert captured["job_id"] == "job-1"
    assert captured["sections"] == ["summary"]


def test_polar_checkout_uses_products_contract(monkeypatch):
    captured = {}

    class Response:
        def raise_for_status(self):
            return None

        def json(self):
            return {"url": "https://checkout.polar.sh/session"}

    monkeypatch.setattr(settings, "BILLING_ENABLED", True)
    monkeypatch.setattr(settings, "POLAR_ACCESS_TOKEN", "token")
    monkeypatch.setattr(settings, "POLAR_PLUS_MONTHLY_PRODUCT_ID", "prod_monthly")
    monkeypatch.setattr(settings, "FRONTEND_URL", "https://reviewflow.app")

    def post(url, headers, json, timeout):
        captured.update({"url": url, "json": json})
        return Response()

    monkeypatch.setattr(billing.httpx, "post", post)
    user = CurrentUser("user-1", "user@example.com", None, True)

    result = billing.create_checkout.__wrapped__(
        MagicMock(),
        billing.CheckoutRequest(plan="plus_monthly"),
        user,
    )

    assert result["checkout_url"] == "https://checkout.polar.sh/session"
    assert captured["url"].endswith("/v1/checkouts")
    assert captured["json"]["products"] == ["prod_monthly"]
    assert captured["json"]["external_customer_id"] == "user-1"


def test_polar_revocation_is_terminal_for_deletion(monkeypatch, db):
    monkeypatch.setattr(settings, "POLAR_PLUS_MONTHLY_PRODUCT_ID", "prod_monthly")
    billing._upsert_subscription(
        db,
        "subscription.revoked",
        {
            "id": "sub-1",
            "customer_id": "customer-1",
            "product_id": "prod_monthly",
            "status": "canceled",
            "current_period_end": "2099-01-01T00:00:00Z",
            "metadata": {"user_id": "user-1"},
        },
    )
    db.commit()

    assert db.get(Subscription, "user-1").status == "revoked"


def test_production_configuration_rejects_sqlite_without_safeguards(monkeypatch):
    monkeypatch.setattr(settings, "APP_ENV", "production")
    monkeypatch.setattr(settings, "DATABASE_URL", "sqlite:///./data/reviewflow.db")

    with pytest.raises(RuntimeError, match="PostgreSQL DATABASE_URL"):
        settings.validate_production()
