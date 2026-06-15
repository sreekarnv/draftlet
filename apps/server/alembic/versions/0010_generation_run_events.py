"""generation run durable replay events

Revision ID: 0010_generation_run_events
Revises: 0009_workspace_active_routing
Create Date: 2026-06-13
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0010_generation_run_events"
down_revision: str | Sequence[str] | None = "0009_workspace_active_routing"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "generation_run_events",
        sa.Column("event_id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("run_id", sa.String(length=120), nullable=False),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("event_type", sa.String(length=80), nullable=False),
        sa.Column("session_id", sa.String(length=120), nullable=False),
        sa.Column("thread_id", sa.String(length=120), nullable=False),
        sa.Column("turn_id", sa.String(length=120), nullable=False),
        sa.Column("status", sa.String(length=40), nullable=True),
        sa.Column("variant_id", sa.String(length=120), nullable=True),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("reply_text", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["run_id"], ["generation_runs.run_id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("event_id"),
        sa.UniqueConstraint("run_id", "sequence", name="uq_generation_run_events_run_sequence"),
    )
    op.create_index(op.f("ix_generation_run_events_event_type"), "generation_run_events", ["event_type"], unique=False)
    op.create_index(op.f("ix_generation_run_events_run_id"), "generation_run_events", ["run_id"], unique=False)
    op.create_index(op.f("ix_generation_run_events_variant_id"), "generation_run_events", ["variant_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_generation_run_events_variant_id"), table_name="generation_run_events")
    op.drop_index(op.f("ix_generation_run_events_run_id"), table_name="generation_run_events")
    op.drop_index(op.f("ix_generation_run_events_event_type"), table_name="generation_run_events")
    op.drop_table("generation_run_events")
