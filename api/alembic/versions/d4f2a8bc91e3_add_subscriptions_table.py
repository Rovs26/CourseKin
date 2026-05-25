"""add subscriptions table

Revision ID: d4f2a8bc91e3
Revises: c22ad86957cb
Create Date: 2026-04-25 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd4f2a8bc91e3'
down_revision: Union[str, Sequence[str], None] = 'c22ad86957cb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'subscriptions',
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('polar_customer_id', sa.String(), nullable=False),
        sa.Column('polar_subscription_id', sa.String(), nullable=False),
        sa.Column('plan', sa.String(), nullable=False),
        sa.Column('status', sa.String(), nullable=False),
        sa.Column('current_period_end', sa.String(), nullable=False),
        sa.Column('created_at', sa.String(), nullable=False),
        sa.Column('updated_at', sa.String(), nullable=False),
        sa.PrimaryKeyConstraint('user_id'),
        sa.UniqueConstraint('polar_subscription_id', name='uq_subscriptions_polar_sub_id'),
    )
    op.create_index(
        'ix_subscriptions_polar_customer_id',
        'subscriptions',
        ['polar_customer_id'],
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_subscriptions_polar_customer_id', table_name='subscriptions')
    op.drop_table('subscriptions')
