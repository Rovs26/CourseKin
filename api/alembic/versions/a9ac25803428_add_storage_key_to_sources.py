"""add storage_key to sources

Revision ID: a9ac25803428
Revises: c183254cb1cd
Create Date: 2026-04-21 20:38:44.379016

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a9ac25803428'
down_revision: Union[str, Sequence[str], None] = 'c183254cb1cd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("sources", sa.Column("storage_key", sa.String(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("sources", "storage_key")
