"""add audio_payload column to course_stream_entries

Revision ID: b46c712fa029
Revises: a8d3f56b91c4
Create Date: 2026-05-29
"""

import sqlalchemy as sa

from alembic import op


revision = "b46c712fa029"
down_revision = "a8d3f56b91c4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "course_stream_entries",
        sa.Column("audio_payload", sa.JSON(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("course_stream_entries", "audio_payload")
