"""generation run lease records

Revision ID: 0007_generation_runs
Revises: 0006_turn_generation_lifecycle
Create Date: 2026-06-09
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0007_generation_runs"
down_revision: str | Sequence[str] | None = "0006_turn_generation_lifecycle"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "generation_runs",
        sa.Column("run_id", sa.String(length=120), nullable=False),
        sa.Column("session_id", sa.String(length=120), nullable=False),
        sa.Column("thread_id", sa.String(length=120), nullable=False),
        sa.Column("turn_id", sa.String(length=120), nullable=False),
        sa.Column("status", sa.String(length=40), nullable=False),
        sa.Column("lease_owner", sa.String(length=120), nullable=False),
        sa.Column("claimed_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("heartbeat_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("released_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("interrupted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("failed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error_code", sa.String(length=120), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["session_id"], ["workspace_sessions.session_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["thread_id"], ["conversation_threads.thread_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["turn_id"], ["turns.turn_id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("run_id"),
    )
    op.create_index(op.f("ix_generation_runs_session_id"), "generation_runs", ["session_id"], unique=False)
    op.create_index(op.f("ix_generation_runs_thread_id"), "generation_runs", ["thread_id"], unique=False)
    op.create_index(op.f("ix_generation_runs_turn_id"), "generation_runs", ["turn_id"], unique=False)
    op.create_index(op.f("ix_generation_runs_status"), "generation_runs", ["status"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_generation_runs_status"), table_name="generation_runs")
    op.drop_index(op.f("ix_generation_runs_turn_id"), table_name="generation_runs")
    op.drop_index(op.f("ix_generation_runs_thread_id"), table_name="generation_runs")
    op.drop_index(op.f("ix_generation_runs_session_id"), table_name="generation_runs")
    op.drop_table("generation_runs")
