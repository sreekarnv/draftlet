import asyncio
from dataclasses import dataclass
from datetime import UTC, datetime
from contextlib import suppress

from telethon import TelegramClient
from telethon.errors import SessionPasswordNeededError

from draftlet_api.connectors.telegram.client import disconnect_client
from draftlet_api.connectors.telegram.config import (
    ensure_private_file,
    ensure_private_parent,
    telegram_session_path,
)
from draftlet_api.connectors.telegram.producer import telegram_producer
from draftlet_api.core.config import get_settings
from draftlet_api.core.errors import ConnectorError
from draftlet_api.dtos.connector import (
    TelegramAuthStatus,
    TelegramQrStart,
    TelegramQrStatus,
)


@dataclass
class _AuthState:
    state: str = "disconnected"
    phone: str | None = None
    phone_code_hash: str | None = None
    username: str | None = None
    error: str | None = None
    client: TelegramClient | None = None
    delivery: str | None = None
    timeout: int | None = None
    next_delivery: str | None = None
    length: int | None = None
    qr_login: object | None = None
    qr_client: TelegramClient | None = None
    qr_task: asyncio.Task[None] | None = None
    qr_url: str | None = None
    qr_expires_at: datetime | None = None


_state = _AuthState()


def _delivery_label(sent_code) -> tuple[str | None, int | None, str | None, int | None]:
    raw = sent_code.type
    type_name = type(raw).__name__ if raw is not None else None
    type_value = getattr(raw, "name", None) or (
        str(raw).split(".")[-1] if raw is not None else None
    )
    label = (
        f"{type_name} ({type_value})"
        if type_name and type_value
        else type_name or type_value
    )
    timeout = getattr(sent_code, "timeout", None)
    next_type = getattr(sent_code, "next_type", None)
    next_label = None
    if next_type is not None:
        next_name = type(next_type).__name__
        next_value = getattr(next_type, "name", None) or str(next_type).split(".")[-1]
        next_label = (
            f"{next_name} ({next_value})"
            if next_name and next_value
            else next_name or next_value
        )
    length = getattr(sent_code, "length", None)
    return label, timeout, next_label, length


def _credentials() -> tuple[int, str]:
    settings = get_settings()
    if not settings.telegram_api_id or not settings.telegram_api_hash:
        raise ConnectorError(
            "telegram_credentials_missing",
            "TELEGRAM_API_ID and TELEGRAM_API_HASH must be configured before connecting Telegram.",
        )
    return settings.telegram_api_id, settings.telegram_api_hash


def _client() -> TelegramClient:
    api_id, api_hash = _credentials()
    path = telegram_session_path()
    ensure_private_parent(path)
    return TelegramClient(str(path), api_id, api_hash)


def _seconds_until(value: datetime | None) -> int | None:
    if value is None:
        return None
    return max(0, int((value - datetime.now(UTC)).total_seconds()))


async def _cancel_qr() -> None:
    if _state.qr_task:
        _state.qr_task.cancel()
        with suppress(asyncio.CancelledError):
            await _state.qr_task
    if _state.qr_client and _state.qr_client.is_connected():
        await disconnect_client(_state.qr_client)
    _state.qr_login = None
    _state.qr_client = None
    _state.qr_task = None
    _state.qr_url = None
    _state.qr_expires_at = None


def _reset_phone_flow() -> None:
    _state.phone = None
    _state.phone_code_hash = None
    _state.delivery = None
    _state.timeout = None
    _state.next_delivery = None
    _state.length = None


async def send_code(phone: str) -> TelegramAuthStatus:
    if _state.state == "awaiting_qr":
        raise ConnectorError(
            "telegram_auth_in_progress", "Cancel QR login before starting phone login."
        )
    await telegram_producer.stop()
    client = _client()
    await client.connect()
    try:
        result = await client.send_code_request(phone)
    except Exception as error:
        _state.state = "error"
        _state.error = str(error)
        await disconnect_client(client)
        raise ConnectorError("telegram_auth_failed", str(error)) from error

    delivery, timeout, next_delivery, length = _delivery_label(result)
    _state.state = "awaiting_code"
    _state.phone = phone
    _state.phone_code_hash = result.phone_code_hash
    _state.error = None
    _state.client = client
    _state.delivery = delivery
    _state.timeout = timeout
    _state.next_delivery = next_delivery
    _state.length = length
    return status()


async def sign_in(
    phone: str, code: str, phone_code_hash: str | None = None
) -> TelegramAuthStatus:
    client = _state.client or _client()
    if not client.is_connected():
        await client.connect()
    code_hash = phone_code_hash or _state.phone_code_hash
    if code_hash is None:
        raise ConnectorError(
            "telegram_auth_missing_code_hash",
            "Request a Telegram login code before signing in.",
        )
    try:
        await client.sign_in(
            phone=phone,
            code=code,
            phone_code_hash=code_hash,
        )
    except SessionPasswordNeededError:
        _state.state = "awaiting_password"
        _state.phone = phone
        _state.client = client
        return status()
    except Exception as error:
        _state.state = "error"
        _state.error = str(error)
        await disconnect_client(client)
        raise ConnectorError("telegram_auth_failed", str(error)) from error

    await _mark_connected(client)
    return status()


async def sign_in_password(password: str) -> TelegramAuthStatus:
    client = _state.client or _client()
    if not client.is_connected():
        await client.connect()
    try:
        await client.sign_in(password=password)
    except Exception as error:
        _state.state = "error"
        _state.error = str(error)
        await disconnect_client(client)
        raise ConnectorError("telegram_auth_failed", str(error)) from error

    await _mark_connected(client)
    return status()


