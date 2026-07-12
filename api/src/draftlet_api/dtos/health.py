from pydantic import BaseModel


class ComponentHealth(BaseModel):
    ok: bool
    detail: str | None = None


class HealthRead(BaseModel):
    status: str
    version: str
    database: ComponentHealth
    ollama: ComponentHealth
