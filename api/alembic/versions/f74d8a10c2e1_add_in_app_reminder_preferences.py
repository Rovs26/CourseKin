"""add in app reminder preferences

Revision ID: f74d8a10c2e1
Revises: e38f6a2d9c04
Create Date: 2026-05-26 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f74d8a10c2e1"
down_revision: Union[str, Sequence[str], None] = "e38f6a2d9c04"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "projects",
        sa.Column("reminders_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.add_column(
        "projects",
        sa.Column("reminder_lead_days", sa.Integer(), nullable=False, server_default="3"),
    )


def downgrade() -> None:
    op.drop_column("projects", "reminder_lead_days")
    op.drop_column("projects", "reminders_enabled")
