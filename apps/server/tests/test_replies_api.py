import asyncio

import pytest

from fastapi import HTTPException

from app.api.replies import format_sse_event, validate_runtime_reply_request
from app.main import app
from app.schemas.reply_event import ReplyEvent
from app.schemas.reply_request import ReplyRequest
from app.services.execution_registry import ReplyExecutionRegistry, ReplyExecutionUpdate


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


def test_runtime_reply_execution_registry_replays_durable_updates_without_live_execution() -> None:
    async def run() -> list[tuple[str, int]]:
        async def produce(_request: ReplyRequest):
            if False:
                yield ReplyEvent(reply="unused")

        async def cancel_missing(_run_id: str) -> bool:
            return False

        def load_replay(_run_id: str, after_sequence: int, _limit: int) -> list[ReplyExecutionUpdate]:
            updates = [
                ReplyExecutionUpdate(status="run_started", sequence=1),
                ReplyExecutionUpdate(
                    status="event",
                    event=ReplyEvent(reply="Generated draft", variant_id="variant-1", turn_id="turn-1", thread_id="thread-1"),
                    sequence=2,
                ),
                ReplyExecutionUpdate(status="run_completed", sequence=3),
            ]
            return [update for update in updates if update.sequence > after_sequence]

        registry = ReplyExecutionRegistry(
            producer=produce,
            on_cancel_missing=cancel_missing,
            load_replay=load_replay,
        )
        replayed: list[tuple[str, int]] = []

        async for update in registry.subscribe("run-1", after_sequence=1):
            replayed.append((update.status, update.sequence))

        return replayed

    assert asyncio.run(run()) == [("event", 2), ("run_completed", 3)]


def test_runtime_reply_execution_registry_reports_live_then_replay_only_feed() -> None:
    async def run() -> tuple[bool, bool, list[tuple[str, int]]]:
        producer_started = asyncio.Event()
        release_producer = asyncio.Event()

        async def produce(_request: ReplyRequest):
            producer_started.set()
            await release_producer.wait()
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

        await registry.start(request)
        await asyncio.wait_for(producer_started.wait(), timeout=1)
        live_feed = await registry.inspect_feed("run-1")

        release_producer.set()
        replayed: list[tuple[str, int]] = []
        async for update in registry.subscribe("run-1"):
            replayed.append((update.status, update.sequence))

        replay_only_feed = await registry.inspect_feed("run-1", after_sequence=1)

        return live_feed.live, replay_only_feed.live, replayed

    assert asyncio.run(run()) == (
        True,
        False,
        [("run_started", 1), ("event", 2), ("run_completed", 3)],
    )


def test_runtime_reply_execution_registry_does_not_wait_on_finished_feed_after_cursor() -> None:
    async def run() -> list[ReplyExecutionUpdate]:
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

        await registry.start(request)
        async for _update in registry.subscribe("run-1"):
            pass

        async def collect_after_terminal_cursor() -> list[ReplyExecutionUpdate]:
            updates: list[ReplyExecutionUpdate] = []
            async for update in registry.subscribe("run-1", after_sequence=3):
                updates.append(update)
            return updates

        return await asyncio.wait_for(collect_after_terminal_cursor(), timeout=1)

    assert asyncio.run(run()) == []


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


def test_runtime_reply_execution_status_endpoint_is_not_registered() -> None:
    assert not any(route.path == "/replies/{run_id}/execution" and "GET" in route.methods for route in app.routes if hasattr(route, "methods"))
