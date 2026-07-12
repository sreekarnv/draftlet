from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class MessageCreate(BaseModel):
    kind: str
    author: str
    body: str
    status: str | None = None
    timestamp: datetime | None = None


class MessageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    kind: str
    author: str
    timestamp: datetime
    body: str
    status: str | None
