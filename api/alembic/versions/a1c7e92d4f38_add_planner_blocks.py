"""add planner_blocks for the natural-language day planner

Revision ID: a1c7e92d4f38
Revises: f1b8d3e0a72c
Create Date: 2026-06-01 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a1c7e92d4f38"
down_revision: Union[str, Sequence[str], None] = "f1b8d3e0a72c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "planner_blocks",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("project_id", sa.String(), nullable=True),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("kind", sa.String(), nullable=False, server_default="personal"),
        sa.Column("scheduled_date", sa.String(), nullable=False),
        sa.Column("start_time", sa.String(), nullable=True),
        sa.Column(
            "duration_minutes", sa.Integer(), nullable=False, server_default="30"
        ),
        sa.Column("status", sa.String(), nullable=False, server_default="planned"),
        sa.Column("origin", sa.String(), nullable=False, server_default="planner"),
        sa.Column("created_at", sa.String(), nullable=False),
        sa.Column("updated_at", sa.String(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_planner_blocks_user_id", "planner_blocks", ["user_id"]
    )
    op.create_index(
        "ix_planner_blocks_project_id", "planner_blocks", ["project_id"]
    )
    op.create_index(
        "ix_planner_blocks_scheduled_date", "planner_blocks", ["scheduled_date"]
    )


def downgrade() -> None:
    op.drop_index("ix_planner_blocks_scheduled_date", table_name="planner_blocks")
    op.drop_index("ix_planner_blocks_project_id", table_name="planner_blocks")
    op.drop_index("ix_planner_blocks_user_id", table_name="planner_blocks")
    op.drop_table("planner_blocks")