async def start_qr() -> TelegramQrStart:
    if _state.state in {"awaiting_code", "awaiting_password"}:
        raise ConnectorError(
            "telegram_auth_in_progress", "Cancel phone login before starting QR login."
        )
    await telegram_producer.stop()
    await _cancel_qr()
    client = _client()
    await client.connect()
    try:
        qr_login = await client.qr_login()
    except Exception as error:
        await disconnect_client(client)
        _state.state = "error"
        _state.error = str(error)
        raise ConnectorError("telegram_qr_failed", str(error)) from error

    _reset_phone_flow()
    _state.state = "awaiting_qr"
    _state.error = None
    _state.qr_client = client
    _state.qr_login = qr_login
    _state.qr_url = qr_login.url
    _state.qr_expires_at = qr_login.expires
    _state.qr_task = asyncio.create_task(
        _wait_for_qr(qr_login, client), name="telegram-qr-login"
    )
    return TelegramQrStart(
        state="awaiting_qr",
        url=qr_login.url,
        expires_at=qr_login.expires,
        expires_in=_seconds_until(qr_login.expires) or 0,
    )


async def _wait_for_qr(qr_login, client: TelegramClient) -> None:
    try:
        await qr_login.wait()
        await _mark_connected(client)
    except asyncio.TimeoutError:
        _state.state = "expired"
        _state.error = "QR login expired"
        await disconnect_client(client)
    except asyncio.CancelledError:
        raise
    except Exception as error:
        _state.state = "error"
        _state.error = str(error)
        await disconnect_client(client)


def qr_status() -> TelegramQrStatus:
    return TelegramQrStatus(
        state=_state.state,
        connected=_state.state == "connected",
        username=_state.username,
        error=_state.error,
        expires_at=_state.qr_expires_at,
        expires_in=_seconds_until(_state.qr_expires_at),
    )


async def cancel_qr() -> TelegramQrStatus:
    await _cancel_qr()
    if _state.state == "awaiting_qr":
        _state.state = "disconnected"
    return qr_status()


async def disconnect() -> TelegramAuthStatus:
    await _cancel_qr()
    await telegram_producer.stop()
    client = _state.client or _client()
    if not client.is_connected():
        await client.connect()
    await client.log_out()
    await disconnect_client(client)
    _state.state = "disconnected"
    _state.username = None
    _state.error = None
    _state.client = None
    _reset_phone_flow()
    return status()


async def _mark_connected(client: TelegramClient) -> None:
    me = await client.get_me()
    _state.state = "connected"
    _state.username = getattr(me, "username", None) or getattr(me, "first_name", None)
    _state.phone = getattr(me, "phone", None)
    _state.phone_code_hash = None
    _state.error = None
    ensure_private_file(telegram_session_path())
    await disconnect_client(client)
    _state.client = None
    _state.qr_client = None
    _state.qr_login = None
    _state.qr_task = None


def status() -> TelegramAuthStatus:
    return TelegramAuthStatus(
        state=_state.state,
        connected=_state.state == "connected",
        username=_state.username,
        phone=_state.phone,
        phone_code_hash=_state.phone_code_hash,
        error=_state.error,
        delivery=_state.delivery,
        timeout=_state.timeout,
        next_delivery=_state.next_delivery,
        length=_state.length,
    )


async def _current_producer_status() -> TelegramAuthStatus | None:
    client = telegram_producer.client
    if client and client.is_connected():
        try:
            if not await client.is_user_authorized():
                return None
            me = await client.get_me()
            username = getattr(me, "username", None) or getattr(me, "first_name", None)
            phone = getattr(me, "phone", None)
            _state.state = "connected"
            _state.username = username
            _state.phone = phone
            _state.error = None
            return TelegramAuthStatus(
                state="connected",
                connected=True,
                username=username,
                phone=phone,
                delivery=_state.delivery,
                timeout=_state.timeout,
                next_delivery=_state.next_delivery,
                length=_state.length,
            )
        except Exception as error:
            return TelegramAuthStatus(
                state="warning",
                connected=False,
                username=_state.username,
                phone=_state.phone,
                error=str(error),
                delivery=_state.delivery,
                timeout=_state.timeout,
                next_delivery=_state.next_delivery,
                length=_state.length,
            )

    if telegram_producer.task and not telegram_producer.task.done():
        return TelegramAuthStatus(
            state="connected"
            if telegram_producer.state == "ready"
            else telegram_producer.state,
            connected=telegram_producer.state == "ready",
            username=_state.username,
            phone=_state.phone,
            error=telegram_producer.error,
            delivery=_state.delivery,
            timeout=_state.timeout,
            next_delivery=_state.next_delivery,
            length=_state.length,
        )

    return None


async def current_status() -> TelegramAuthStatus:
    if _state.state != "disconnected":
        return status()

    path = telegram_session_path()
    if not path.exists():
        return status()

    producer_status = await _current_producer_status()
    if producer_status:
        return producer_status

    client = _client()
    await client.connect()
    try:
        if not await client.is_user_authorized():
            return status()
        me = await client.get_me()
        return TelegramAuthStatus(
            state="connected",
            connected=True,
            username=getattr(me, "username", None) or getattr(me, "first_name", None),
            phone=getattr(me, "phone", None),
            delivery=_state.delivery,
            timeout=_state.timeout,
            next_delivery=_state.next_delivery,
            length=_state.length,
        )
    finally:
        await disconnect_client(client)
