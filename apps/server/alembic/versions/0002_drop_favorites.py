"""drop favorites table

Revision ID: 0002_drop_favorites
Revises: 0001_initial_persistence
Create Date: 2026-06-05
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "0002_drop_favorites"
down_revision: str | Sequence[str] | None = "0001_initial_persistence"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_index(op.f("ix_favorites_reply_id"), table_name="favorites")
    op.drop_table("favorites")


def downgrade() -> None:
    op.create_table(
        "favorites",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("reply_id", sa.Integer(), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["reply_id"], ["replies.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_favorites_reply_id"), "favorites", ["reply_id"], unique=True)
