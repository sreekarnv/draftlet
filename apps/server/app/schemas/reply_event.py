from pydantic import BaseModel, Field


class ReplyEvent(BaseModel):
    reply: str = Field(min_length=1)
    reply_id: int | None = Field(default=None, ge=1)
