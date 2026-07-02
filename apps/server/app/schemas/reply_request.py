from typing import Literal

from pydantic import BaseModel, Field, field_validator


PlatformId = Literal["gmail", "whatsapp", "unknown"]


class ReplyRequest(BaseModel):
    selected_text: str = Field(min_length=1, max_length=8000)
    tone: str = Field(min_length=1, max_length=80)
    reply_surface: str | None = Field(default=None, max_length=40)
    reply_style: str | None = Field(default=None, max_length=40)
    source_url: str | None = Field(default=None, max_length=2048)
    source_domain: str | None = Field(default=None, max_length=255)
    page_title: str | None = Field(default=None, max_length=512)
    session_id: str | None = Field(default=None, max_length=120)
    thread_id: str | None = Field(default=None, max_length=120)
    turn_id: str | None = Field(default=None, max_length=120)
    run_id: str | None = Field(default=None, max_length=120)
    instruction: str | None = Field(default=None, max_length=4000)
    custom_tone_instruction: str | None = Field(default=None, max_length=1000)
    generation_mode: str = Field(default="initial", min_length=1, max_length=40)
    platform_id: PlatformId | None = Field(default=None, max_length=40)

    @field_validator(
        "selected_text",
        "tone",
        "reply_surface",
        "reply_style",
        "source_url",
        "source_domain",
        "page_title",
        "session_id",
        "thread_id",
        "turn_id",
        "run_id",
        "instruction",
        "custom_tone_instruction",
        "generation_mode",
        mode="before",
    )
    @classmethod
    def strip_text_fields(cls, value: str | None) -> str | None:
        if value is None:
            return None

        return value.strip() or None

    @field_validator("platform_id", mode="before")
    @classmethod
    def normalize_platform_id(cls, value: str | None) -> str | None:
        if value is None:
            return None

        normalized = value.strip().lower()

        if normalized in {"gmail", "whatsapp", "unknown"}:
            return normalized

        return "unknown"
