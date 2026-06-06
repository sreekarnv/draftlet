from pydantic import BaseModel, Field, field_validator


class ReplyRequest(BaseModel):
    selected_text: str = Field(min_length=1, max_length=8000)
    tone: str = Field(min_length=1, max_length=80)
    model: str | None = Field(default=None, max_length=120)
    source_url: str | None = Field(default=None, max_length=2048)
    source_domain: str | None = Field(default=None, max_length=255)

    @field_validator("selected_text", "tone", "model", "source_url", "source_domain", mode="before")
    @classmethod
    def strip_text_fields(cls, value: str | None) -> str | None:
        if value is None:
            return None

        return value.strip() or None
