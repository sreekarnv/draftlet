from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ConnectorUpdate(BaseModel):
    enabled: bool | None = None
    config: dict[str, object] | None = None


class ConnectorRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    kind: str
    name: str
    enabled: bool
    config: dict[str, object] = Field(default_factory=dict)
    updated_at: datetime
