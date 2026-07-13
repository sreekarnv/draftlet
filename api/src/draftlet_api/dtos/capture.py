from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from draftlet_api.core.enums import ConnectorKind


class CaptureCreate(BaseModel):
    connector_kind: ConnectorKind
    source_message_id: str = Field(min_length=1, max_length=255)
    external_thread_id: str | None = None
    external_message_id: str | None = None
    reply_to_external_message_id: str | None = None
    metadata: dict[str, object] = Field(default_factory=dict)
    title: str
    contact: str
    participants: str = ""
    body: str
    author: str = "Unknown"
    timestamp: datetime | None = None


class CaptureRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    connector_kind: ConnectorKind
    source_message_id: str
    external_thread_id: str | None = None
    external_message_id: str | None = None
    conversation_id: UUID | None
    message_id: UUID | None
    status: str
    captured_at: datetime


class CaptureList(BaseModel):
    items: list[CaptureRead]
