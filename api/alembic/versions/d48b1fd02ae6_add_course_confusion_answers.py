"""add course confusion answers

Revision ID: d48b1fd02ae6
Revises: c31f827a60ed
Create Date: 2026-05-26 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d48b1fd02ae6"
down_revision: Union[str, Sequence[str], None] = "c31f827a60ed"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("course_stream_entries", sa.Column("confusion_status", sa.String(), nullable=True))
    op.add_column("course_stream_entries", sa.Column("answer_status", sa.String(), nullable=True))
    op.add_column("course_stream_entries", sa.Column("answer_content", sa.Text(), nullable=True))
    op.add_column("course_stream_entries", sa.Column("answer_evidence", sa.JSON(), nullable=True))
    op.add_column("course_stream_entries", sa.Column("answer_job_id", sa.String(), nullable=True))
    op.add_column("course_stream_entries", sa.Column("answer_generated_at", sa.String(), nullable=True))
    op.create_index(
        op.f("ix_course_stream_entries_answer_job_id"),
        "course_stream_entries",
        ["answer_job_id"],
    )
    op.execute(
        "UPDATE course_stream_entries SET confusion_status = 'open' "
        "WHERE entry_type = 'question' AND confusion_status IS NULL"
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_course_stream_entries_answer_job_id"), table_name="course_stream_entries")
    op.drop_column("course_stream_entries", "answer_generated_at")
    op.drop_column("course_stream_entries", "answer_job_id")
    op.drop_column("course_stream_entries", "answer_evidence")
    op.drop_column("course_stream_entries", "answer_content")
    op.drop_column("course_stream_entries", "answer_status")
    op.drop_column("course_stream_entries", "confusion_status")
