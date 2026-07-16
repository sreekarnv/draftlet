from collections.abc import Iterable

from draftlet_api.connectors.base import BaseConnector, ConnectorDaemonStatus
from draftlet_api.connectors.telegram.producer import telegram_producer
from draftlet_api.core.config import get_settings
from draftlet_api.core.errors import ConnectorError
from draftlet_api.database.engine import AsyncSessionLocal
from draftlet_api.repositories.connector_repository import ConnectorRepository


class ConnectorRegistry:
    def __init__(self, connectors: Iterable[BaseConnector] | None = None) -> None:
        self._connectors = {
            connector.kind: connector for connector in (connectors or [telegram_producer])
        }

    async def start_all(self) -> None:
        for kind in self._connectors:
            await self.start_enabled(kind)

    async def stop_all(self) -> None:
        for connector in self._connectors.values():
            await connector.stop()

    async def start_enabled(self, kind: str) -> None:
        if not await self._is_enabled(kind):
            return
        await self.start(kind)

    async def start(self, kind: str) -> None:
        await self._get(kind).start()

    async def stop(self, kind: str) -> None:
        await self._get(kind).stop()

    async def pause(self, kind: str) -> ConnectorDaemonStatus:
        connector = self._get(kind)
        await connector.pause()
        return connector.status()

    async def resume(self, kind: str) -> ConnectorDaemonStatus:
        connector = self._get(kind)
        await connector.resume()
        return connector.status()

    async def sync_once(self, kind: str) -> ConnectorDaemonStatus:
        connector = self._get(kind)
        await connector.sync_once()
        return connector.status()

    def status(self, kind: str | None = None) -> list[ConnectorDaemonStatus]:
        if kind is not None:
            return [self._get(kind).status()]
        return [connector.status() for connector in self._connectors.values()]

    def has(self, kind: str) -> bool:
        return kind in self._connectors

    def telegram_status(self) -> tuple[str, str | None]:
        status = self._get("telegram").status()
        return status.state, status.error

    def _get(self, kind: str) -> BaseConnector:
        connector = self._connectors.get(kind)
        if not connector:
            raise ConnectorError(
                "connector_daemon_not_found",
                f"No daemon registered for connector kind {kind}.",
                status=404,
            )
        return connector

    async def _is_enabled(self, kind: str) -> bool:
        settings = get_settings()
        if kind == "telegram" and settings.telegram_enabled:
            return True

        async with AsyncSessionLocal() as db:
            connector = await ConnectorRepository(db).get_by_kind(kind)
            return bool(connector and connector.enabled)


connector_registry = ConnectorRegistry()
