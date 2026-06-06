from collections.abc import AsyncIterator

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import SessionLocal
from app.db.models import Generation, Reply
from app.schemas.reply_event import ReplyEvent
from app.schemas.reply_request import ReplyRequest
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
    prompt = build_reply_prompt(request)
    parser = ReplyStreamParser()

    with SessionLocal() as session:
        model = request.model or get_default_model(session, settings.default_model)
        generation = create_generation(session, request, model)
        reply_index = 0

        try:
            async for chunk in stream_ollama_generate(
                base_url=settings.ollama_base_url,
                model=model,
                prompt=prompt,
            ):
                for reply in parser.feed(chunk):
                    persisted_reply = persist_reply(session, generation.id, reply_index, reply)
                    reply_index += 1
                    yield ReplyEvent(reply=reply, reply_id=persisted_reply.id)

            for reply in parser.finish():
                persisted_reply = persist_reply(session, generation.id, reply_index, reply)
                reply_index += 1
                yield ReplyEvent(reply=reply, reply_id=persisted_reply.id)

            update_generation_status(session, generation, "completed")
        except OllamaClientError:
            update_generation_status(session, generation, "failed")
            raise
        except Exception:
            update_generation_status(session, generation, "failed")
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


def get_default_model(session: Session, fallback_model: str) -> str:
    return get_preference_value(
        session,
        SERVER_MODEL_PREFERENCE_SCOPE,
        SERVER_MODEL_PREFERENCE_KEY,
    ) or fallback_model
