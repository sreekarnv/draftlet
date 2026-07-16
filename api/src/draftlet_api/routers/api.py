from fastapi import APIRouter, Depends

from draftlet_api.core.auth import require_runtime_token
from draftlet_api.routers.v1 import api_v1_router

api_router = APIRouter(prefix="/api", dependencies=[Depends(require_runtime_token)])
api_router.include_router(api_v1_router)
