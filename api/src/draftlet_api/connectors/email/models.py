from datetime import datetime

from pydantic import BaseModel, Field


class EmailCapture(BaseModel):
    provider: str
    provider_message_id: str = Field(min_length=1, max_length=255)
    provider_thread_id: str | None = Field(default=None, max_length=255)
    reply_to_provider_message_id: str | None = Field(default=None, max_length=255)
    subject: str = "Untitled email"
    sender: str = "Unknown"
    to: list[str] = Field(default_factory=list)
    cc: list[str] = Field(default_factory=list)
    bcc: list[str] = Field(default_factory=list)
    body: str
    body_format: str = "plain"
    url: str | None = None
    timestamp: datetime | None = None
    metadata: dict[str, object] = Field(default_factory=dict)
