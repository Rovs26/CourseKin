"""add preparation runway milestones

Revision ID: e38f6a2d9c04
Revises: d52e4f0610aa
Create Date: 2026-05-26 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e38f6a2d9c04"
down_revision: Union[str, Sequence[str], None] = "d52e4f0610aa"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "preparation_milestones",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("project_id", sa.String(), nullable=False),
        sa.Column("obligation_id", sa.String(), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("milestone_type", sa.String(), nullable=False),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("scheduled_date", sa.String(), nullable=False),
        sa.Column("estimated_minutes", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("completed_at", sa.String(), nullable=True),
        sa.Column("created_at", sa.String(), nullable=False),
        sa.Column("updated_at", sa.String(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_preparation_milestones_id", "preparation_milestones", ["id"], unique=False)
    op.create_index(
        "ix_preparation_milestones_project_id",
        "preparation_milestones",
        ["project_id"],
        unique=False,
    )
    op.create_index(
        "ix_preparation_milestones_obligation_id",
        "preparation_milestones",
        ["obligation_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_preparation_milestones_obligation_id", table_name="preparation_milestones")
    op.drop_index("ix_preparation_milestones_project_id", table_name="preparation_milestones")
    op.drop_index("ix_preparation_milestones_id", table_name="preparation_milestones")
    op.drop_table("preparation_milestones")
