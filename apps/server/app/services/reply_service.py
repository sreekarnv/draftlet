from collections.abc import AsyncIterator
from uuid import uuid4

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import SessionLocal
from app.db.models import DraftVariant, Generation, Reply
from app.schemas.domain import ConversationThreadCreate, DraftVariantCreate, SourceSnapshot, TurnCreate, WorkspaceSessionUpsert
from app.schemas.reply_event import ReplyEvent
from app.schemas.reply_request import ReplyRequest
from app.services.domain_service import (
    create_or_update_thread,
    create_or_update_turn,
    create_or_update_variant,
    get_thread_snapshot,
    update_turn_status,
    upsert_workspace_session,
)
from app.services.ollama_client import OllamaClientError, stream_ollama_generate
from app.services.preference_service import (
    SERVER_MODEL_PREFERENCE_KEY,
    SERVER_MODEL_PREFERENCE_SCOPE,
    get_preference_value,
)
from app.services.prompt_builder import build_reply_prompt
from app.services.stream_parser import ReplyStreamParser


async def stream_reply_events(request: ReplyRequest) -> AsyncIterator[ReplyEvent]:
    settings = get_settings()
    parser = ReplyStreamParser()

    with SessionLocal() as session:
        model = request.model or get_default_model(session, settings.default_model)
        generation = create_generation(session, request, model)
        turn = ensure_domain_generation(session, request)
        thread_snapshot = get_thread_snapshot(session, request.thread_id) if request.thread_id else None
        prompt = build_reply_prompt(request, thread_snapshot)
        reply_index = 0

        try:
            if turn:
                update_turn_status(session, turn.turn_id, "streaming")

            async for chunk in stream_ollama_generate(
                base_url=settings.ollama_base_url,
                model=model,
                prompt=prompt,
            ):
                for reply in parser.feed(chunk):
                    persisted_reply = persist_reply(session, generation.id, reply_index, reply)
                    variant = persist_variant_for_reply(session, request, turn.turn_id if turn else None, reply_index, reply, persisted_reply.id)
                    reply_index += 1
                    yield ReplyEvent(
                        reply=reply,
                        reply_id=persisted_reply.id,
                        variant_id=variant.variant_id if variant else None,
                        turn_id=turn.turn_id if turn else None,
                        thread_id=request.thread_id,
                    )

            for reply in parser.finish():
                persisted_reply = persist_reply(session, generation.id, reply_index, reply)
                variant = persist_variant_for_reply(session, request, turn.turn_id if turn else None, reply_index, reply, persisted_reply.id)
                reply_index += 1
                yield ReplyEvent(
                    reply=reply,
                    reply_id=persisted_reply.id,
                    variant_id=variant.variant_id if variant else None,
                    turn_id=turn.turn_id if turn else None,
                    thread_id=request.thread_id,
                )

            update_generation_status(session, generation, "completed")
            if turn:
                update_turn_status(session, turn.turn_id, "completed")
        except OllamaClientError:
            update_generation_status(session, generation, "failed")
            if turn:
                update_turn_status(session, turn.turn_id, "failed")
            raise
        except Exception:
            update_generation_status(session, generation, "failed")
            if turn:
                update_turn_status(session, turn.turn_id, "failed")
            raise


def create_generation(session: Session, request: ReplyRequest, model: str) -> Generation:
    generation = Generation(
        selected_text=request.selected_text,
        tone=request.tone,
        model=model,
        source_url=request.source_url,
        source_domain=request.source_domain,
        status="streaming",
    )
    session.add(generation)
    session.commit()
    session.refresh(generation)
    return generation


def persist_reply(session: Session, generation_id: int, reply_index: int, text: str) -> Reply:
    reply = Reply(generation_id=generation_id, reply_index=reply_index, text=text)
    session.add(reply)
    session.commit()
    session.refresh(reply)
    return reply


def update_generation_status(session: Session, generation: Generation, status: str) -> None:
    generation.status = status
    session.add(generation)
    session.commit()


def ensure_domain_generation(session: Session, request: ReplyRequest):
    if not request.session_id or not request.thread_id or not request.turn_id or not request.source_url:
        return None

    source = SourceSnapshot(
        selected_text=request.selected_text,
        source_url=request.source_url,
        source_domain=request.source_domain,
        page_title=request.page_title,
    )
    upsert_workspace_session(
        session,
        WorkspaceSessionUpsert(
            session_id=request.session_id,
            page_url=request.source_url,
            page_title=request.page_title,
            selected_text=request.selected_text,
            source_domain=request.source_domain,
            active_thread_id=request.thread_id,
        ),
    )
    create_or_update_thread(
        session,
        ConversationThreadCreate(
            thread_id=request.thread_id,
            session_id=request.session_id,
            source=source,
        ),
    )
    return create_or_update_turn(
        session,
        TurnCreate(
            turn_id=request.turn_id,
            thread_id=request.thread_id,
            instruction=request.instruction or "Generate reply drafts",
            source=source,
            tone=request.tone,
            generation_status="queued",
        ),
    )


def persist_variant_for_reply(
    session: Session,
    request: ReplyRequest,
    turn_id: str | None,
    reply_index: int,
    text: str,
    reply_id: int,
) -> DraftVariant | None:
    if not turn_id:
        return None

    return create_or_update_variant(
        session,
        DraftVariantCreate(
            variant_id=f"variant-{uuid4()}",
            turn_id=turn_id,
            tone=request.tone,
            content=text,
            rank=reply_index,
            legacy_reply_id=reply_id,
        ),
    )


def get_default_model(session: Session, fallback_model: str) -> str:
    return get_preference_value(
        session,
        SERVER_MODEL_PREFERENCE_SCOPE,
        SERVER_MODEL_PREFERENCE_KEY,
    ) or fallback_model
