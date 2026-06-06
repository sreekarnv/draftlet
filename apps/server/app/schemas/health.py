from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str
    service: str
    app: str
    version: str
