"""add per-question results to mock exam sessions

Revision ID: f1b8d3e0a72c
Revises: f0a7c3b921de
Create Date: 2026-05-31 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f1b8d3e0a72c"
down_revision: Union[str, Sequence[str], None] = "f0a7c3b921de"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "mock_exam_sessions",
        sa.Column("per_question_results", sa.JSON(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("mock_exam_sessions", "per_question_results")
