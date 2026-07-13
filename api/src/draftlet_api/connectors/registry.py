from draftlet_api.connectors.telegram.producer import telegram_producer
from draftlet_api.core.config import get_settings
from draftlet_api.database.engine import AsyncSessionLocal
from draftlet_api.repositories.connector_repository import ConnectorRepository


class ConnectorRegistry:
    async def start_all(self) -> None:
        settings = get_settings()
        if not settings.telegram_enabled:
            async with AsyncSessionLocal() as db:
                connector = await ConnectorRepository(db).get_by_kind("telegram")
                if not connector or not connector.enabled:
                    return
        await telegram_producer.start()

    async def stop_all(self) -> None:
        await telegram_producer.stop()

    def telegram_status(self) -> tuple[str, str | None]:
        return telegram_producer.state, telegram_producer.error


connector_registry = ConnectorRegistry()
