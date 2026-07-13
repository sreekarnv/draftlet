from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ConnectorUpdate(BaseModel):
    enabled: bool | None = None
    config: dict[str, object] | None = None


class ConnectorCreate(BaseModel):
    kind: str
    name: str
    enabled: bool = True
    config: dict[str, object] = Field(default_factory=dict)


class ConnectorRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    kind: str
    name: str
    enabled: bool
    config: dict[str, object] = Field(default_factory=dict)
    updated_at: datetime


class ConnectorDaemonStatusRead(BaseModel):
    kind: str
    state: str
    running: bool
    error: str | None = None
    paused: bool = False


class TelegramAuthStartRequest(BaseModel):
    phone: str = Field(min_length=4, max_length=32)


class TelegramAuthCodeRequest(BaseModel):
    phone: str = Field(min_length=4, max_length=32)
    code: str = Field(min_length=2, max_length=32)
    phone_code_hash: str | None = None


class TelegramAuthPasswordRequest(BaseModel):
    password: str = Field(min_length=1, max_length=256)


class TelegramAuthStatus(BaseModel):
    state: str
    connected: bool = False
    username: str | None = None
    phone: str | None = None
    phone_code_hash: str | None = None
    error: str | None = None
    delivery: str | None = None
    timeout: int | None = None
    next_delivery: str | None = None
    length: int | None = None


class TelegramQrStart(BaseModel):
    state: str
    url: str
    expires_at: datetime
    expires_in: int


class TelegramQrStatus(BaseModel):
    state: str
    connected: bool = False
    username: str | None = None
    error: str | None = None
    expires_at: datetime | None = None
    expires_in: int | None = None
