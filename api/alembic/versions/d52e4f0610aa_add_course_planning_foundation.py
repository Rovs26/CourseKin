"""add course workspace and syllabus planning foundation

Revision ID: d52e4f0610aa
Revises: b28d8c71a934
Create Date: 2026-05-25 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d52e4f0610aa"
down_revision: Union[str, Sequence[str], None] = "b28d8c71a934"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("projects", sa.Column("course_code", sa.String(), nullable=True))
    op.add_column("projects", sa.Column("term", sa.String(), nullable=True))
    op.add_column("projects", sa.Column("instructor", sa.String(), nullable=True))
    op.add_column("projects", sa.Column("meeting_schedule", sa.Text(), nullable=True))
    op.add_column(
        "sources",
        sa.Column("purpose", sa.String(), nullable=False, server_default="study_material"),
    )

    op.create_table(
        "course_obligations",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("project_id", sa.String(), nullable=False),
        sa.Column("source_id", sa.String(), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("obligation_type", sa.String(), nullable=False),
        sa.Column("due_date", sa.String(), nullable=True),
        sa.Column("details", sa.Text(), nullable=True),
        sa.Column("grading_criteria", sa.Text(), nullable=True),
        sa.Column("confidence", sa.String(), nullable=False),
        sa.Column("uncertain_fields", sa.JSON(), nullable=True),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("created_at", sa.String(), nullable=False),
        sa.Column("updated_at", sa.String(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_course_obligations_id", "course_obligations", ["id"], unique=False)
    op.create_index(
        "ix_course_obligations_project_id", "course_obligations", ["project_id"], unique=False
    )
    op.create_index(
        "ix_course_obligations_source_id", "course_obligations", ["source_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index("ix_course_obligations_source_id", table_name="course_obligations")
    op.drop_index("ix_course_obligations_project_id", table_name="course_obligations")
    op.drop_index("ix_course_obligations_id", table_name="course_obligations")
    op.drop_table("course_obligations")
    op.drop_column("sources", "purpose")
    op.drop_column("projects", "meeting_schedule")
    op.drop_column("projects", "instructor")
    op.drop_column("projects", "term")
    op.drop_column("projects", "course_code")
