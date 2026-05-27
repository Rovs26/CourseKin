"""add course planning validation fields

Revision ID: b19f4c52e760
Revises: a03c7de28f10
Create Date: 2026-05-26 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b19f4c52e760"
down_revision: Union[str, Sequence[str], None] = "a03c7de28f10"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("course_obligations", sa.Column("proposal_snapshot", sa.JSON(), nullable=True))
    op.add_column("course_obligations", sa.Column("reviewed_snapshot", sa.JSON(), nullable=True))
    op.add_column("course_obligations", sa.Column("reviewed_at", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("course_obligations", "reviewed_at")
    op.drop_column("course_obligations", "reviewed_snapshot")
    op.drop_column("course_obligations", "proposal_snapshot")
