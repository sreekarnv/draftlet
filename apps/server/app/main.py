from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.domain import router as domain_router
from app.api.health import router as health_router
from app.api.preferences import router as preferences_router
from app.api.replies import router as replies_router
from app.core.config import get_settings


settings = get_settings()

app = FastAPI(title=settings.app_name)

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
