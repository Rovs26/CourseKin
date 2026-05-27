"""add notebook cards (study cards convertible from stream entries)

Revision ID: b8d3e74a2c91
Revises: a7c2e91f4d83
Create Date: 2026-05-27 14:30:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b8d3e74a2c91"
down_revision: Union[str, Sequence[str], None] = "a7c2e91f4d83"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "notebook_cards",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("project_id", sa.String(), nullable=False),
        sa.Column("source_stream_entry_id", sa.String(), nullable=True),
        sa.Column("origin", sa.String(), nullable=False, server_default="manual"),
        sa.Column("front", sa.Text(), nullable=False),
        sa.Column("back", sa.Text(), nullable=True),
        sa.Column("tags", sa.JSON(), nullable=True),
        sa.Column(
            "ease_factor", sa.Float(), nullable=False, server_default="2.5"
        ),
        sa.Column(
            "interval_days", sa.Integer(), nullable=False, server_default="0"
        ),
        sa.Column(
            "repetitions", sa.Integer(), nullable=False, server_default="0"
        ),
        sa.Column("due_date", sa.String(), nullable=True),
        sa.Column("last_reviewed_at", sa.String(), nullable=True),
        sa.Column("last_quality", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.String(), nullable=False),
        sa.Column("updated_at", sa.String(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_notebook_cards_id"), "notebook_cards", ["id"])
    op.create_index(op.f("ix_notebook_cards_user_id"), "notebook_cards", ["user_id"])
    op.create_index(
        op.f("ix_notebook_cards_project_id"), "notebook_cards", ["project_id"]
    )
    op.create_index(
        "ix_notebook_cards_due_date", "notebook_cards", ["due_date"]
    )
    op.create_index(
        "ix_notebook_cards_source_stream_entry_id",
        "notebook_cards",
        ["source_stream_entry_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_notebook_cards_source_stream_entry_id", table_name="notebook_cards"
    )
    op.drop_index("ix_notebook_cards_due_date", table_name="notebook_cards")
    op.drop_index(op.f("ix_notebook_cards_project_id"), table_name="notebook_cards")
    op.drop_index(op.f("ix_notebook_cards_user_id"), table_name="notebook_cards")
    op.drop_index(op.f("ix_notebook_cards_id"), table_name="notebook_cards")
    op.drop_table("notebook_cards")
