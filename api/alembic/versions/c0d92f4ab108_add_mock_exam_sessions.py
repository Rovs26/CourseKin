"""add mock_exam_sessions for Phase I (timed mock exams)

Revision ID: c0d92f4ab108
Revises: b46c712fa029
Create Date: 2026-05-30
"""

import sqlalchemy as sa

from alembic import op


revision = "c0d92f4ab108"
down_revision = "b46c712fa029"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "mock_exam_sessions",
        sa.Column("id", sa.String(), primary_key=True, index=True),
        sa.Column("project_id", sa.String(), nullable=False, index=True),
        sa.Column("user_id", sa.String(), nullable=False, index=True),
        sa.Column("obligation_id", sa.String(), nullable=True, index=True),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("difficulty", sa.String(), nullable=False),
        sa.Column("target_minutes", sa.Integer(), nullable=False),
        sa.Column("question_count", sa.Integer(), nullable=False),
        sa.Column("questions", sa.JSON(), nullable=False),
        sa.Column("answers", sa.JSON(), nullable=True),
        sa.Column("per_topic_results", sa.JSON(), nullable=True),
        sa.Column("correct_count", sa.Integer(), nullable=True),
        sa.Column("total_count", sa.Integer(), nullable=False),
        sa.Column("score_percent", sa.Integer(), nullable=True),
        sa.Column("started_at", sa.String(), nullable=False),
        sa.Column("deadline_at", sa.String(), nullable=False),
        sa.Column("submitted_at", sa.String(), nullable=True),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("confidence_before", sa.Integer(), nullable=True),
        sa.Column("confidence_after", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.String(), nullable=False),
        sa.Column("updated_at", sa.String(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("mock_exam_sessions")
