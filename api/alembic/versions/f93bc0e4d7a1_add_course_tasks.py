"""add course tasks

Revision ID: f93bc0e4d7a1
Revises: f61ac9d4e872
Create Date: 2026-05-27 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f93bc0e4d7a1"
down_revision: Union[str, Sequence[str], None] = "f61ac9d4e872"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "course_tasks",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("project_id", sa.String(), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("due_date", sa.String(), nullable=True),
        sa.Column("priority", sa.String(), nullable=False, server_default="medium"),
        sa.Column("status", sa.String(), nullable=False, server_default="open"),
        sa.Column("origin", sa.String(), nullable=False, server_default="student"),
        sa.Column("completed_at", sa.String(), nullable=True),
        sa.Column("created_at", sa.String(), nullable=False),
        sa.Column("updated_at", sa.String(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_course_tasks_id"), "course_tasks", ["id"])
    op.create_index(op.f("ix_course_tasks_user_id"), "course_tasks", ["user_id"])
    op.create_index(op.f("ix_course_tasks_project_id"), "course_tasks", ["project_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_course_tasks_project_id"), table_name="course_tasks")
    op.drop_index(op.f("ix_course_tasks_user_id"), table_name="course_tasks")
    op.drop_index(op.f("ix_course_tasks_id"), table_name="course_tasks")
    op.drop_table("course_tasks")
