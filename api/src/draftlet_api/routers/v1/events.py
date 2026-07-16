import asyncio
from collections.abc import AsyncIterator

from fastapi import APIRouter, Request, WebSocket, WebSocketDisconnect
from starlette.responses import StreamingResponse

from draftlet_api.services.event_bus import runtime_event_bus

router = APIRouter(prefix="/events", tags=["events"])


@router.websocket("/ws")
async def runtime_events(websocket: WebSocket) -> None:
    await runtime_event_bus.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await runtime_event_bus.disconnect(websocket)


@router.get("/stream")
async def runtime_event_stream(request: Request) -> StreamingResponse:
    async def stream() -> AsyncIterator[str]:
        queue = await runtime_event_bus.subscribe_sse()
        try:
            yield ": connected\n\n"
            while not await request.is_disconnected():
                try:
                    payload = await asyncio.wait_for(queue.get(), timeout=15)
                    yield f"data: {payload}\n\n"
                except TimeoutError:
                    yield ": heartbeat\n\n"
        finally:
            await runtime_event_bus.unsubscribe_sse(queue)

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    )


@router.get("/status")
async def runtime_events_status() -> dict[str, int]:
    return await runtime_event_bus.status()
