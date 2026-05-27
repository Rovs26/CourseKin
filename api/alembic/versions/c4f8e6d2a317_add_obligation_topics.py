"""add topics column to course_obligations for coverage mapping

Revision ID: c4f8e6d2a317
Revises: b8d3e74a2c91
Create Date: 2026-05-27 14:55:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c4f8e6d2a317"
down_revision: Union[str, Sequence[str], None] = "b8d3e74a2c91"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "course_obligations", sa.Column("topics", sa.JSON(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("course_obligations", "topics")
