from datetime import datetime

from pydantic import BaseModel, ConfigDict


class HistoryReply(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    reply_index: int
    text: str
    created_at: datetime


class HistoryGeneration(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    selected_text: str
    tone: str
    model: str
    source_url: str | None
    source_domain: str | None
    status: str
    created_at: datetime
    replies: list[HistoryReply]
