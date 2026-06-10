from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.domain import router as domain_router
from app.api.health import router as health_router
from app.api.preferences import router as preferences_router
from app.api.replies import router as replies_router
from app.core.database import SessionLocal
from app.core.config import get_settings
from app.schemas.domain import GenerationRunReconcileRequest
from app.services.domain_service import reconcile_stale_generation_runs


settings = get_settings()


def reconcile_interrupted_generation_runs_on_startup() -> None:
    with SessionLocal() as session:
        reconcile_stale_generation_runs(
            session,
            GenerationRunReconcileRequest(
                stale_after_seconds=0,
                error_code="runtime_restarted",
                error_message="Draft generation was interrupted because the runtime restarted.",
            ),
        )


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    reconcile_interrupted_generation_runs_on_startup()
    yield


app = FastAPI(title=settings.app_name, lifespan=lifespan)

# Local-dev integration: allow browser extension/content-script calls for now.
# Tighten origins when extension IDs and deployment shape are finalized.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(health_router)
app.include_router(replies_router)
app.include_router(domain_router)
app.include_router(preferences_router)
