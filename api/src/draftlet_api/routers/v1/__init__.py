from fastapi import APIRouter

from draftlet_api.routers.v1 import (
    captures,
    connectors,
    conversations,
    drafts,
    events,
    generations,
    ollama,
    search,
    settings,
)

api_v1_router = APIRouter(prefix="/v1")
api_v1_router.include_router(conversations.router)
api_v1_router.include_router(captures.router)
api_v1_router.include_router(drafts.router)
api_v1_router.include_router(generations.router)
api_v1_router.include_router(connectors.router)
api_v1_router.include_router(settings.router)
api_v1_router.include_router(ollama.router)
api_v1_router.include_router(search.router)
api_v1_router.include_router(events.router)
