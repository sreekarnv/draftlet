from collections.abc import AsyncIterator
import json

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.schemas.reply_event import ReplyEvent
from app.schemas.reply_request import ReplyRequest
from app.services.ollama_client import OllamaClientError
from app.services.reply_service import stream_reply_events


router = APIRouter(tags=["replies"])


@router.post("/replies")
def create_replies(request: ReplyRequest) -> StreamingResponse:
    async def events() -> AsyncIterator[str]:
        try:
            async for event in stream_reply_events(request):
                yield format_sse_event(event)
        except OllamaClientError as error:
            yield format_sse_error(str(error))

    return StreamingResponse(events(), media_type="text/event-stream")


def format_sse_event(event: ReplyEvent) -> str:
    event_lines = []

    if event.reply_id is not None:
        event_lines.append(f"id: {event.reply_id}")

    if event.variant_id:
        event_lines.append("event: draft_variant")
        payload = {
            "reply": event.reply,
            "reply_id": event.reply_id,
            "variant_id": event.variant_id,
            "turn_id": event.turn_id,
            "thread_id": event.thread_id,
        }
        event_lines.append(f"data: {json.dumps(payload, separators=(',', ':'))}")
        return f"{'\n'.join(event_lines)}\n\n"

    reply_lines = event.reply.splitlines() or [""]
    event_lines.extend(f"data: {line}" for line in reply_lines)
    return f"{'\n'.join(event_lines)}\n\n"


def format_sse_error(message: str) -> str:
    lines = message.splitlines() or ["Could not stream replies."]
    data = "\n".join(f"data: {line}" for line in lines)
    return f"event: error\n{data}\n\n"
