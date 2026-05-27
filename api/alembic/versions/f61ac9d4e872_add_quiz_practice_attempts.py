"""add quiz practice attempts

Revision ID: f61ac9d4e872
Revises: e52d0ad8b741
Create Date: 2026-05-27 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f61ac9d4e872"
down_revision: Union[str, Sequence[str], None] = "e52d0ad8b741"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "quiz_attempts",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("project_id", sa.String(), nullable=False),
        sa.Column("reviewer_version", sa.Integer(), nullable=False),
        sa.Column("results", sa.JSON(), nullable=False),
        sa.Column("total_questions", sa.Integer(), nullable=False),
        sa.Column("correct_answers", sa.Integer(), nullable=False),
        sa.Column("score_percent", sa.Integer(), nullable=False),
        sa.Column("duration_seconds", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.String(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_quiz_attempts_id"), "quiz_attempts", ["id"])
    op.create_index(op.f("ix_quiz_attempts_user_id"), "quiz_attempts", ["user_id"])
    op.create_index(op.f("ix_quiz_attempts_project_id"), "quiz_attempts", ["project_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_quiz_attempts_project_id"), table_name="quiz_attempts")
    op.drop_index(op.f("ix_quiz_attempts_user_id"), table_name="quiz_attempts")
    op.drop_index(op.f("ix_quiz_attempts_id"), table_name="quiz_attempts")
    op.drop_table("quiz_attempts")
