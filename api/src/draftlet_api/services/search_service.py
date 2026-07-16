import re

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from draftlet_api.dtos.search import SearchResult

TOKEN_RE = re.compile(r"[\w]+")


def fts_query(value: str) -> str:
    tokens = TOKEN_RE.findall(value.lower())
    return " AND ".join(f"{token}*" for token in tokens)


class SearchService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def search(self, q: str, limit: int = 20) -> list[SearchResult]:
        query = fts_query(q)
        if not query:
            return []

        result = await self.db.execute(
            text(
                """
                SELECT item_type, id, title, subtitle, snippet, updated_at
                FROM (
                    SELECT
                        'conversation' AS item_type,
                        c.id AS id,
                        c.title AS title,
                        c.contact AS subtitle,
                        snippet(conversations_fts, -1, '', '', '...', 16) AS snippet,
                        c.latest_message_at AS updated_at,
                        bm25(conversations_fts) AS rank
                    FROM conversations_fts
                    JOIN conversations c ON c.rowid = conversations_fts.rowid
                    WHERE conversations_fts MATCH :query

                    UNION ALL

                    SELECT
                        'draft' AS item_type,
                        d.id AS id,
                        d.title AS title,
                        d.status AS subtitle,
                        snippet(drafts_fts, -1, '', '', '...', 16) AS snippet,
                        d.updated_at AS updated_at,
                        bm25(drafts_fts) AS rank
                    FROM drafts_fts
                    JOIN drafts d ON d.rowid = drafts_fts.rowid
                    WHERE drafts_fts MATCH :query
                )
                ORDER BY rank, updated_at DESC
                LIMIT :limit
                """
            ),
            {"query": query, "limit": limit},
        )
        return [SearchResult.model_validate(dict(row)) for row in result.mappings()]
