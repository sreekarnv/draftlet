from datetime import UTC, datetime
from typing import Callable

from sqlalchemy.ext.asyncio import AsyncSession

from draftlet_api.core.config import get_settings
from draftlet_api.core.errors import NotFoundError
from draftlet_api.database.models import Setting
from draftlet_api.dtos.setting import SettingRead, SettingUpdate
from draftlet_api.repositories.setting_repository import SettingRepository


DEFAULT_SETTINGS: dict[str, Callable[[], object]] = {
    "ollama_default_model": lambda: get_settings().ollama_default_model,
}


class SettingService:
    def __init__(self, db: AsyncSession):
        self.repository = SettingRepository(db)

    async def get(self, key: str) -> SettingRead:
        setting = await self.repository.get(key)
        if setting:
            return SettingRead.model_validate(setting)

        default_factory = DEFAULT_SETTINGS.get(key)
        if default_factory:
            return SettingRead(
                key=key,
                value=default_factory(),
                updated_at=datetime.now(UTC),
            )

        raise NotFoundError("setting", key)

    async def update(self, key: str, payload: SettingUpdate) -> SettingRead:
        setting = await self.repository.get(key) or Setting(
            key=key,
            value=payload.value,
        )
        setting.value = payload.value
        return SettingRead.model_validate(await self.repository.save(setting))
