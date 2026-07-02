"""add fts5 search indexes

Revision ID: 0013_fts5_search
Revises: 0012_browser_recapture_diagnostics
Create Date: 2026-07-02
"""

from collections.abc import Sequence

from alembic import op


revision: str = "0013_fts5_search"
down_revision: str | Sequence[str] | None = "0012_browser_recapture_diagnostics"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        CREATE VIRTUAL TABLE turns_fts USING fts5(
            turn_id UNINDEXED,
            instruction,
            selected_text,
            source_url UNINDEXED,
            source_domain UNINDEXED,
            tokenize='porter unicode61'
        )
        """
    )
    op.execute(
        """
        INSERT INTO turns_fts(turn_id, instruction, selected_text, source_url, source_domain)
        SELECT turn_id, instruction, selected_text, source_url, source_domain
        FROM turns
        """
    )
    op.execute(
        """
        CREATE TRIGGER turns_ai AFTER INSERT ON turns BEGIN
            INSERT INTO turns_fts(turn_id, instruction, selected_text, source_url, source_domain)
            VALUES (new.turn_id, new.instruction, new.selected_text, new.source_url, new.source_domain);
        END
        """
    )
    op.execute(
        """
        CREATE TRIGGER turns_ad AFTER DELETE ON turns BEGIN
            DELETE FROM turns_fts WHERE turn_id = old.turn_id;
        END
        """
    )
    op.execute(
        """
        CREATE TRIGGER turns_au AFTER UPDATE ON turns BEGIN
            DELETE FROM turns_fts WHERE turn_id = old.turn_id;
            INSERT INTO turns_fts(turn_id, instruction, selected_text, source_url, source_domain)
            VALUES (new.turn_id, new.instruction, new.selected_text, new.source_url, new.source_domain);
        END
        """
    )

    op.execute(
        """
        CREATE VIRTUAL TABLE draft_variants_fts USING fts5(
            variant_id UNINDEXED,
            turn_id UNINDEXED,
            content,
            tokenize='porter unicode61'
        )
        """
    )
    op.execute(
        """
        INSERT INTO draft_variants_fts(variant_id, turn_id, content)
        SELECT variant_id, turn_id, content
        FROM draft_variants
        """
    )
    op.execute(
        """
        CREATE TRIGGER draft_variants_ai AFTER INSERT ON draft_variants BEGIN
            INSERT INTO draft_variants_fts(variant_id, turn_id, content)
            VALUES (new.variant_id, new.turn_id, new.content);
        END
        """
    )
    op.execute(
        """
        CREATE TRIGGER draft_variants_ad AFTER DELETE ON draft_variants BEGIN
            DELETE FROM draft_variants_fts WHERE variant_id = old.variant_id;
        END
        """
    )
    op.execute(
        """
        CREATE TRIGGER draft_variants_au AFTER UPDATE ON draft_variants BEGIN
            DELETE FROM draft_variants_fts WHERE variant_id = old.variant_id;
            INSERT INTO draft_variants_fts(variant_id, turn_id, content)
            VALUES (new.variant_id, new.turn_id, new.content);
        END
        """
    )


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS draft_variants_au")
    op.execute("DROP TRIGGER IF EXISTS draft_variants_ad")
    op.execute("DROP TRIGGER IF EXISTS draft_variants_ai")
    op.execute("DROP TABLE IF EXISTS draft_variants_fts")
    op.execute("DROP TRIGGER IF EXISTS turns_au")
    op.execute("DROP TRIGGER IF EXISTS turns_ad")
    op.execute("DROP TRIGGER IF EXISTS turns_ai")
    op.execute("DROP TABLE IF EXISTS turns_fts")
