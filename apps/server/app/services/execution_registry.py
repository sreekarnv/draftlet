from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator, Awaitable, Callable
from dataclasses import dataclass
from typing import Literal

from app.schemas.reply_event import ReplyEvent
from app.schemas.reply_request import ReplyRequest


ReplyExecutionStatus = Literal["event", "completed", "cancelled", "error"]


@dataclass(frozen=True)
class ReplyExecutionUpdate:
    status: ReplyExecutionStatus
    event: ReplyEvent | None = None
    message: str | None = None


@dataclass
class ReplyExecution:
    request: ReplyRequest
    task: asyncio.Task[None]
    subscribers: list[asyncio.Queue[ReplyExecutionUpdate]]


class ReplyExecutionRegistry:
    def __init__(
        self,
        producer: Callable[[ReplyRequest], AsyncIterator[ReplyEvent]],
        on_cancel_missing: Callable[[str], Awaitable[bool]],
    ) -> None:
        self._producer = producer
        self._on_cancel_missing = on_cancel_missing
        self._executions: dict[str, ReplyExecution] = {}
        self._lock = asyncio.Lock()

    async def start_and_subscribe(self, request: ReplyRequest) -> AsyncIterator[ReplyExecutionUpdate]:
        run_id = require_run_id(request)
        queue: asyncio.Queue[ReplyExecutionUpdate] = asyncio.Queue()

        async with self._lock:
            execution = self._executions.get(run_id)

            if execution:
                execution.subscribers.append(queue)
            else:
                task = asyncio.create_task(self._run(request), name=f"draftlet-generation-{run_id}")
                self._executions[run_id] = ReplyExecution(request=request, task=task, subscribers=[queue])

        try:
            while True:
                update = await queue.get()
                yield update

                if update.status in {"completed", "cancelled", "error"}:
                    break
        finally:
            await self._unsubscribe(run_id, queue)

    async def cancel(self, run_id: str) -> bool:
        async with self._lock:
            execution = self._executions.get(run_id)

            if execution:
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
                await self._broadcast(run_id, ReplyExecutionUpdate(status="event", event=event))

            await self._broadcast(run_id, ReplyExecutionUpdate(status="completed"))
        except asyncio.CancelledError:
            await self._broadcast(
                run_id,
                ReplyExecutionUpdate(status="cancelled", message="Draft generation was cancelled."),
            )
        except Exception as error:
            await self._broadcast(run_id, ReplyExecutionUpdate(status="error", message=str(error)))
        finally:
            async with self._lock:
                execution = self._executions.get(run_id)

                if execution and execution.task is asyncio.current_task():
                    self._executions.pop(run_id, None)

    async def _broadcast(self, run_id: str, update: ReplyExecutionUpdate) -> None:
        async with self._lock:
            subscribers = list(self._executions.get(run_id).subscribers if run_id in self._executions else [])

        for subscriber in subscribers:
            await subscriber.put(update)

    async def _unsubscribe(self, run_id: str, queue: asyncio.Queue[ReplyExecutionUpdate]) -> None:
        async with self._lock:
            execution = self._executions.get(run_id)

            if execution and queue in execution.subscribers:
                execution.subscribers.remove(queue)


def require_run_id(request: ReplyRequest) -> str:
    if not request.run_id:
        raise ValueError("Runtime-owned reply execution requires run_id.")

    return request.run_id
