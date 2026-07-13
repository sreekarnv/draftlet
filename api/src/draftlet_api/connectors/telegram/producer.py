import asyncio
import logging
from contextlib import suppress

from telethon import TelegramClient, events
from telethon.errors import FloodWaitError, RPCError

from draftlet_api.connectors.base import BaseConnector
from draftlet_api.connectors.telegram.config import (
    ensure_private_parent,
    telegram_session_path,
)
from draftlet_api.connectors.telegram.mapper import capture_from_message
from draftlet_api.core.config import get_settings
from draftlet_api.database.engine import AsyncSessionLocal
from draftlet_api.services.capture_service import CaptureService

logger = logging.getLogger(__name__)


class TelegramProducer(BaseConnector):
    def __init__(self) -> None:
        self.task: asyncio.Task[None] | None = None
        self.client: TelegramClient | None = None
        self.state = "offline"
        self.error: str | None = None

    async def start(self) -> None:
        if self.task and not self.task.done():
            return
        self.task = asyncio.create_task(self._run(), name="telegram-producer")

    async def stop(self) -> None:
        if self.task:
            self.task.cancel()
            with suppress(asyncio.CancelledError):
                await self.task
        if self.client and self.client.is_connected():
            await self.client.disconnect()
        self.state = "offline"

    async def _run(self) -> None:
        settings = get_settings()
        if not settings.telegram_api_id or not settings.telegram_api_hash:
            self.state = "disabled"
            self.error = "Telegram credentials are not configured"
            return

        path = telegram_session_path(settings)
        if not path.exists():
            self.state = "disabled"
            self.error = "Telegram session is not connected"
            return

        ensure_private_parent(path)
        backoff = 1
        while True:
            try:
                self.client = TelegramClient(
                    str(path), settings.telegram_api_id, settings.telegram_api_hash
                )
                await self.client.connect()
                if not await self.client.is_user_authorized():
                    self.state = "disabled"
                    self.error = "Telegram session is not authorized"
                    await self.client.disconnect()
                    return

                @self.client.on(events.NewMessage(incoming=True))
                async def handler(event: events.NewMessage.Event) -> None:
                    await self._ingest(event.message)

                self.state = "ready"
                self.error = None
                backoff = 1
                await self.client.run_until_disconnected()
            except asyncio.CancelledError:
                raise
            except FloodWaitError as error:
                self.state = "warning"
                self.error = f"Flood wait: retrying in {error.seconds}s"
                await asyncio.sleep(error.seconds + 1)
            except (ConnectionError, OSError, RPCError) as error:
                self.state = "warning"
                self.error = str(error)
                logger.warning("Telegram producer disconnected: %s", error)
                await asyncio.sleep(backoff)
                backoff = min(backoff * 2, 60)
            finally:
                if self.client and self.client.is_connected():
                    await self.client.disconnect()

    async def _ingest(self, message) -> None:
        try:
            payload = await capture_from_message(message)
            async with AsyncSessionLocal() as db:
                await CaptureService(db).ingest(payload)
        except Exception as error:
            self.state = "warning"
            self.error = str(error)
            logger.warning("Telegram message ingest failed: %s", error)


telegram_producer = TelegramProducer()
