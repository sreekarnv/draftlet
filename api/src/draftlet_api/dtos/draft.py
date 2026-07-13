from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from draftlet_api.dtos.message import MessageRead


class SelectedMessage(BaseModel):
    author: str
    detail: str


class SelectedMessageList(BaseModel):
    items: list[SelectedMessage]


class DraftVariantCreate(BaseModel):
    title: str
    detail: str = ""
    body: str


class DraftVariantGenerate(BaseModel):
    instruction: str = ""
    tone: Literal["Direct", "Warm", "Formal", "Friendly"] = "Direct"
    length: Literal["Short", "Medium", "Long"] = "Short"
    coverage: Literal["Brief", "Answer all points", "Detailed"] = "Answer all points"
    model_override: str | None = None


class DraftVariantRead(DraftVariantCreate):
    model_config = ConfigDict(from_attributes=True)
    id: UUID


class DraftCreate(BaseModel):
    conversation_id: UUID
    title: str
    provider: str = "ollama"
    instruction: str = ""
    text: str = ""
    selected_messages: list[dict[str, str]] = Field(default_factory=list)
    references: list[str] = Field(default_factory=list)


class DraftUpdate(BaseModel):
    title: str | None = None
    instruction: str | None = None
    text: str | None = None
    status: str | None = None
    selected_variant_id: UUID | None = None
    selected_messages: list[dict[str, str]] | None = None
    references: list[str] | None = None


class DraftTelegramSendRequest(BaseModel):
    body: str | None = None
    reply_to_original: bool = True
    mark_sent: bool = True


class DraftRead(BaseModel):
    id: UUID
    conversation_id: UUID
    status: str
    title: str
    provider: str
    instruction: str
    text: str
    selected_variant_id: UUID | None
    selected_messages: list[SelectedMessage]
    references: list[str]
    variants: list[DraftVariantRead]
    created_at: datetime
    updated_at: datetime

    @field_validator("selected_messages", mode="before")
    @classmethod
    def coerce_selected_messages(cls, value: object) -> object:
        if isinstance(value, list):
            return [
                item
                if isinstance(item, SelectedMessage)
                else SelectedMessage.model_validate(item)
                for item in value
            ]
        return value


class DraftList(BaseModel):
    items: list[DraftRead]


class DraftTelegramSendResponse(BaseModel):
    draft: DraftRead
    message: MessageRead
    telegram_message_id: str
    reply_to_message_id: int | None = None
    reply_fallback: bool = False
