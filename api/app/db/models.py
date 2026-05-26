from sqlalchemy import String, Text, Integer, JSON, Float, Boolean, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String, primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String, nullable=False)
    project_type: Mapped[str] = mapped_column(String, nullable=False)
    age_bracket: Mapped[str] = mapped_column(String, nullable=False)
    learning_mode: Mapped[str] = mapped_column(String, nullable=False)
    field_of_study: Mapped[str] = mapped_column(String, nullable=False)
    source_mode: Mapped[str] = mapped_column(String, nullable=False)
    template_id: Mapped[str | None] = mapped_column(String, nullable=True)
    course_code: Mapped[str | None] = mapped_column(String, nullable=True)
    term: Mapped[str | None] = mapped_column(String, nullable=True)
    instructor: Mapped[str | None] = mapped_column(String, nullable=True)
    meeting_schedule: Mapped[str | None] = mapped_column(Text, nullable=True)
    user_id: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    created_at: Mapped[str] = mapped_column(String, nullable=False)
    updated_at: Mapped[str] = mapped_column(String, nullable=False)


class Source(Base):
    __tablename__ = "sources"

    id: Mapped[str] = mapped_column(String, primary_key=True, index=True)
    project_id: Mapped[str] = mapped_column(String, index=True, nullable=False)
    title: Mapped[str] = mapped_column(String, nullable=False)
    type: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False)
    text: Mapped[str | None] = mapped_column(Text, nullable=True)
    url: Mapped[str | None] = mapped_column(Text, nullable=True)
    file_name: Mapped[str | None] = mapped_column(String, nullable=True)
    file_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    storage_key: Mapped[str | None] = mapped_column(String, nullable=True)
    purpose: Mapped[str] = mapped_column(String, nullable=False, default="study_material")
    created_at: Mapped[str] = mapped_column(String, nullable=False)
    updated_at: Mapped[str] = mapped_column(String, nullable=False)


class SourceChunk(Base):
    __tablename__ = "source_chunks"

    id: Mapped[str] = mapped_column(String, primary_key=True, index=True)
    source_id: Mapped[str] = mapped_column(String, index=True, nullable=False)
    project_id: Mapped[str] = mapped_column(String, index=True, nullable=False)
    ordinal: Mapped[int] = mapped_column(Integer, nullable=False)
    page_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[str] = mapped_column(String, nullable=False)


class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[str] = mapped_column(String, primary_key=True, index=True)
    project_id: Mapped[str] = mapped_column(String, index=True, nullable=False)
    source_id: Mapped[str | None] = mapped_column(String, index=True, nullable=True)
    user_id: Mapped[str | None] = mapped_column(String, index=True, nullable=True)
    job_type: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False)
    stage: Mapped[str] = mapped_column(String, nullable=False)
    generation_options: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[str] = mapped_column(String, nullable=False)
    updated_at: Mapped[str] = mapped_column(String, nullable=False)


class Reviewer(Base):
    __tablename__ = "reviewers"

    project_id: Mapped[str] = mapped_column(String, primary_key=True, index=True)
    source_id: Mapped[str | None] = mapped_column(String, index=True, nullable=True)
    status: Mapped[str] = mapped_column(String, nullable=False)
    output_type: Mapped[str] = mapped_column(String, nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    content_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[str | None] = mapped_column(String, nullable=True)
    updated_at: Mapped[str | None] = mapped_column(String, nullable=True)


class ReviewerFeedback(Base):
    __tablename__ = "reviewer_feedback"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "project_id",
            "reviewer_version",
            "section",
            "item_index",
            name="uq_reviewer_feedback_item",
        ),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, index=True)
    user_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    project_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    reviewer_version: Mapped[int] = mapped_column(Integer, nullable=False)
    section: Mapped[str] = mapped_column(String, nullable=False)
    item_index: Mapped[int] = mapped_column(Integer, nullable=False)
    rating: Mapped[str] = mapped_column(String, nullable=False)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[str] = mapped_column(String, nullable=False)
    updated_at: Mapped[str] = mapped_column(String, nullable=False)


class CourseObligation(Base):
    __tablename__ = "course_obligations"

    id: Mapped[str] = mapped_column(String, primary_key=True, index=True)
    project_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    source_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    title: Mapped[str] = mapped_column(String, nullable=False)
    obligation_type: Mapped[str] = mapped_column(String, nullable=False)
    due_date: Mapped[str | None] = mapped_column(String, nullable=True)
    details: Mapped[str | None] = mapped_column(Text, nullable=True)
    grading_criteria: Mapped[str | None] = mapped_column(Text, nullable=True)
    confidence: Mapped[str] = mapped_column(String, nullable=False)
    uncertain_fields: Mapped[list | None] = mapped_column(JSON, nullable=True)
    status: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[str] = mapped_column(String, nullable=False)
    updated_at: Mapped[str] = mapped_column(String, nullable=False)


class UsageLog(Base):
    __tablename__ = "usage_log"

    id: Mapped[str] = mapped_column(String, primary_key=True, index=True)
    user_id: Mapped[str] = mapped_column(String, index=True, nullable=False)
    job_id: Mapped[str | None] = mapped_column(String, index=True, nullable=True)
    model: Mapped[str] = mapped_column(String, nullable=False)
    prompt_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    completion_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    cost_usd: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    cached: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[str] = mapped_column(String, nullable=False, index=True)


class BannedUser(Base):
    __tablename__ = "banned_users"

    user_id: Mapped[str] = mapped_column(String, primary_key=True)
    reason: Mapped[str] = mapped_column(String, nullable=False)
    banned_at: Mapped[str] = mapped_column(String, nullable=False)
    banned_by: Mapped[str] = mapped_column(String, nullable=False)  # admin email


class Subscription(Base):
    __tablename__ = "subscriptions"

    # Primary key is our Clerk user_id — one active subscription row per user.
    user_id: Mapped[str] = mapped_column(String, primary_key=True)
    polar_customer_id: Mapped[str] = mapped_column(String, index=True, nullable=False)
    polar_subscription_id: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    plan: Mapped[str] = mapped_column(String, nullable=False)   # "plus_monthly" / "plus_yearly"
    status: Mapped[str] = mapped_column(String, nullable=False)  # "active", "canceled", "past_due"
    current_period_end: Mapped[str] = mapped_column(String, nullable=False)  # ISO UTC string
    created_at: Mapped[str] = mapped_column(String, nullable=False)
    updated_at: Mapped[str] = mapped_column(String, nullable=False)


class GenerationCache(Base):
    __tablename__ = "generation_cache"
    __table_args__ = (UniqueConstraint("cache_key", name="uq_generation_cache_key"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, index=True)
    user_id: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    cache_key: Mapped[str] = mapped_column(String, nullable=False, index=True)
    content_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    model: Mapped[str] = mapped_column(String, nullable=False)
    prompt_version: Mapped[str] = mapped_column(String, nullable=False)
    hit_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[str] = mapped_column(String, nullable=False, index=True)
    last_hit_at: Mapped[str | None] = mapped_column(String, nullable=True)


class WebhookEvent(Base):
    __tablename__ = "webhook_events"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    provider: Mapped[str] = mapped_column(String, nullable=False, index=True)
    event_type: Mapped[str] = mapped_column(String, nullable=False)
    processed_at: Mapped[str] = mapped_column(String, nullable=False)
