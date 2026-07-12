from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from draftlet_api.dtos.message import MessageRead


class ConversationCreate(BaseModel):
    connector: str
    title: str
    contact: str
    participants: str = ""
    source: str = ""
    needs_follow_up: bool = False


class ConversationUpdate(BaseModel):
    title: str | None = None
    contact: str | None = None
    participants: str | None = None
    source: str | None = None
    needs_follow_up: bool | None = None
    recently_captured: bool | None = None


class ConversationRead(BaseModel):
    id: UUID
    connector: str
    title: str
    contact: str
    participants: str
    source: str
    latest_message: str
    timestamp: datetime
    captured_at: datetime
    draft_pending: bool
    needs_follow_up: bool
    recently_captured: bool
    draft_ids: list[UUID] = Field(default_factory=list)
    latest_draft_id: UUID | None = None
    messages: list[MessageRead] = Field(default_factory=list)


class ConversationList(BaseModel):
    items: list[ConversationRead]
    next_cursor: str | None = None
