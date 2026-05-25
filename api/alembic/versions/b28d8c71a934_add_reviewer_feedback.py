"""add reviewer evidence feedback

Revision ID: b28d8c71a934
Revises: f21a9e0c4b72
Create Date: 2026-05-25 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b28d8c71a934"
down_revision: Union[str, Sequence[str], None] = "f21a9e0c4b72"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "reviewer_feedback",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("project_id", sa.String(), nullable=False),
        sa.Column("reviewer_version", sa.Integer(), nullable=False),
        sa.Column("section", sa.String(), nullable=False),
        sa.Column("item_index", sa.Integer(), nullable=False),
        sa.Column("rating", sa.String(), nullable=False),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column("created_at", sa.String(), nullable=False),
        sa.Column("updated_at", sa.String(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_id",
            "project_id",
            "reviewer_version",
            "section",
            "item_index",
            name="uq_reviewer_feedback_item",
        ),
    )
    op.create_index("ix_reviewer_feedback_id", "reviewer_feedback", ["id"], unique=False)
    op.create_index(
        "ix_reviewer_feedback_user_id", "reviewer_feedback", ["user_id"], unique=False
    )
    op.create_index(
        "ix_reviewer_feedback_project_id", "reviewer_feedback", ["project_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index("ix_reviewer_feedback_project_id", table_name="reviewer_feedback")
    op.drop_index("ix_reviewer_feedback_user_id", table_name="reviewer_feedback")
    op.drop_index("ix_reviewer_feedback_id", table_name="reviewer_feedback")
    op.drop_table("reviewer_feedback")
