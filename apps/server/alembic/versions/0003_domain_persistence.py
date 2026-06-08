"""domain persistence tables

Revision ID: 0003_domain_persistence
Revises: 0002_drop_favorites
Create Date: 2026-06-08
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0003_domain_persistence"
down_revision: str | Sequence[str] | None = "0002_drop_favorites"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "workspace_sessions",
        sa.Column("session_id", sa.String(length=120), nullable=False),
        sa.Column("tab_id", sa.Integer(), nullable=True),
        sa.Column("window_id", sa.Integer(), nullable=True),
        sa.Column("page_url", sa.Text(), nullable=False),
        sa.Column("page_title", sa.Text(), nullable=True),
        sa.Column("selected_text", sa.Text(), nullable=False),
        sa.Column("source_domain", sa.String(length=255), nullable=True),
        sa.Column("status", sa.String(length=40), nullable=False),
        sa.Column("active_thread_id", sa.String(length=120), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("session_id"),
    )
    op.create_table(
        "conversation_threads",
        sa.Column("thread_id", sa.String(length=120), nullable=False),
        sa.Column("session_id", sa.String(length=120), nullable=False),
        sa.Column("selected_text", sa.Text(), nullable=False),
        sa.Column("source_url", sa.Text(), nullable=False),
        sa.Column("source_domain", sa.String(length=255), nullable=True),
        sa.Column("page_title", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=40), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["session_id"], ["workspace_sessions.session_id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("thread_id"),
    )
    op.create_index(op.f("ix_conversation_threads_session_id"), "conversation_threads", ["session_id"], unique=False)
    op.create_table(
        "turns",
        sa.Column("turn_id", sa.String(length=120), nullable=False),
        sa.Column("thread_id", sa.String(length=120), nullable=False),
        sa.Column("instruction", sa.Text(), nullable=False),
        sa.Column("selected_text", sa.Text(), nullable=False),
        sa.Column("source_url", sa.Text(), nullable=False),
        sa.Column("source_domain", sa.String(length=255), nullable=True),
        sa.Column("page_title", sa.Text(), nullable=True),
        sa.Column("tone", sa.String(length=80), nullable=False),
        sa.Column("generation_status", sa.String(length=40), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["thread_id"], ["conversation_threads.thread_id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("turn_id"),
    )
    op.create_index(op.f("ix_turns_thread_id"), "turns", ["thread_id"], unique=False)
    op.create_table(
        "draft_variants",
        sa.Column("variant_id", sa.String(length=120), nullable=False),
        sa.Column("turn_id", sa.String(length=120), nullable=False),
        sa.Column("tone", sa.String(length=80), nullable=False),
        sa.Column("length", sa.String(length=80), nullable=True),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("rank", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=40), nullable=False),
        sa.Column("legacy_reply_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["legacy_reply_id"], ["replies.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["turn_id"], ["turns.turn_id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("variant_id"),
        sa.UniqueConstraint("turn_id", "rank", name="uq_draft_variants_turn_rank"),
    )
    op.create_index(op.f("ix_draft_variants_turn_id"), "draft_variants", ["turn_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_draft_variants_turn_id"), table_name="draft_variants")
    op.drop_table("draft_variants")
    op.drop_index(op.f("ix_turns_thread_id"), table_name="turns")
    op.drop_table("turns")
    op.drop_index(op.f("ix_conversation_threads_session_id"), table_name="conversation_threads")
    op.drop_table("conversation_threads")
    op.drop_table("workspace_sessions")
