from collections.abc import AsyncIterator
import json

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse

from app.schemas.reply_event import ReplyEvent
from app.schemas.reply_request import ReplyRequest
from app.services.execution_registry import ReplyExecutionRegistry, ReplyExecutionUpdate
from app.services.reply_service import cancel_reply_execution_record, generate_reply_events


router = APIRouter(tags=["replies"])


async def cancel_missing_reply_execution(run_id: str) -> bool:
    return cancel_reply_execution_record(run_id)


reply_execution_registry = ReplyExecutionRegistry(
    producer=generate_reply_events,
    on_cancel_missing=cancel_missing_reply_execution,
)


@router.post("/replies")
def create_replies(request: ReplyRequest) -> StreamingResponse:
    async def events() -> AsyncIterator[str]:
        try:
            async for update in reply_execution_registry.start_and_subscribe(request):
                yield format_sse_update(update)
        except ValueError as error:
            yield format_sse_error(str(error))

    return StreamingResponse(events(), media_type="text/event-stream")


@router.post("/replies/{run_id}/start")
async def start_reply_execution(run_id: str, request: ReplyRequest) -> dict[str, bool | str]:
    if request.run_id and request.run_id != run_id:
        raise HTTPException(status_code=400, detail="run_id does not match path")

    start = await reply_execution_registry.start(request.model_copy(update={"run_id": run_id}))
    return {
        "run_id": start.run_id,
        "started": start.started,
        "live": start.live,
    }


@router.post("/replies/{run_id}/cancel")
async def cancel_reply_execution(run_id: str) -> dict[str, bool]:
    cancelled = await reply_execution_registry.cancel(run_id)

    if not cancelled:
        raise HTTPException(status_code=404, detail="Generation run was not found.")

    return {"cancelled": True}


@router.get("/replies/{run_id}/events")
async def subscribe_reply_execution_events(
    run_id: str,
    after: int = Query(default=0, ge=0),
) -> StreamingResponse:
    async def events() -> AsyncIterator[str]:
        try:
            async for update in reply_execution_registry.subscribe(run_id, after_sequence=after):
                yield format_sse_update(update)
        except KeyError:
            yield format_sse_error("Generation run does not have a live or recent replay feed.")

    return StreamingResponse(events(), media_type="text/event-stream")


@router.get("/replies/{run_id}/execution")
async def get_reply_execution(run_id: str) -> dict[str, bool | str]:
    return {
        "run_id": run_id,
        "live": await reply_execution_registry.has_live_execution(run_id),
    }


def format_sse_update(update: ReplyExecutionUpdate) -> str:
    if update.status == "event" and update.event:
        return format_sse_event(update.event, update.sequence)

    if update.status == "error":
        return format_sse_error(update.message or "Could not stream replies.", update.sequence)

    lines = []

    if update.sequence:
        lines.append(f"id: {update.sequence}")

    lines.append(f"event: {update.status}")
    lines.append(f"data: {update.message or update.status}")
    return f"{'\n'.join(lines)}\n\n"


def format_sse_event(event: ReplyEvent, sequence: int = 0) -> str:
    event_lines = []

    if sequence:
        event_lines.append(f"id: {sequence}")

    if event.variant_id:
        event_lines.append("event: draft_variant")
        payload = {
            "reply": event.reply,
            "variant_id": event.variant_id,
            "turn_id": event.turn_id,
            "thread_id": event.thread_id,
        }
        event_lines.append(f"data: {json.dumps(payload, separators=(',', ':'))}")
        return f"{'\n'.join(event_lines)}\n\n"

    reply_lines = event.reply.splitlines() or [""]
    event_lines.extend(f"data: {line}" for line in reply_lines)
    return f"{'\n'.join(event_lines)}\n\n"


def format_sse_error(message: str, sequence: int = 0) -> str:
    prefix = f"id: {sequence}\n" if sequence else ""
    lines = message.splitlines() or ["Could not stream replies."]
    data = "\n".join(f"data: {line}" for line in lines)
    return f"{prefix}event: error\n{data}\n\n"
