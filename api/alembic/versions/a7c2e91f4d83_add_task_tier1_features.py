"""add tier 1 task features: subtasks, tags, recurrence, focus sessions

Revision ID: a7c2e91f4d83
Revises: f93bc0e4d7a1
Create Date: 2026-05-27 14:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a7c2e91f4d83"
down_revision: Union[str, Sequence[str], None] = "f93bc0e4d7a1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("course_tasks", sa.Column("parent_task_id", sa.String(), nullable=True))
    op.add_column("course_tasks", sa.Column("tags", sa.JSON(), nullable=True))
    op.add_column("course_tasks", sa.Column("recurrence_rule", sa.String(), nullable=True))
    op.add_column("course_tasks", sa.Column("recurrence_parent_id", sa.String(), nullable=True))
    op.add_column(
        "course_tasks",
        sa.Column("focus_seconds_total", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_index(
        "ix_course_tasks_parent_task_id", "course_tasks", ["parent_task_id"]
    )

    op.create_table(
        "task_focus_sessions",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("task_id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("project_id", sa.String(), nullable=False),
        sa.Column("started_at", sa.String(), nullable=False),
        sa.Column("ended_at", sa.String(), nullable=True),
        sa.Column("duration_seconds", sa.Integer(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_task_focus_sessions_id"), "task_focus_sessions", ["id"])
    op.create_index(op.f("ix_task_focus_sessions_task_id"), "task_focus_sessions", ["task_id"])
    op.create_index(op.f("ix_task_focus_sessions_user_id"), "task_focus_sessions", ["user_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_task_focus_sessions_user_id"), table_name="task_focus_sessions")
    op.drop_index(op.f("ix_task_focus_sessions_task_id"), table_name="task_focus_sessions")
    op.drop_index(op.f("ix_task_focus_sessions_id"), table_name="task_focus_sessions")
    op.drop_table("task_focus_sessions")
    op.drop_index("ix_course_tasks_parent_task_id", table_name="course_tasks")
    op.drop_column("course_tasks", "focus_seconds_total")
    op.drop_column("course_tasks", "recurrence_parent_id")
    op.drop_column("course_tasks", "recurrence_rule")
    op.drop_column("course_tasks", "tags")
    op.drop_column("course_tasks", "parent_task_id")
