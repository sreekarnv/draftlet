from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.db.models import ConversationThread, Turn, WorkspaceSession
from app.schemas.domain import TurnCreate, TurnStatusUpdate


def create_or_update_turn(session: Session, payload: TurnCreate) -> Turn:
    existing = session.get(Turn, payload.turn_id)

    if existing:
        existing.thread_id = payload.thread_id
        existing.instruction = payload.instruction
        existing.selected_text = payload.source.selected_text
        existing.source_url = payload.source.source_url
        existing.source_domain = payload.source.source_domain
        existing.page_title = payload.source.page_title
        existing.tone = payload.tone
        existing.generation_status = payload.generation_status
        turn = existing
    else:
        turn = Turn(
            turn_id=payload.turn_id,
            thread_id=payload.thread_id,
            instruction=payload.instruction,
            selected_text=payload.source.selected_text,
            source_url=payload.source.source_url,
            source_domain=payload.source.source_domain,
            page_title=payload.source.page_title,
            tone=payload.tone,
            generation_status=payload.generation_status,
        )

    session.add(turn)
    thread = session.get(ConversationThread, payload.thread_id)
    if thread:
        workspace = session.get(WorkspaceSession, thread.session_id)
        if workspace:
            workspace.active_thread_id = payload.thread_id
            workspace.active_turn_id = payload.turn_id
            session.add(workspace)

    session.commit()
    session.refresh(turn)
    return turn


def update_turn_status(
    session: Session,
    turn_id: str,
    status: str,
    error_code: str | None = None,
    error_message: str | None = None,
) -> Turn | None:
    return update_turn_lifecycle(
        session,
        turn_id,
        TurnStatusUpdate(status=status, error_code=error_code, error_message=error_message),
    )


def update_turn_lifecycle(session: Session, turn_id: str, payload: TurnStatusUpdate) -> Turn | None:
    turn = session.get(Turn, turn_id)

    if not turn:
        return None

    apply_turn_lifecycle(turn, payload.status, payload.error_code, payload.error_message)
    session.add(turn)
    session.commit()
    session.refresh(turn)
    return turn


def apply_turn_lifecycle(
    turn: Turn,
    status: str,
    error_code: str | None = None,
    error_message: str | None = None,
) -> None:
    now = datetime.now(UTC)
    turn.generation_status = status

    if status in {"started", "streaming"} and turn.generation_started_at is None:
        turn.generation_started_at = now

    if status == "completed":
        if turn.generation_started_at is None:
            turn.generation_started_at = now
        turn.generation_completed_at = now
        turn.generation_error_code = None
        turn.generation_error_message = None

    if status == "failed":
        if turn.generation_started_at is None:
            turn.generation_started_at = now
        turn.generation_failed_at = now
        turn.generation_error_code = error_code
        turn.generation_error_message = error_message

    if status == "cancelled":
        if turn.generation_started_at is None:
            turn.generation_started_at = now
        turn.generation_cancelled_at = now
        turn.generation_error_code = error_code
        turn.generation_error_message = error_message
