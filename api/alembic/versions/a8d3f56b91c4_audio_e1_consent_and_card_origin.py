"""audio e1: user_audio_consents and notebook_cards.source_audio_entry_id

Revision ID: a8d3f56b91c4
Revises: e7c2a91f4d65
Create Date: 2026-05-29
"""

import sqlalchemy as sa

from alembic import op


revision = "a8d3f56b91c4"
down_revision = "e7c2a91f4d65"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_audio_consents",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("consent_version", sa.String(), nullable=False),
        sa.Column("accepted_at", sa.String(), nullable=False),
        sa.Column("accepted_user_agent", sa.String(), nullable=True),
    )
    op.create_index(
        "ix_user_audio_consents_user_id",
        "user_audio_consents",
        ["user_id"],
    )
    op.add_column(
        "notebook_cards",
        sa.Column("source_audio_entry_id", sa.String(), nullable=True),
    )
    op.create_index(
        "ix_notebook_cards_source_audio_entry_id",
        "notebook_cards",
        ["source_audio_entry_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_notebook_cards_source_audio_entry_id", "notebook_cards")
    op.drop_column("notebook_cards", "source_audio_entry_id")
    op.drop_index("ix_user_audio_consents_user_id", "user_audio_consents")
    op.drop_table("user_audio_consents")
