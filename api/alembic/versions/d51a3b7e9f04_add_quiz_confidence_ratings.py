"""add quiz confidence ratings

Revision ID: d51a3b7e9f04
Revises: c4f8e6d2a317
Create Date: 2026-05-29 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d51a3b7e9f04"
down_revision: Union[str, Sequence[str], None] = "c4f8e6d2a317"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "quiz_attempts",
        sa.Column("confidence_before", sa.Integer(), nullable=True),
    )
    op.add_column(
        "quiz_attempts",
        sa.Column("confidence_after", sa.Integer(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("quiz_attempts", "confidence_after")
    op.drop_column("quiz_attempts", "confidence_before")
