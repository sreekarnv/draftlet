import inspect
from collections.abc import Awaitable
from typing import Any, cast

from telethon import TelegramClient


async def disconnect_client(client: TelegramClient) -> None:
    result = client.disconnect()
    if inspect.isawaitable(result):
        await cast(Awaitable[Any], result)
