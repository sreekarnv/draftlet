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


class ComposeTargetRef(BaseModel):
    target_id: str = Field(min_length=1, max_length=160)
    kind: str = Field(min_length=1, max_length=40)
    page_url: str = Field(min_length=1, max_length=2048)
    origin: str | None = Field(default=None, max_length=255)
    page_title: str | None = Field(default=None, max_length=512)
    selector: str | None = Field(default=None, max_length=500)
    fingerprint: str = Field(min_length=1, max_length=1000)
    label: str | None = Field(default=None, max_length=160)
    last_seen_at: datetime

    @field_validator(
        "target_id",
        "kind",
        "page_url",
        "origin",
        "page_title",
        "selector",
        "fingerprint",
        "label",
        mode="before",
    )
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
    active_turn_id: str | None = Field(default=None, max_length=120)
    active_run_id: str | None = Field(default=None, max_length=120)
    compose_target: ComposeTargetRef | None = None

    @field_validator(
        "session_id",
        "page_url",
        "page_title",
        "selected_text",
        "source_domain",
        "status",
        "active_thread_id",
        "active_turn_id",
        "active_run_id",
        mode="before",
    )
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


class TurnStatusUpdate(BaseModel):
    status: str = Field(min_length=1, max_length=40)
    error_code: str | None = Field(default=None, max_length=120)
    error_message: str | None = Field(default=None, max_length=1000)

    @field_validator("status", "error_code", "error_message", mode="before")
    @classmethod
    def strip_text_fields(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip() or None


class GenerationRunClaim(BaseModel):
    run_id: str = Field(min_length=1, max_length=120)
    session_id: str = Field(min_length=1, max_length=120)
    thread_id: str = Field(min_length=1, max_length=120)
    turn_id: str = Field(min_length=1, max_length=120)
    lease_owner: str = Field(min_length=1, max_length=120)
    status: str = Field(default="active", min_length=1, max_length=40)
    stale_after_seconds: int = Field(default=30, ge=0)

    @field_validator("run_id", "session_id", "thread_id", "turn_id", "lease_owner", "status", mode="before")
    @classmethod
    def strip_text_fields(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip() or None


class GenerationRunStatusUpdate(BaseModel):
    status: str = Field(min_length=1, max_length=40)
    error_code: str | None = Field(default=None, max_length=120)
    error_message: str | None = Field(default=None, max_length=1000)

    @field_validator("status", "error_code", "error_message", mode="before")
    @classmethod
    def strip_text_fields(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip() or None


class GenerationRunReconcileRequest(BaseModel):
    session_id: str | None = Field(default=None, max_length=120)
    thread_id: str | None = Field(default=None, max_length=120)
    turn_id: str | None = Field(default=None, max_length=120)
    stale_after_seconds: int = Field(default=0, ge=0)
    error_code: str = Field(default="generation_interrupted", min_length=1, max_length=120)
    error_message: str = Field(default="Draft generation was interrupted before completion.", min_length=1, max_length=1000)

    @field_validator("session_id", "thread_id", "turn_id", "error_code", "error_message", mode="before")
    @classmethod
    def strip_text_fields(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip() or None


class GenerationRunHeartbeat(BaseModel):
    lease_owner: str | None = Field(default=None, max_length=120)

    @field_validator("lease_owner", mode="before")
    @classmethod
    def strip_text_fields(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip() or None


class DraftVariantCreate(BaseModel):
    variant_id: str = Field(min_length=1, max_length=120)
    turn_id: str = Field(min_length=1, max_length=120)
    tone: str = Field(min_length=1, max_length=80)
    content: str = Field(min_length=1)
    rank: int = Field(ge=0)
    status: str = Field(default="generated", min_length=1, max_length=40)
    is_current: bool = False
    length: str | None = Field(default=None, max_length=80)


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
    active_turn_id: str | None
    active_run_id: str | None
    compose_target: ComposeTargetRef | None = None
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
    generation_started_at: datetime | None = None
    generation_completed_at: datetime | None = None
    generation_failed_at: datetime | None = None
    generation_cancelled_at: datetime | None = None
    generation_error_code: str | None = None
    generation_error_message: str | None = None
    created_at: datetime
    updated_at: datetime


class GenerationRunRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    run_id: str
    session_id: str
    thread_id: str
    turn_id: str
    status: str
    lease_owner: str
    claimed_at: datetime
    heartbeat_at: datetime | None = None
    released_at: datetime | None = None
    completed_at: datetime | None = None
    cancelled_at: datetime | None = None
    interrupted_at: datetime | None = None
    failed_at: datetime | None = None
    error_code: str | None = None
    error_message: str | None = None
    created_at: datetime
    updated_at: datetime


class GenerationRunExecutionState(BaseModel):
    checked_at: datetime
    stale_after_seconds: int
    active: list[GenerationRunRead]
    live: list[GenerationRunRead]
    stale: list[GenerationRunRead]


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
    created_at: datetime
    updated_at: datetime


class ConversationThreadSnapshot(BaseModel):
    thread: ConversationThreadRead
    turns: list[TurnRead]
    variants: list[DraftVariantRead]


class GenerationRunProgressEvent(BaseModel):
    sequence: int
    event_type: str
    run_id: str
    session_id: str
    thread_id: str
    turn_id: str
    status: str | None = None
    variant_id: str | None = None
    at: datetime | None = None


class GenerationRunProgressSnapshot(BaseModel):
    checked_at: datetime
    run: GenerationRunRead
    thread: ConversationThreadSnapshot | None = None
    events: list[GenerationRunProgressEvent]
    replay_cursor: int


class WorkspaceSessionSnapshot(BaseModel):
    session: WorkspaceSessionRead
    thread: ConversationThreadSnapshot | None = None


class DomainHistoryItem(BaseModel):
    session: WorkspaceSessionRead
    thread: ConversationThreadSnapshot
