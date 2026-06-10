"""compose target refs on workspace sessions

Revision ID: 0008_compose_target_refs
Revises: 0007_generation_runs
Create Date: 2026-06-10
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0008_compose_target_refs"
down_revision: str | Sequence[str] | None = "0007_generation_runs"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("workspace_sessions", sa.Column("compose_target_id", sa.String(length=160), nullable=True))
    op.add_column("workspace_sessions", sa.Column("compose_target_kind", sa.String(length=40), nullable=True))
    op.add_column("workspace_sessions", sa.Column("compose_target_page_url", sa.Text(), nullable=True))
    op.add_column("workspace_sessions", sa.Column("compose_target_origin", sa.String(length=255), nullable=True))
    op.add_column("workspace_sessions", sa.Column("compose_target_page_title", sa.Text(), nullable=True))
    op.add_column("workspace_sessions", sa.Column("compose_target_selector", sa.Text(), nullable=True))
    op.add_column("workspace_sessions", sa.Column("compose_target_fingerprint", sa.Text(), nullable=True))
    op.add_column("workspace_sessions", sa.Column("compose_target_label", sa.String(length=160), nullable=True))
    op.add_column("workspace_sessions", sa.Column("compose_target_last_seen_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("workspace_sessions", "compose_target_last_seen_at")
    op.drop_column("workspace_sessions", "compose_target_label")
    op.drop_column("workspace_sessions", "compose_target_fingerprint")
    op.drop_column("workspace_sessions", "compose_target_selector")
    op.drop_column("workspace_sessions", "compose_target_page_title")
    op.drop_column("workspace_sessions", "compose_target_origin")
    op.drop_column("workspace_sessions", "compose_target_page_url")
    op.drop_column("workspace_sessions", "compose_target_kind")
    op.drop_column("workspace_sessions", "compose_target_id")
