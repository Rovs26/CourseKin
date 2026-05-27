"""add accessible coaching stream

Revision ID: e52d0ad8b741
Revises: d48b1fd02ae6
Create Date: 2026-05-26 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e52d0ad8b741"
down_revision: Union[str, Sequence[str], None] = "d48b1fd02ae6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("course_stream_entries", sa.Column("answer_mode", sa.String(), nullable=True))
    op.add_column("course_stream_entries", sa.Column("coaching_mode", sa.String(), nullable=True))
    op.add_column("course_stream_entries", sa.Column("related_obligation_id", sa.String(), nullable=True))
    op.add_column("course_stream_entries", sa.Column("coaching_context", sa.JSON(), nullable=True))
    op.add_column("course_stream_entries", sa.Column("coaching_status", sa.String(), nullable=True))
    op.add_column("course_stream_entries", sa.Column("coaching_output", sa.JSON(), nullable=True))
    op.add_column("course_stream_entries", sa.Column("coaching_evidence", sa.JSON(), nullable=True))
    op.add_column("course_stream_entries", sa.Column("coaching_job_id", sa.String(), nullable=True))
    op.add_column("course_stream_entries", sa.Column("coaching_generated_at", sa.String(), nullable=True))
    op.create_index(
        op.f("ix_course_stream_entries_related_obligation_id"),
        "course_stream_entries",
        ["related_obligation_id"],
    )
    op.create_index(
        op.f("ix_course_stream_entries_coaching_job_id"),
        "course_stream_entries",
        ["coaching_job_id"],
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_course_stream_entries_coaching_job_id"), table_name="course_stream_entries")
    op.drop_index(op.f("ix_course_stream_entries_related_obligation_id"), table_name="course_stream_entries")
    op.drop_column("course_stream_entries", "coaching_generated_at")
    op.drop_column("course_stream_entries", "coaching_job_id")
    op.drop_column("course_stream_entries", "coaching_evidence")
    op.drop_column("course_stream_entries", "coaching_output")
    op.drop_column("course_stream_entries", "coaching_status")
    op.drop_column("course_stream_entries", "coaching_context")
    op.drop_column("course_stream_entries", "related_obligation_id")
    op.drop_column("course_stream_entries", "coaching_mode")
    op.drop_column("course_stream_entries", "answer_mode")
