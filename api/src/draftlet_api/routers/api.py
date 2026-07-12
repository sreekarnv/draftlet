from fastapi import APIRouter

from draftlet_api.routers.v1 import api_v1_router

api_router = APIRouter(prefix="/api")
api_router.include_router(api_v1_router)
