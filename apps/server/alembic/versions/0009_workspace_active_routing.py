"""workspace active routing metadata

Revision ID: 0009_workspace_active_routing
Revises: 0008_compose_target_refs
Create Date: 2026-06-12
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0009_workspace_active_routing"
down_revision: str | Sequence[str] | None = "0008_compose_target_refs"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("workspace_sessions", sa.Column("active_turn_id", sa.String(length=120), nullable=True))
    op.add_column("workspace_sessions", sa.Column("active_run_id", sa.String(length=120), nullable=True))


def downgrade() -> None:
    op.drop_column("workspace_sessions", "active_run_id")
    op.drop_column("workspace_sessions", "active_turn_id")
