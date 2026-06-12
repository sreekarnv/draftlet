from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator, Awaitable, Callable
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Literal

from app.schemas.reply_event import ReplyEvent
from app.schemas.reply_request import ReplyRequest


ReplyExecutionStatus = Literal["event", "completed", "cancelled", "error"]


@dataclass(frozen=True)
class ReplyExecutionUpdate:
    status: ReplyExecutionStatus
    event: ReplyEvent | None = None
    message: str | None = None
    sequence: int = 0


@dataclass
class ReplyExecution:
    request: ReplyRequest
    task: asyncio.Task[None]
    subscribers: list[asyncio.Queue[ReplyExecutionUpdate]]
    replay: list[ReplyExecutionUpdate]
    next_sequence: int = 1
    completed_at: datetime | None = None


class ReplyExecutionRegistry:
    def __init__(
        self,
        producer: Callable[[ReplyRequest], AsyncIterator[ReplyEvent]],
        on_cancel_missing: Callable[[str], Awaitable[bool]],
        max_replay_updates_per_run: int = 50,
        max_replay_runs: int = 20,
    ) -> None:
        self._producer = producer
        self._on_cancel_missing = on_cancel_missing
        self._max_replay_updates_per_run = max_replay_updates_per_run
        self._max_replay_runs = max_replay_runs
        self._executions: dict[str, ReplyExecution] = {}
        self._lock = asyncio.Lock()

    async def start_and_subscribe(self, request: ReplyRequest) -> AsyncIterator[ReplyExecutionUpdate]:
        run_id = require_run_id(request)
        queue: asyncio.Queue[ReplyExecutionUpdate] = asyncio.Queue()
        replay: list[ReplyExecutionUpdate] = []

        async with self._lock:
            execution = self._executions.get(run_id)

            if execution:
                replay = list(execution.replay)
                execution.subscribers.append(queue)
            else:
                task = asyncio.create_task(self._run(request), name=f"draftlet-generation-{run_id}")
                self._executions[run_id] = ReplyExecution(request=request, task=task, subscribers=[queue], replay=[])

        try:
            for update in replay:
                yield update

                if update.status in {"completed", "cancelled", "error"}:
                    return

            while True:
                update = await queue.get()
                yield update

                if update.status in {"completed", "cancelled", "error"}:
                    break
        finally:
            await self._unsubscribe(run_id, queue)

    async def subscribe(self, run_id: str, after_sequence: int = 0) -> AsyncIterator[ReplyExecutionUpdate]:
        queue: asyncio.Queue[ReplyExecutionUpdate] = asyncio.Queue()

        async with self._lock:
            execution = self._executions.get(run_id)

            if not execution:
                raise KeyError(run_id)

            replay = [update for update in execution.replay if update.sequence > after_sequence]
            execution.subscribers.append(queue)

        try:
            for update in replay:
                yield update

                if update.status in {"completed", "cancelled", "error"}:
                    return

            while True:
                update = await queue.get()

                if update.sequence <= after_sequence:
                    continue

                yield update

                if update.status in {"completed", "cancelled", "error"}:
                    break
        finally:
            await self._unsubscribe(run_id, queue)

    async def cancel(self, run_id: str) -> bool:
        async with self._lock:
            execution = self._executions.get(run_id)

            if execution and not execution.task.done():
                execution.task.cancel()
                return True

        return await self._on_cancel_missing(run_id)

    async def has_live_execution(self, run_id: str) -> bool:
        async with self._lock:
            execution = self._executions.get(run_id)
            return bool(execution and not execution.task.done())

    async def _run(self, request: ReplyRequest) -> None:
        run_id = require_run_id(request)

        try:
            async for event in self._producer(request):
                await self._publish(run_id, ReplyExecutionUpdate(status="event", event=event))

            await self._publish(run_id, ReplyExecutionUpdate(status="completed"))
        except asyncio.CancelledError:
            await self._publish(
                run_id,
                ReplyExecutionUpdate(status="cancelled", message="Draft generation was cancelled."),
            )
        except Exception as error:
            await self._publish(run_id, ReplyExecutionUpdate(status="error", message=str(error)))
        finally:
            async with self._lock:
                execution = self._executions.get(run_id)

                if execution and execution.task is asyncio.current_task():
                    execution.completed_at = datetime.now(UTC)
                    self._prune_finished_locked()

    async def _publish(self, run_id: str, update: ReplyExecutionUpdate) -> None:
        async with self._lock:
            execution = self._executions.get(run_id)

            if not execution:
                return

            sequenced = ReplyExecutionUpdate(
                status=update.status,
                event=update.event,
                message=update.message,
                sequence=execution.next_sequence,
            )
            execution.next_sequence += 1
            execution.replay.append(sequenced)
            execution.replay = execution.replay[-self._max_replay_updates_per_run:]
            subscribers = list(execution.subscribers)

        for subscriber in subscribers:
            await subscriber.put(sequenced)

    async def _unsubscribe(self, run_id: str, queue: asyncio.Queue[ReplyExecutionUpdate]) -> None:
        async with self._lock:
            execution = self._executions.get(run_id)

            if execution and queue in execution.subscribers:
                execution.subscribers.remove(queue)

    def _prune_finished_locked(self) -> None:
        finished = [
            (run_id, execution)
            for run_id, execution in self._executions.items()
            if execution.task.done() and execution.completed_at is not None
        ]

        if len(finished) <= self._max_replay_runs:
            return

        finished.sort(key=lambda item: item[1].completed_at or datetime.min.replace(tzinfo=UTC))

        for run_id, _execution in finished[: len(finished) - self._max_replay_runs]:
            self._executions.pop(run_id, None)


def require_run_id(request: ReplyRequest) -> str:
    if not request.run_id:
        raise ValueError("Runtime-owned reply execution requires run_id.")

    return request.run_id
