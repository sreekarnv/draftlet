from datetime import datetime

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str
    service: str
    app: str
    version: str


class VersionInfo(BaseModel):
    runtime_version: str = Field(min_length=1, max_length=40)
    schema_version: str = Field(min_length=1, max_length=40)
    api_version: str = Field(min_length=1, max_length=40)
    server_port: int = Field(ge=0, le=65535)
    default_model: str = Field(min_length=1, max_length=160)
    captured_at: datetime
