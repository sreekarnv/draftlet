from sqlalchemy import text
from sqlalchemy.orm import Session

from app.schemas.search import SearchHit


def search_turns(session: Session, query: str, limit: int = 20) -> list[SearchHit]:
    rows = session.execute(
        text(
            """
            SELECT
                'turn' AS scope,
                turns.turn_id AS id,
                turns.thread_id AS thread_id,
                turns.turn_id AS turn_id,
                snippet(turns_fts, -1, '<mark>', '</mark>', '...', 32) AS snippet,
                bm25(turns_fts) AS score,
                turns.updated_at AS matched_at
            FROM turns_fts
            JOIN turns ON turns.turn_id = turns_fts.turn_id
            WHERE turns_fts MATCH :query
            ORDER BY score ASC, turns.updated_at DESC
            LIMIT :limit
            """
        ),
        {"query": query, "limit": limit},
    ).mappings()
    return [SearchHit(**row) for row in rows]


def search_variants(session: Session, query: str, limit: int = 20) -> list[SearchHit]:
    rows = session.execute(
        text(
            """
            SELECT
                'variant' AS scope,
                draft_variants.variant_id AS id,
                turns.thread_id AS thread_id,
                draft_variants.turn_id AS turn_id,
                snippet(draft_variants_fts, -1, '<mark>', '</mark>', '...', 32) AS snippet,
                bm25(draft_variants_fts) AS score,
                draft_variants.updated_at AS matched_at
            FROM draft_variants_fts
            JOIN draft_variants ON draft_variants.variant_id = draft_variants_fts.variant_id
            JOIN turns ON turns.turn_id = draft_variants.turn_id
            WHERE draft_variants_fts MATCH :query
            ORDER BY score ASC, draft_variants.updated_at DESC
            LIMIT :limit
            """
        ),
        {"query": query, "limit": limit},
    ).mappings()
    return [SearchHit(**row) for row in rows]


def search_all(session: Session, query: str, limit: int = 20) -> list[SearchHit]:
    hits = [*search_turns(session, query, limit), *search_variants(session, query, limit)]
    return sorted(hits, key=lambda hit: (hit.score, -hit.matched_at.timestamp()))[:limit]
