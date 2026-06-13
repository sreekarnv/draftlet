import asyncio

import pytest

from fastapi import HTTPException

from app.api.replies import format_sse_event, validate_runtime_reply_request
from app.main import app
from app.schemas.reply_event import ReplyEvent
from app.schemas.reply_request import ReplyRequest
from app.services.execution_registry import ReplyExecutionRegistry


def test_formats_domain_variant_sse_without_legacy_reply_id() -> None:
    event = ReplyEvent(
        reply="Domain draft",
        variant_id="variant-1",
        turn_id="turn-1",
        thread_id="thread-1",
    )

    formatted = format_sse_event(event)

    assert formatted.startswith("event: variant_persisted\n")
    assert "reply_id" not in formatted
    assert "id:" not in formatted
    assert "variant-1" in formatted


def test_legacy_history_route_is_not_registered() -> None:
    assert not any(route.path == "/history" and "GET" in route.methods for route in app.routes if hasattr(route, "methods"))
    assert any(route.path == "/domain/history" and "GET" in route.methods for route in app.routes if hasattr(route, "methods"))


def test_runtime_reply_execution_registry_streams_terminal_updates() -> None:
    async def run() -> tuple[bool, list[str]]:
        async def produce(_request: ReplyRequest):
            yield ReplyEvent(reply="Generated draft", variant_id="variant-1", turn_id="turn-1", thread_id="thread-1")

        async def cancel_missing(_run_id: str) -> bool:
            return False

        registry = ReplyExecutionRegistry(producer=produce, on_cancel_missing=cancel_missing)
        request = ReplyRequest(
            selected_text="Please reply.",
            tone="friendly",
            source_url="https://example.com",
            session_id="session-1",
            thread_id="thread-1",
            turn_id="turn-1",
            run_id="run-1",
        )
        statuses: list[str] = []

        start = await registry.start(request)

        async for update in registry.subscribe("run-1"):
            statuses.append(update.status)

        return start.started, statuses

    assert asyncio.run(run()) == (True, ["run_started", "event", "run_completed"])


def test_runtime_reply_execution_registry_starts_then_subscribes() -> None:
    async def run() -> tuple[bool, list[tuple[str, int]]]:
        async def produce(_request: ReplyRequest):
            yield ReplyEvent(reply="Generated draft", variant_id="variant-1", turn_id="turn-1", thread_id="thread-1")

        async def cancel_missing(_run_id: str) -> bool:
            return False

        registry = ReplyExecutionRegistry(producer=produce, on_cancel_missing=cancel_missing)
        request = ReplyRequest(
            selected_text="Please reply.",
            tone="friendly",
            source_url="https://example.com",
            session_id="session-1",
            thread_id="thread-1",
            turn_id="turn-1",
            run_id="run-1",
        )

        start = await registry.start(request)
        updates: list[tuple[str, int]] = []

        async for update in registry.subscribe("run-1"):
            updates.append((update.status, update.sequence))

        return start.started, updates

    assert asyncio.run(run()) == (True, [("run_started", 1), ("event", 2), ("run_completed", 3)])


def test_runtime_reply_execution_registry_replays_recent_updates() -> None:
    async def run() -> list[tuple[str, int]]:
        async def produce(_request: ReplyRequest):
            yield ReplyEvent(reply="First draft", variant_id="variant-1", turn_id="turn-1", thread_id="thread-1")
            yield ReplyEvent(reply="Second draft", variant_id="variant-2", turn_id="turn-1", thread_id="thread-1")

        async def cancel_missing(_run_id: str) -> bool:
            return False

        registry = ReplyExecutionRegistry(producer=produce, on_cancel_missing=cancel_missing)
        request = ReplyRequest(
            selected_text="Please reply.",
            tone="friendly",
            source_url="https://example.com",
            session_id="session-1",
            thread_id="thread-1",
            turn_id="turn-1",
            run_id="run-1",
        )

        await registry.start(request)

        async for _update in registry.subscribe("run-1"):
            pass

        replayed: list[tuple[str, int]] = []
        async for update in registry.subscribe("run-1", after_sequence=1):
            replayed.append((update.status, update.sequence))

        return replayed

    assert asyncio.run(run()) == [("event", 2), ("event", 3), ("run_completed", 4)]


def test_legacy_reply_start_and_stream_endpoint_is_not_registered() -> None:
    assert not any(route.path == "/replies" and "POST" in route.methods for route in app.routes if hasattr(route, "methods"))


def test_runtime_reply_start_requires_domain_routing_metadata() -> None:
    with pytest.raises(HTTPException) as raised:
        validate_runtime_reply_request(ReplyRequest(selected_text="Please reply.", tone="friendly"))

    assert raised.value.status_code == 400
    assert "session_id" in raised.value.detail
    assert "thread_id" in raised.value.detail
    assert "turn_id" in raised.value.detail
    assert "source_url" in raised.value.detail


def test_runtime_reply_execution_cancel_endpoint_is_registered() -> None:
    assert any(route.path == "/replies/{run_id}/cancel" and "POST" in route.methods for route in app.routes if hasattr(route, "methods"))


def test_runtime_reply_execution_start_endpoint_is_registered() -> None:
    assert any(route.path == "/replies/{run_id}/start" and "POST" in route.methods for route in app.routes if hasattr(route, "methods"))


def test_runtime_reply_execution_events_endpoint_is_registered() -> None:
    assert any(route.path == "/replies/{run_id}/events" and "GET" in route.methods for route in app.routes if hasattr(route, "methods"))
