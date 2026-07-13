from dataclasses import dataclass

from telethon import TelegramClient
from telethon.errors import FloodWaitError, RPCError

from draftlet_api.connectors.telegram.config import telegram_session_path
from draftlet_api.connectors.telegram.producer import telegram_producer
from draftlet_api.core.config import get_settings
from draftlet_api.core.errors import ConnectorError


@dataclass
class TelegramSentMessage:
    id: int
    date: object | None
    reply_fallback: bool = False


class TelegramSender:
    async def send_message(
        self,
        chat_id: int,
        body: str,
        reply_to: int | None = None,
    ) -> TelegramSentMessage:
        settings = get_settings()
        if not settings.telegram_api_id or not settings.telegram_api_hash:
            raise ConnectorError(
                "telegram_credentials_missing",
                "TELEGRAM_API_ID and TELEGRAM_API_HASH must be configured before sending Telegram messages.",
                status=401,
            )

        path = telegram_session_path(settings)
        if not path.exists():
            raise ConnectorError(
                "telegram_session_missing",
                "Connect Telegram before sending messages.",
                status=401,
            )

        producer_client = telegram_producer.client
        if producer_client and producer_client.is_connected():
            if not await producer_client.is_user_authorized():
                raise ConnectorError(
                    "telegram_session_unauthorized",
                    "Reconnect Telegram before sending messages.",
                    status=401,
                )
            return await self._send_with_client(
                producer_client, chat_id, body, reply_to
            )

        client = TelegramClient(
            str(path), settings.telegram_api_id, settings.telegram_api_hash
        )
        await client.connect()
        try:
            if not await client.is_user_authorized():
                raise ConnectorError(
                    "telegram_session_unauthorized",
                    "Reconnect Telegram before sending messages.",
                    status=401,
                )

            return await self._send_with_client(client, chat_id, body, reply_to)
        except FloodWaitError as error:
            raise ConnectorError(
                "telegram_flood_wait",
                f"Telegram rate-limited this send. Retry in {error.seconds} seconds.",
                status=429,
            ) from error
        except ConnectorError:
            raise
        except Exception as error:
            raise ConnectorError(
                "telegram_send_failed", str(error), status=502
            ) from error
        finally:
            await client.disconnect()

    async def _send_with_client(
        self,
        client: TelegramClient,
        chat_id: int,
        body: str,
        reply_to: int | None,
    ) -> TelegramSentMessage:
        try:
            sent = await client.send_message(chat_id, body, reply_to=reply_to)
            return TelegramSentMessage(id=sent.id, date=sent.date, reply_fallback=False)
        except RPCError:
            if reply_to is None:
                raise
            sent = await client.send_message(chat_id, body)
            return TelegramSentMessage(id=sent.id, date=sent.date, reply_fallback=True)
