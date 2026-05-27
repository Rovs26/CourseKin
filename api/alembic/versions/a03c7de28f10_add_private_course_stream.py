"""add private course stream

Revision ID: a03c7de28f10
Revises: f74d8a10c2e1
Create Date: 2026-05-26 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a03c7de28f10"
down_revision: Union[str, Sequence[str], None] = "f74d8a10c2e1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "course_stream_entries",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("project_id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("entry_type", sa.String(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("created_at", sa.String(), nullable=False),
        sa.Column("updated_at", sa.String(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_course_stream_entries_id"), "course_stream_entries", ["id"])
    op.create_index(
        op.f("ix_course_stream_entries_project_id"),
        "course_stream_entries",
        ["project_id"],
    )
    op.create_index(
        op.f("ix_course_stream_entries_user_id"),
        "course_stream_entries",
        ["user_id"],
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_course_stream_entries_user_id"), table_name="course_stream_entries")
    op.drop_index(op.f("ix_course_stream_entries_project_id"), table_name="course_stream_entries")
    op.drop_index(op.f("ix_course_stream_entries_id"), table_name="course_stream_entries")
    op.drop_table("course_stream_entries")
