from pydantic import BaseModel, Field


class ReplyEvent(BaseModel):
    reply: str = Field(min_length=1)
    variant_id: str | None = Field(default=None, min_length=1)
    turn_id: str | None = Field(default=None, min_length=1)
    thread_id: str | None = Field(default=None, min_length=1)
