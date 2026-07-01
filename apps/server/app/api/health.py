from datetime import UTC, datetime

from fastapi import APIRouter, Depends

from app.core.config import (
    Settings,
    get_api_version,
    get_runtime_version,
    get_schema_version,
    get_server_port,
    get_settings,
)
from app.schemas.health import HealthResponse, VersionInfo


router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(
        status="healthy",
        service="draftlet-server",
        app="draftlet",
        version="0.2.0",
    )


@router.get("/version", response_model=VersionInfo)
def version(
    settings: Settings = Depends(get_settings),
) -> VersionInfo:
    return VersionInfo(
        runtime_version=get_runtime_version(),
        schema_version=get_schema_version(),
        api_version=get_api_version(),
        server_port=get_server_port(),
        default_model=settings.default_model,
        captured_at=datetime.now(UTC),
    )


__all__ = [
    "health",
    "router",
    "version",
]
