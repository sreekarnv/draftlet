from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel


class SearchResult(BaseModel):
    item_type: Literal["conversation", "draft"]
    id: UUID
    title: str
    subtitle: str
    snippet: str
    updated_at: datetime


class SearchResultList(BaseModel):
    items: list[SearchResult]
