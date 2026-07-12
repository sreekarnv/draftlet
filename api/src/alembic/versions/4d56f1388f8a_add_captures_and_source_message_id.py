"""add captures and source message id

Revision ID: 4d56f1388f8a
Revises: 99337ff85fd2
Create Date: 2026-07-12 22:40:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "4d56f1388f8a"
down_revision: Union[str, Sequence[str], None] = "99337ff85fd2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("messages", sa.Column("source_message_id", sa.String(length=255), nullable=True))
    op.create_index(op.f("ix_messages_source_message_id"), "messages", ["source_message_id"], unique=False)

    op.create_table(
        "captures",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("connector_kind", sa.String(length=64), nullable=False),
        sa.Column("source_message_id", sa.String(length=255), nullable=False),
        sa.Column("conversation_id", sa.Uuid(), nullable=True),
        sa.Column("message_id", sa.Uuid(), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("captured_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["conversation_id"], ["conversations.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["message_id"], ["messages.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("connector_kind", "source_message_id", name="uq_captures_kind_source"),
    )
    op.create_index(op.f("ix_captures_connector_kind"), "captures", ["connector_kind"], unique=False)
    op.create_index(op.f("ix_captures_source_message_id"), "captures", ["source_message_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_captures_source_message_id"), table_name="captures")
    op.drop_index(op.f("ix_captures_connector_kind"), table_name="captures")
    op.drop_table("captures")
    op.drop_index(op.f("ix_messages_source_message_id"), table_name="messages")
    op.drop_column("messages", "source_message_id")
