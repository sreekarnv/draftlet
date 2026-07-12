from typing import Literal
from uuid import UUID

from pydantic import BaseModel


class GenerationCreate(BaseModel):
    conversation_id: UUID
    instruction: str = ""
    tone: Literal["Direct", "Warm", "Formal", "Friendly"] = "Direct"
    length: Literal["Short", "Medium", "Long"] = "Short"
    coverage: Literal["Brief", "Answer all points", "Detailed"] = "Answer all points"
    model_override: str | None = None
