"""turn generation lifecycle metadata

Revision ID: 0006_turn_generation_lifecycle
Revises: 0005_retire_legacy_history
Create Date: 2026-06-09
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0006_turn_generation_lifecycle"
down_revision: str | Sequence[str] | None = "0005_retire_legacy_history"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("turns", sa.Column("generation_started_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("turns", sa.Column("generation_completed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("turns", sa.Column("generation_failed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("turns", sa.Column("generation_cancelled_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("turns", sa.Column("generation_error_code", sa.String(length=120), nullable=True))
    op.add_column("turns", sa.Column("generation_error_message", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("turns", "generation_error_message")
    op.drop_column("turns", "generation_error_code")
    op.drop_column("turns", "generation_cancelled_at")
    op.drop_column("turns", "generation_failed_at")
    op.drop_column("turns", "generation_completed_at")
    op.drop_column("turns", "generation_started_at")
