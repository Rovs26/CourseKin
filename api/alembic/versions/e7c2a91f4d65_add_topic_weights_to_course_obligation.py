"""add topic_weights to course_obligations

Revision ID: e7c2a91f4d65
Revises: d51a3b7e9f04
Create Date: 2026-05-29
"""

import sqlalchemy as sa

from alembic import op


revision = "e7c2a91f4d65"
down_revision = "d51a3b7e9f04"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "course_obligations",
        sa.Column("topic_weights", sa.JSON(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("course_obligations", "topic_weights")
