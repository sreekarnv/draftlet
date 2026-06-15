"""persist generation run maintenance diagnostics

Revision ID: 0011_generation_run_maintenance_outcomes
Revises: 0010_generation_run_events
Create Date: 2026-06-13
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0011_generation_run_maintenance_outcomes"
down_revision: str | Sequence[str] | None = "0010_generation_run_events"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "generation_run_maintenance_outcomes",
        sa.Column("outcome_id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("operation", sa.String(length=80), nullable=False),
        sa.Column("status", sa.String(length=40), nullable=False),
        sa.Column("source", sa.String(length=80), nullable=True),
        sa.Column("at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("reconciled_run_count", sa.Integer(), nullable=False),
        sa.Column("reconciled_run_ids", sa.Text(), nullable=False),
        sa.Column("pruned_event_count", sa.Integer(), nullable=False),
        sa.Column("stale_after_seconds", sa.Integer(), nullable=True),
        sa.Column("retention_days", sa.Integer(), nullable=True),
        sa.Column("replay_limit", sa.Integer(), nullable=True),
        sa.Column("prune_batch_size", sa.Integer(), nullable=True),
        sa.Column("error_code", sa.String(length=120), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("outcome_id"),
    )
    op.create_index(
        op.f("ix_generation_run_maintenance_outcomes_at"),
        "generation_run_maintenance_outcomes",
        ["at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_generation_run_maintenance_outcomes_operation"),
        "generation_run_maintenance_outcomes",
        ["operation"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_generation_run_maintenance_outcomes_operation"), table_name="generation_run_maintenance_outcomes")
    op.drop_index(op.f("ix_generation_run_maintenance_outcomes_at"), table_name="generation_run_maintenance_outcomes")
    op.drop_table("generation_run_maintenance_outcomes")
