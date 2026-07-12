from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from draftlet_api.database.engine import get_db
from draftlet_api.dtos.setting import SettingRead, SettingUpdate
from draftlet_api.services.setting_service import SettingService

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("/{key}", response_model=SettingRead)
async def get_setting(key: str, db: AsyncSession = Depends(get_db)) -> SettingRead:
    return await SettingService(db).get(key)


@router.patch("/{key}", response_model=SettingRead)
async def update_setting(key: str, data: SettingUpdate, db: AsyncSession = Depends(get_db)) -> SettingRead:
    return await SettingService(db).update(key, data)
