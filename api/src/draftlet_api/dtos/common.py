from pydantic import BaseModel


class Page(BaseModel):
    next_cursor: str | None = None
