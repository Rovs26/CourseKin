"""add source chunks for cited reviewer evidence

Revision ID: f21a9e0c4b72
Revises: e84ab2c97d10
Create Date: 2026-05-25 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f21a9e0c4b72"
down_revision: Union[str, Sequence[str], None] = "e84ab2c97d10"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "source_chunks",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("source_id", sa.String(), nullable=False),
        sa.Column("project_id", sa.String(), nullable=False),
        sa.Column("ordinal", sa.Integer(), nullable=False),
        sa.Column("page_number", sa.Integer(), nullable=True),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("created_at", sa.String(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_source_chunks_id", "source_chunks", ["id"], unique=False)
    op.create_index("ix_source_chunks_source_id", "source_chunks", ["source_id"], unique=False)
    op.create_index("ix_source_chunks_project_id", "source_chunks", ["project_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_source_chunks_project_id", table_name="source_chunks")
    op.drop_index("ix_source_chunks_source_id", table_name="source_chunks")
    op.drop_index("ix_source_chunks_id", table_name="source_chunks")
    op.drop_table("source_chunks")
