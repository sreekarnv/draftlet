"""add search fts

Revision ID: 8f9c2d1b6a34
Revises: 4d56f1388f8a
Create Date: 2026-07-13 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
from sqlalchemy import text


revision: str = "8f9c2d1b6a34"
down_revision: Union[str, Sequence[str], None] = "4d56f1388f8a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()

    # FTS5 objects are coupled to their source tables through triggers. Future migrations
    # that drop or rename conversations/drafts must drop the matching triggers and FTS
    # virtual tables first, then recreate/backfill them after the source table change.
    bind.execute(text("""
        CREATE VIRTUAL TABLE conversations_fts USING fts5(
            id UNINDEXED,
            title,
            contact,
            latest_message,
            tokenize='porter unicode61'
        )
    """))
    bind.execute(text("""
        CREATE VIRTUAL TABLE drafts_fts USING fts5(
            id UNINDEXED,
            title,
            text,
            instruction,
            tokenize='porter unicode61'
        )
    """))
    bind.execute(text("""
        INSERT INTO conversations_fts(rowid, id, title, contact, latest_message)
        SELECT rowid, id, title, contact, latest_message FROM conversations
    """))
    bind.execute(text("""
        INSERT INTO drafts_fts(rowid, id, title, text, instruction)
        SELECT rowid, id, title, text, instruction FROM drafts
    """))
    bind.execute(text("""
        CREATE TRIGGER conversations_ai AFTER INSERT ON conversations BEGIN
            INSERT INTO conversations_fts(rowid, id, title, contact, latest_message)
            VALUES (new.rowid, new.id, new.title, new.contact, new.latest_message);
        END
    """))
    bind.execute(text("""
        CREATE TRIGGER conversations_ad AFTER DELETE ON conversations BEGIN
            DELETE FROM conversations_fts WHERE rowid = old.rowid;
        END
    """))
    bind.execute(text("""
        CREATE TRIGGER conversations_au AFTER UPDATE ON conversations BEGIN
            DELETE FROM conversations_fts WHERE rowid = old.rowid;
            INSERT INTO conversations_fts(rowid, id, title, contact, latest_message)
            VALUES (new.rowid, new.id, new.title, new.contact, new.latest_message);
        END
    """))
    bind.execute(text("""
        CREATE TRIGGER drafts_ai AFTER INSERT ON drafts BEGIN
            INSERT INTO drafts_fts(rowid, id, title, text, instruction)
            VALUES (new.rowid, new.id, new.title, new.text, new.instruction);
        END
    """))
    bind.execute(text("""
        CREATE TRIGGER drafts_ad AFTER DELETE ON drafts BEGIN
            DELETE FROM drafts_fts WHERE rowid = old.rowid;
        END
    """))
    bind.execute(text("""
        CREATE TRIGGER drafts_au AFTER UPDATE ON drafts BEGIN
            DELETE FROM drafts_fts WHERE rowid = old.rowid;
            INSERT INTO drafts_fts(rowid, id, title, text, instruction)
            VALUES (new.rowid, new.id, new.title, new.text, new.instruction);
        END
    """))


def downgrade() -> None:
    bind = op.get_bind()
    for name in (
        "drafts_au",
        "drafts_ad",
        "drafts_ai",
        "conversations_au",
        "conversations_ad",
        "conversations_ai",
    ):
        bind.execute(text(f"DROP TRIGGER IF EXISTS {name}"))
    bind.execute(text("DROP TABLE IF EXISTS drafts_fts"))
    bind.execute(text("DROP TABLE IF EXISTS conversations_fts"))
