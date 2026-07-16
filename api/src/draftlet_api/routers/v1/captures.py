from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from draftlet_api.database.engine import get_db
from draftlet_api.dtos.capture import CaptureCreate, CaptureList, CaptureRead
from draftlet_api.services.capture_service import CaptureService

router = APIRouter(prefix="/captures", tags=["captures"])


@router.get("", response_model=CaptureList)
async def list_captures(
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
) -> CaptureList:
    return CaptureList(items=await CaptureService(db).list(limit))


@router.post("", response_model=CaptureRead, status_code=status.HTTP_201_CREATED)
async def ingest_capture(
    payload: CaptureCreate,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> CaptureRead:
    capture, created = await CaptureService(db).ingest(payload)
    if not created:
        response.status_code = status.HTTP_200_OK
    return capture
