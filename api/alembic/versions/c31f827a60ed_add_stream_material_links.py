"""add stream material links

Revision ID: c31f827a60ed
Revises: b19f4c52e760
Create Date: 2026-05-26 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c31f827a60ed"
down_revision: Union[str, Sequence[str], None] = "b19f4c52e760"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "course_stream_entry_sources",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("entry_id", sa.String(), nullable=False),
        sa.Column("source_id", sa.String(), nullable=False),
        sa.Column("project_id", sa.String(), nullable=False),
        sa.Column("ordinal", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.String(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("entry_id", "source_id", name="uq_course_stream_entry_source"),
    )
    op.create_index(op.f("ix_course_stream_entry_sources_id"), "course_stream_entry_sources", ["id"])
    op.create_index(
        op.f("ix_course_stream_entry_sources_entry_id"),
        "course_stream_entry_sources",
        ["entry_id"],
    )
    op.create_index(
        op.f("ix_course_stream_entry_sources_source_id"),
        "course_stream_entry_sources",
        ["source_id"],
    )
    op.create_index(
        op.f("ix_course_stream_entry_sources_project_id"),
        "course_stream_entry_sources",
        ["project_id"],
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_course_stream_entry_sources_project_id"), table_name="course_stream_entry_sources")
    op.drop_index(op.f("ix_course_stream_entry_sources_source_id"), table_name="course_stream_entry_sources")
    op.drop_index(op.f("ix_course_stream_entry_sources_entry_id"), table_name="course_stream_entry_sources")
    op.drop_index(op.f("ix_course_stream_entry_sources_id"), table_name="course_stream_entry_sources")
    op.drop_table("course_stream_entry_sources")
