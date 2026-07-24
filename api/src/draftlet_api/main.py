from contextlib import asynccontextmanager
from collections.abc import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from draftlet_api.connectors.registry import connector_registry
from draftlet_api.core.config import get_settings
from draftlet_api.core.errors import DraftletApiError
from draftlet_api.core.logging import configure_logging
from draftlet_api.middleware.problem_details import problem_details_handler
from draftlet_api.routers import api_router, health_router


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    await connector_registry.start_all()
    try:
        yield
    finally:
        await connector_registry.stop_all()


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging(settings.log_level)
    app = FastAPI(title="Draftlet Runtime", version="1.0.0-alpha1.1", lifespan=lifespan)
    app.add_exception_handler(DraftletApiError, problem_details_handler)
    if settings.cors_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.cors_origins,
            allow_methods=["GET", "POST", "PATCH", "DELETE"],
            allow_headers=["Content-Type", "X-Draftlet-Runtime-Token"],
        )
    app.include_router(health_router)
    app.include_router(api_router)
    return app


app = create_app()
