from datetime import datetime
from typing import Literal

from pydantic import BaseModel


SearchScope = Literal["turns", "variants", "all"]
SearchHitScope = Literal["turn", "variant"]


class SearchHit(BaseModel):
    scope: SearchHitScope
    id: str
    thread_id: str
    turn_id: str
    snippet: str
    score: float
    matched_at: datetime


class SearchResult(BaseModel):
    query: str
    scope: SearchScope
    hits: list[SearchHit]
    total_hits: int
