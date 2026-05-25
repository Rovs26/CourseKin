"""harden jobs, cache ownership, and webhook processing

Revision ID: e84ab2c97d10
Revises: d4f2a8bc91e3
Create Date: 2026-05-25 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e84ab2c97d10"
down_revision: Union[str, Sequence[str], None] = "d4f2a8bc91e3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("jobs", sa.Column("user_id", sa.String(), nullable=True))
    op.add_column("jobs", sa.Column("generation_options", sa.JSON(), nullable=True))
    op.add_column("jobs", sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"))
    op.create_index("ix_jobs_user_id", "jobs", ["user_id"], unique=False)

    # Legacy global cache rows cannot be erased when a user deletes their data.
    # Discard them before switching to per-user cache ownership.
    op.execute("DELETE FROM generation_cache")
    op.add_column("generation_cache", sa.Column("user_id", sa.String(), nullable=True))
    op.create_index("ix_generation_cache_user_id", "generation_cache", ["user_id"], unique=False)

    op.create_table(
        "webhook_events",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("provider", sa.String(), nullable=False),
        sa.Column("event_type", sa.String(), nullable=False),
        sa.Column("processed_at", sa.String(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_webhook_events_provider", "webhook_events", ["provider"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_webhook_events_provider", table_name="webhook_events")
    op.drop_table("webhook_events")
    op.drop_index("ix_generation_cache_user_id", table_name="generation_cache")
    op.drop_column("generation_cache", "user_id")
    op.drop_index("ix_jobs_user_id", table_name="jobs")
    op.drop_column("jobs", "attempts")
    op.drop_column("jobs", "generation_options")
    op.drop_column("jobs", "user_id")
