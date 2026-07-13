import asyncio
import json
import logging
from typing import Any

from fastapi import WebSocket

logger = logging.getLogger(__name__)

RuntimeEvent = dict[str, Any]


class RuntimeEventBus:
    def __init__(self) -> None:
        self._connections: set[WebSocket] = set()
        self._sse_subscribers: set[asyncio.Queue[str]] = set()
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self._connections.add(websocket)

    async def disconnect(self, websocket: WebSocket) -> None:
        async with self._lock:
            self._connections.discard(websocket)

    async def subscribe_sse(self) -> asyncio.Queue[str]:
        queue: asyncio.Queue[str] = asyncio.Queue(maxsize=100)
        async with self._lock:
            self._sse_subscribers.add(queue)
        return queue

    async def unsubscribe_sse(self, queue: asyncio.Queue[str]) -> None:
        async with self._lock:
            self._sse_subscribers.discard(queue)

    async def status(self) -> dict[str, int]:
        async with self._lock:
            return {
                "websocket_connections": len(self._connections),
                "sse_subscribers": len(self._sse_subscribers),
            }

    async def broadcast(self, event: RuntimeEvent) -> None:
        async with self._lock:
            connections = list(self._connections)
            subscribers = list(self._sse_subscribers)

        stale: list[WebSocket] = []
        for websocket in connections:
            try:
                await websocket.send_json(event)
            except Exception as error:
                logger.debug("Runtime event websocket send failed: %s", error)
                stale.append(websocket)

        if stale:
            async with self._lock:
                for websocket in stale:
                    self._connections.discard(websocket)

        payload = json.dumps(event, separators=(",", ":"))
        stale_subscribers: list[asyncio.Queue[str]] = []
        for queue in subscribers:
            try:
                queue.put_nowait(payload)
            except asyncio.QueueFull:
                stale_subscribers.append(queue)

        if stale_subscribers:
            async with self._lock:
                for queue in stale_subscribers:
                    self._sse_subscribers.discard(queue)


runtime_event_bus = RuntimeEventBus()
