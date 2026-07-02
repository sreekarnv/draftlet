from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_session
from app.schemas.search import SearchResult, SearchScope
from app.services.search_service import search_all, search_turns, search_variants


router = APIRouter(tags=["search"])


@router.get("/search", response_model=SearchResult)
def get_search_results(
    q: str = Query(min_length=1, max_length=200),
    limit: int = Query(default=20, ge=1, le=100),
    scope: SearchScope = "all",
    session: Session = Depends(get_session),
) -> SearchResult:
    if scope == "turns":
        hits = search_turns(session, q, limit=limit)
    elif scope == "variants":
        hits = search_variants(session, q, limit=limit)
    else:
        hits = search_all(session, q, limit=limit)

    return SearchResult(query=q, scope=scope, hits=hits, total_hits=len(hits))
