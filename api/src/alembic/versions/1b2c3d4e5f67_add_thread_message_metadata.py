"""add thread message metadata

Revision ID: 1b2c3d4e5f67
Revises: 8f9c2d1b6a34
Create Date: 2026-07-13 18:00:00.000000

"""

import json
import re
from collections import defaultdict
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


revision: str = "1b2c3d4e5f67"
down_revision: Union[str, Sequence[str], None] = "8f9c2d1b6a34"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


TELEGRAM_SOURCE_RE = re.compile(
    r"^(?:telegram|ConnectorKind\.TELEGRAM):(?P<chat_id>-?\d+):(?P<message_id>\d+)$"
)


def _parse_telegram_source(source: str | None) -> tuple[str, str] | None:
    if not source:
        return None
    match = TELEGRAM_SOURCE_RE.match(source)
    if not match:
        return None
    return match.group("chat_id"), match.group("message_id")


def _json(value: object) -> str:
    return json.dumps(value, separators=(",", ":"))


def upgrade() -> None:
    bind = op.get_bind()

    op.add_column(
        "conversations",
        sa.Column("external_thread_id", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "conversations", sa.Column("thread_kind", sa.String(length=64), nullable=True)
    )
    op.add_column(
        "conversations",
        sa.Column(
            "metadata", sa.JSON(), nullable=False, server_default=sa.text("'{}'")
        ),
    )
    op.create_index(
        "ix_conversations_external_thread_id",
        "conversations",
        ["external_thread_id"],
        unique=False,
    )

    op.add_column(
        "messages",
        sa.Column("external_message_id", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "messages", sa.Column("reply_to_message_id", sa.Uuid(), nullable=True)
    )
    op.add_column(
        "messages",
        sa.Column("reply_to_external_message_id", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "messages",
        sa.Column(
            "metadata", sa.JSON(), nullable=False, server_default=sa.text("'{}'")
        ),
    )
    op.create_index(
        "ix_messages_external_message_id",
        "messages",
        ["external_message_id"],
        unique=False,
    )
    op.create_index(
        "ix_messages_reply_to_message_id",
        "messages",
        ["reply_to_message_id"],
        unique=False,
    )
    op.create_index(
        "ix_messages_reply_to_external_message_id",
        "messages",
        ["reply_to_external_message_id"],
        unique=False,
    )

    op.add_column(
        "drafts", sa.Column("reply_target_message_id", sa.Uuid(), nullable=True)
    )
    op.add_column("drafts", sa.Column("send_mode", sa.String(length=32), nullable=True))
    op.create_index(
        "ix_drafts_reply_target_message_id",
        "drafts",
        ["reply_target_message_id"],
        unique=False,
    )

    op.add_column(
        "captures",
        sa.Column("external_thread_id", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "captures",
        sa.Column("external_message_id", sa.String(length=255), nullable=True),
    )
    op.create_index(
        "ix_captures_external_thread_id",
        "captures",
        ["external_thread_id"],
        unique=False,
    )
    op.create_index(
        "ix_captures_external_message_id",
        "captures",
        ["external_message_id"],
        unique=False,
    )

    _backfill_and_merge_telegram(bind)

    bind.execute(
        text(
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_conversations_connector_external_thread "
            "ON conversations(connector, external_thread_id) "
            "WHERE external_thread_id IS NOT NULL"
        )
    )


def _backfill_and_merge_telegram(bind) -> None:
    rows = bind.execute(
        text(
            "SELECT id, title, contact, participants, source, latest_message, "
            "latest_message_at, captured_at FROM conversations WHERE connector = 'telegram'"
        )
    ).mappings()
    by_chat: dict[str, list[dict[str, object]]] = defaultdict(list)

    for row in rows:
        route = _parse_telegram_source(row["source"])
        if not route:
            continue
        chat_id, message_id = route
        conversation_id = row["id"]
        external_message_id = f"{chat_id}:{message_id}"
        bind.execute(
            text(
                "UPDATE conversations SET external_thread_id = :chat_id, "
                "thread_kind = 'chat', metadata = :metadata, source = :source "
                "WHERE id = :conversation_id"
            ),
            {
                "chat_id": chat_id,
                "metadata": _json({"chat_id": chat_id}),
                "source": f"telegram:{chat_id}",
                "conversation_id": conversation_id,
            },
        )
        bind.execute(
            text(
                "UPDATE messages SET external_message_id = COALESCE(source_message_id, :external_message_id), "
                "metadata = :metadata WHERE conversation_id = :conversation_id"
            ),
            {
                "external_message_id": external_message_id,
                "metadata": _json({"chat_id": chat_id, "message_id": int(message_id)}),
                "conversation_id": conversation_id,
            },
        )
        bind.execute(
            text(
                "UPDATE captures SET external_thread_id = :chat_id, "
                "external_message_id = COALESCE(source_message_id, :external_message_id) "
                "WHERE conversation_id = :conversation_id"
            ),
            {
                "chat_id": chat_id,
                "external_message_id": external_message_id,
                "conversation_id": conversation_id,
            },
        )
        bind.execute(
            text(
                "UPDATE drafts SET reply_target_message_id = ("
                "SELECT id FROM messages WHERE conversation_id = :conversation_id "
                "AND kind = 'incoming' ORDER BY timestamp DESC LIMIT 1"
                "), send_mode = COALESCE(send_mode, 'reply') "
                "WHERE conversation_id = :conversation_id AND reply_target_message_id IS NULL"
            ),
            {"conversation_id": conversation_id},
        )
        by_chat[chat_id].append(dict(row))

    for chat_id, conversations in by_chat.items():
        if len(conversations) <= 1:
            continue

        canonical = max(
            conversations,
            key=lambda item: str(
                item["latest_message_at"] or item["captured_at"] or ""
            ),
        )
        canonical_id = canonical["id"]
        duplicate_ids = [
            item["id"] for item in conversations if item["id"] != canonical_id
        ]
        for duplicate_id in duplicate_ids:
            bind.execute(
                text(
                    "UPDATE messages SET conversation_id = :canonical WHERE conversation_id = :duplicate"
                ),
                {"canonical": canonical_id, "duplicate": duplicate_id},
            )
            bind.execute(
                text(
                    "UPDATE drafts SET conversation_id = :canonical WHERE conversation_id = :duplicate"
                ),
                {"canonical": canonical_id, "duplicate": duplicate_id},
            )
            bind.execute(
                text(
                    "UPDATE captures SET conversation_id = :canonical WHERE conversation_id = :duplicate"
                ),
                {"canonical": canonical_id, "duplicate": duplicate_id},
            )
            bind.execute(
                text("DELETE FROM conversations WHERE id = :duplicate"),
                {"duplicate": duplicate_id},
            )

        latest = (
            bind.execute(
                text(
                    "SELECT body, timestamp FROM messages WHERE conversation_id = :conversation_id "
                    "ORDER BY timestamp DESC LIMIT 1"
                ),
                {"conversation_id": canonical_id},
            )
            .mappings()
            .first()
        )
        if latest:
            bind.execute(
                text(
                    "UPDATE conversations SET latest_message = :body, latest_message_at = :timestamp, "
                    "external_thread_id = :chat_id, thread_kind = 'chat', metadata = :metadata, "
                    "source = :source WHERE id = :conversation_id"
                ),
                {
                    "body": latest["body"],
                    "timestamp": latest["timestamp"],
                    "chat_id": chat_id,
                    "metadata": _json({"chat_id": chat_id}),
                    "source": f"telegram:{chat_id}",
                    "conversation_id": canonical_id,
                },
            )


def downgrade() -> None:
    bind = op.get_bind()
    bind.execute(
        text("DROP INDEX IF EXISTS uq_conversations_connector_external_thread")
    )

    op.drop_index("ix_captures_external_message_id", table_name="captures")
    op.drop_index("ix_captures_external_thread_id", table_name="captures")
    op.drop_column("captures", "external_message_id")
    op.drop_column("captures", "external_thread_id")

    op.drop_index("ix_drafts_reply_target_message_id", table_name="drafts")
    op.drop_column("drafts", "send_mode")
    op.drop_column("drafts", "reply_target_message_id")

    op.drop_index("ix_messages_reply_to_external_message_id", table_name="messages")
    op.drop_index("ix_messages_reply_to_message_id", table_name="messages")
    op.drop_index("ix_messages_external_message_id", table_name="messages")
    op.drop_column("messages", "metadata")
    op.drop_column("messages", "reply_to_external_message_id")
    op.drop_column("messages", "reply_to_message_id")
    op.drop_column("messages", "external_message_id")

    op.drop_index("ix_conversations_external_thread_id", table_name="conversations")
    op.drop_column("conversations", "metadata")
    op.drop_column("conversations", "thread_kind")
    op.drop_column("conversations", "external_thread_id")
