from sqlalchemy.ext.asyncio import AsyncSession

from draftlet_api.database.models import Setting


class SettingRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get(self, key: str) -> Setting | None:
        return await self.db.get(Setting, key)

    async def save(self, setting: Setting) -> Setting:
        self.db.add(setting)
        await self.db.commit()
        await self.db.refresh(setting)
        return setting
