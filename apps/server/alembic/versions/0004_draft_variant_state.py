"""draft variant selected state

Revision ID: 0004_draft_variant_state
Revises: 0003_domain_persistence
Create Date: 2026-06-09
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0004_draft_variant_state"
down_revision: str | Sequence[str] | None = "0003_domain_persistence"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "draft_variants",
        sa.Column("is_current", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column("draft_variants", "is_current")
