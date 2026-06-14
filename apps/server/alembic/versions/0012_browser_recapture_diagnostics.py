"""persist browser recapture diagnostics

Revision ID: 0012_browser_recapture_diagnostics
Revises: 0011_generation_run_maintenance_outcomes
Create Date: 2026-06-14
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0012_browser_recapture_diagnostics"
down_revision: str | Sequence[str] | None = "0011_generation_run_maintenance_outcomes"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "browser_recapture_diagnostics_reports",
        sa.Column("report_id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("kind", sa.String(length=80), nullable=False),
        sa.Column("exported_at", sa.String(length=80), nullable=False),
        sa.Column("received_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("last_updated_at", sa.String(length=80), nullable=False),
        sa.Column("entry_count", sa.Integer(), nullable=False),
        sa.Column("current_target_json", sa.Text(), nullable=True),
        sa.Column("latest_attempt_json", sa.Text(), nullable=True),
        sa.Column("latest_outcome_json", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("report_id"),
    )
    op.create_index(
        op.f("ix_browser_recapture_diagnostics_reports_received_at"),
        "browser_recapture_diagnostics_reports",
        ["received_at"],
        unique=False,
    )

    op.create_table(
        "browser_recapture_diagnostic_events",
        sa.Column("event_record_id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("report_id", sa.Integer(), nullable=False),
        sa.Column("source_entry_id", sa.Integer(), nullable=False),
        sa.Column("event", sa.String(length=120), nullable=False),
        sa.Column("level", sa.String(length=40), nullable=False),
        sa.Column("session_id", sa.String(length=120), nullable=False),
        sa.Column("tab_id", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(length=80), nullable=True),
        sa.Column("outcome", sa.String(length=120), nullable=True),
        sa.Column("reason", sa.String(length=160), nullable=True),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("at", sa.String(length=80), nullable=False),
        sa.Column("received_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["report_id"], ["browser_recapture_diagnostics_reports.report_id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("event_record_id"),
    )
    op.create_index(
        op.f("ix_browser_recapture_diagnostic_events_at"),
        "browser_recapture_diagnostic_events",
        ["at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_browser_recapture_diagnostic_events_event"),
        "browser_recapture_diagnostic_events",
        ["event"],
        unique=False,
    )
    op.create_index(
        op.f("ix_browser_recapture_diagnostic_events_received_at"),
        "browser_recapture_diagnostic_events",
        ["received_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_browser_recapture_diagnostic_events_report_id"),
        "browser_recapture_diagnostic_events",
        ["report_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_browser_recapture_diagnostic_events_session_id"),
        "browser_recapture_diagnostic_events",
        ["session_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_browser_recapture_diagnostic_events_session_id"), table_name="browser_recapture_diagnostic_events")
    op.drop_index(op.f("ix_browser_recapture_diagnostic_events_report_id"), table_name="browser_recapture_diagnostic_events")
    op.drop_index(op.f("ix_browser_recapture_diagnostic_events_received_at"), table_name="browser_recapture_diagnostic_events")
    op.drop_index(op.f("ix_browser_recapture_diagnostic_events_event"), table_name="browser_recapture_diagnostic_events")
    op.drop_index(op.f("ix_browser_recapture_diagnostic_events_at"), table_name="browser_recapture_diagnostic_events")
    op.drop_table("browser_recapture_diagnostic_events")
    op.drop_index(op.f("ix_browser_recapture_diagnostics_reports_received_at"), table_name="browser_recapture_diagnostics_reports")
    op.drop_table("browser_recapture_diagnostics_reports")
