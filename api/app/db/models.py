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
    reminders_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    reminder_lead_days: Mapped[int] = mapped_column(Integer, nullable=False, default=3)
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


class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"

    id: Mapped[str] = mapped_column(String, primary_key=True, index=True)
    user_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    project_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    reviewer_version: Mapped[int] = mapped_column(Integer, nullable=False)
    results: Mapped[list] = mapped_column(JSON, nullable=False)
    total_questions: Mapped[int] = mapped_column(Integer, nullable=False)
    correct_answers: Mapped[int] = mapped_column(Integer, nullable=False)
    score_percent: Mapped[int] = mapped_column(Integer, nullable=False)
    duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[str] = mapped_column(String, nullable=False)


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
    proposal_snapshot: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    reviewed_snapshot: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    reviewed_at: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[str] = mapped_column(String, nullable=False)
    updated_at: Mapped[str] = mapped_column(String, nullable=False)


class PreparationMilestone(Base):
    __tablename__ = "preparation_milestones"

    id: Mapped[str] = mapped_column(String, primary_key=True, index=True)
    project_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    obligation_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    title: Mapped[str] = mapped_column(String, nullable=False)
    milestone_type: Mapped[str] = mapped_column(String, nullable=False)
    sequence: Mapped[int] = mapped_column(Integer, nullable=False)
    scheduled_date: Mapped[str] = mapped_column(String, nullable=False)
    estimated_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False)
    completed_at: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[str] = mapped_column(String, nullable=False)
    updated_at: Mapped[str] = mapped_column(String, nullable=False)


class CourseTask(Base):
    __tablename__ = "course_tasks"

    id: Mapped[str] = mapped_column(String, primary_key=True, index=True)
    user_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    project_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    parent_task_id: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    title: Mapped[str] = mapped_column(String, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    due_date: Mapped[str | None] = mapped_column(String, nullable=True)
    priority: Mapped[str] = mapped_column(String, nullable=False, default="medium")
    status: Mapped[str] = mapped_column(String, nullable=False, default="open")
    origin: Mapped[str] = mapped_column(String, nullable=False, default="student")
    tags: Mapped[list | None] = mapped_column(JSON, nullable=True)
    recurrence_rule: Mapped[str | None] = mapped_column(String, nullable=True)
    recurrence_parent_id: Mapped[str | None] = mapped_column(String, nullable=True)
    focus_seconds_total: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    completed_at: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[str] = mapped_column(String, nullable=False)
    updated_at: Mapped[str] = mapped_column(String, nullable=False)


class TaskFocusSession(Base):
    __tablename__ = "task_focus_sessions"

    id: Mapped[str] = mapped_column(String, primary_key=True, index=True)
    task_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    user_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    project_id: Mapped[str] = mapped_column(String, nullable=False)
    started_at: Mapped[str] = mapped_column(String, nullable=False)
    ended_at: Mapped[str | None] = mapped_column(String, nullable=True)
    duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)


class CourseStreamEntry(Base):
    __tablename__ = "course_stream_entries"

    id: Mapped[str] = mapped_column(String, primary_key=True, index=True)
    project_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    user_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    entry_type: Mapped[str] = mapped_column(String, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    confusion_status: Mapped[str | None] = mapped_column(String, nullable=True)
    answer_status: Mapped[str | None] = mapped_column(String, nullable=True)
    answer_mode: Mapped[str | None] = mapped_column(String, nullable=True)
    answer_content: Mapped[str | None] = mapped_column(Text, nullable=True)
    answer_evidence: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    answer_job_id: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    answer_generated_at: Mapped[str | None] = mapped_column(String, nullable=True)
    coaching_mode: Mapped[str | None] = mapped_column(String, nullable=True)
    related_obligation_id: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    coaching_context: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    coaching_status: Mapped[str | None] = mapped_column(String, nullable=True)
    coaching_output: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    coaching_evidence: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    coaching_job_id: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    coaching_generated_at: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[str] = mapped_column(String, nullable=False)
    updated_at: Mapped[str] = mapped_column(String, nullable=False)


class CourseStreamEntrySource(Base):
    __tablename__ = "course_stream_entry_sources"
    __table_args__ = (
        UniqueConstraint("entry_id", "source_id", name="uq_course_stream_entry_source"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, index=True)
    entry_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    source_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    project_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    ordinal: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[str] = mapped_column(String, nullable=False)


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
