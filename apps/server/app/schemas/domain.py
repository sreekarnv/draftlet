from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class SourceSnapshot(BaseModel):
    selected_text: str = Field(min_length=1, max_length=8000)
    source_url: str = Field(min_length=1, max_length=2048)
    source_domain: str | None = Field(default=None, max_length=255)
    page_title: str | None = Field(default=None, max_length=512)

    @field_validator("selected_text", "source_url", "source_domain", "page_title", mode="before")
    @classmethod
    def strip_text_fields(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip() or None


class WorkspaceSessionUpsert(BaseModel):
    session_id: str = Field(min_length=1, max_length=120)
    tab_id: int | None = None
    window_id: int | None = None
    page_url: str = Field(min_length=1, max_length=2048)
    page_title: str | None = Field(default=None, max_length=512)
    selected_text: str = Field(min_length=1, max_length=8000)
    source_domain: str | None = Field(default=None, max_length=255)
    status: str = Field(default="active", min_length=1, max_length=40)
    active_thread_id: str | None = Field(default=None, max_length=120)

    @field_validator("session_id", "page_url", "page_title", "selected_text", "source_domain", "status", "active_thread_id", mode="before")
    @classmethod
    def strip_text_fields(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip() or None


class ConversationThreadCreate(BaseModel):
    thread_id: str = Field(min_length=1, max_length=120)
    session_id: str = Field(min_length=1, max_length=120)
    source: SourceSnapshot
    status: str = Field(default="active", min_length=1, max_length=40)


class TurnCreate(BaseModel):
    turn_id: str = Field(min_length=1, max_length=120)
    thread_id: str = Field(min_length=1, max_length=120)
    instruction: str = Field(default="Generate reply drafts", min_length=1, max_length=4000)
    source: SourceSnapshot
    tone: str = Field(min_length=1, max_length=80)
    generation_status: str = Field(default="queued", min_length=1, max_length=40)


class DraftVariantCreate(BaseModel):
    variant_id: str = Field(min_length=1, max_length=120)
    turn_id: str = Field(min_length=1, max_length=120)
    tone: str = Field(min_length=1, max_length=80)
    content: str = Field(min_length=1)
    rank: int = Field(ge=0)
    status: str = Field(default="generated", min_length=1, max_length=40)
    is_current: bool = False
    length: str | None = Field(default=None, max_length=80)
    legacy_reply_id: int | None = Field(default=None, ge=1)


class DraftVariantStateUpdate(BaseModel):
    is_current: bool | None = None
    status: str | None = Field(default=None, min_length=1, max_length=40)


class WorkspaceSessionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    session_id: str
    tab_id: int | None
    window_id: int | None
    page_url: str
    page_title: str | None
    selected_text: str
    source_domain: str | None
    status: str
    active_thread_id: str | None
    created_at: datetime
    updated_at: datetime


class ConversationThreadRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    thread_id: str
    session_id: str
    selected_text: str
    source_url: str
    source_domain: str | None
    page_title: str | None
    status: str
    created_at: datetime
    updated_at: datetime


class TurnRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    turn_id: str
    thread_id: str
    instruction: str
    selected_text: str
    source_url: str
    source_domain: str | None
    page_title: str | None
    tone: str
    generation_status: str
    created_at: datetime
    updated_at: datetime


class DraftVariantRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    variant_id: str
    turn_id: str
    tone: str
    length: str | None
    content: str
    rank: int
    status: str
    is_current: bool
    legacy_reply_id: int | None
    created_at: datetime
    updated_at: datetime


class ConversationThreadSnapshot(BaseModel):
    thread: ConversationThreadRead
    turns: list[TurnRead]
    variants: list[DraftVariantRead]


class WorkspaceSessionSnapshot(BaseModel):
    session: WorkspaceSessionRead
    thread: ConversationThreadSnapshot | None = None


class DomainHistoryItem(BaseModel):
    session: WorkspaceSessionRead
    thread: ConversationThreadSnapshot
