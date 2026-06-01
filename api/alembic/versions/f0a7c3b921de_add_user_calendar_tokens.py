"""add user_calendar_tokens for the .ics subscription feed

Revision ID: f0a7c3b921de
Revises: c0d92f4ab108
Create Date: 2026-05-31
"""

import sqlalchemy as sa

from alembic import op


revision = "f0a7c3b921de"
down_revision = "c0d92f4ab108"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_calendar_tokens",
        sa.Column("user_id", sa.String(), primary_key=True),
        sa.Column("token", sa.String(), nullable=False),
        sa.Column("created_at", sa.String(), nullable=False),
        sa.Column("updated_at", sa.String(), nullable=False),
    )
    op.create_index(
        "ix_user_calendar_tokens_token",
        "user_calendar_tokens",
        ["token"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ix_user_calendar_tokens_token", table_name="user_calendar_tokens")
    op.drop_table("user_calendar_tokens")
