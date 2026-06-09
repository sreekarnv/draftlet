"""retire legacy generation history

Revision ID: 0005_retire_legacy_history
Revises: 0004_draft_variant_state
Create Date: 2026-06-09
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0005_retire_legacy_history"
down_revision: str | Sequence[str] | None = "0004_draft_variant_state"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("draft_variants") as batch_op:
        batch_op.drop_column("legacy_reply_id")

    op.drop_index(op.f("ix_replies_generation_id"), table_name="replies")
    op.drop_table("replies")
    op.drop_table("generations")


def downgrade() -> None:
    op.create_table(
        "generations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("selected_text", sa.Text(), nullable=False),
        sa.Column("tone", sa.String(length=80), nullable=False),
        sa.Column("model", sa.String(length=120), nullable=False),
        sa.Column("source_url", sa.Text(), nullable=True),
        sa.Column("source_domain", sa.String(length=255), nullable=True),
        sa.Column("status", sa.String(length=40), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "replies",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("generation_id", sa.Integer(), nullable=False),
        sa.Column("reply_index", sa.Integer(), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["generation_id"], ["generations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("generation_id", "reply_index", name="uq_replies_generation_index"),
    )
    op.create_index(op.f("ix_replies_generation_id"), "replies", ["generation_id"], unique=False)

    with op.batch_alter_table("draft_variants") as batch_op:
        batch_op.add_column(sa.Column("legacy_reply_id", sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            "fk_draft_variants_legacy_reply_id_replies",
            "replies",
            ["legacy_reply_id"],
            ["id"],
            ondelete="SET NULL",
        )
