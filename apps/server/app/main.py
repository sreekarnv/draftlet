from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.domain import router as domain_router
from app.api.diagnostics import router as diagnostics_router
from app.api.health import router as health_router
from app.api.preferences import router as preferences_router
from app.api.replies import router as replies_router
from app.core.database import SessionLocal
from app.core.config import get_settings
from app.schemas.domain import GenerationRunReconcileRequest
from app.services.diagnostics_service import record_generation_run_maintenance_outcome
from app.services.domain_service import (
    DEFAULT_GENERATION_RUN_EVENT_PRUNE_BATCH_SIZE,
    DEFAULT_GENERATION_RUN_EVENT_REPLAY_LIMIT,
    DEFAULT_GENERATION_RUN_EVENT_RETENTION_DAYS,
    prune_terminal_generation_run_events,
    reconcile_stale_generation_runs,
)


settings = get_settings()


def maintain_generation_runs_on_startup() -> None:
    with SessionLocal() as session:
        try:
            reconciled_runs = reconcile_stale_generation_runs(
                session,
                GenerationRunReconcileRequest(
                    stale_after_seconds=0,
                    error_code="runtime_restarted",
                    error_message="Draft generation was interrupted because the runtime restarted.",
                ),
                maintenance_source="startup",
            )
            pruned_event_count = prune_terminal_generation_run_events(session, maintenance_source="startup")
            record_generation_run_maintenance_outcome(
                "startup_maintenance",
                source="startup",
                reconciled_run_ids=[run.run_id for run in reconciled_runs],
                pruned_event_count=pruned_event_count,
                stale_after_seconds=0,
                retention_days=DEFAULT_GENERATION_RUN_EVENT_RETENTION_DAYS,
                replay_limit=DEFAULT_GENERATION_RUN_EVENT_REPLAY_LIMIT,
                prune_batch_size=DEFAULT_GENERATION_RUN_EVENT_PRUNE_BATCH_SIZE,
                session=session,
            )
        except Exception as error:
            session.rollback()
            record_generation_run_maintenance_outcome(
                "startup_maintenance",
                status="error",
                source="startup",
                error_code=type(error).__name__,
                error_message=str(error),
                session=session,
            )
            raise


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    maintain_generation_runs_on_startup()
    yield


app = FastAPI(title=settings.app_name, lifespan=lifespan)

# Local-dev CORS: the extension service worker and any local Vite/desktop
# tooling call this server from known loopback origins. The allowlist is
# configurable through `DRAFTLET_CORS_ALLOW_ORIGINS` and
# `DRAFTLET_CORS_ALLOW_ORIGIN_REGEX` (see `app.core.config`). See
# `docs/setup.md` for the chrome-extension origin trade-off.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allow_origins,
    allow_origin_regex=settings.cors_allow_origin_regex,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(health_router)
app.include_router(replies_router)
app.include_router(domain_router)
app.include_router(preferences_router)
app.include_router(diagnostics_router)
