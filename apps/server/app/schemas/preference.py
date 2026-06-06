from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class PreferenceUpsert(BaseModel):
    scope: str = Field(min_length=1, max_length=80)
    key: str = Field(min_length=1, max_length=120)
    value: str


class PreferenceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    scope: str
    key: str
    value: str
    created_at: datetime
    updated_at: datetime
