from sqlalchemy.orm import Session

from app.db.models import ConversationThread, WorkspaceSession
from app.schemas.domain import ConversationThreadCreate
from app.services.domain.sessions import ensure_workspace_session_exists


def create_or_update_thread(session: Session, payload: ConversationThreadCreate) -> ConversationThread:
    ensure_workspace_session_exists(session, payload.session_id, payload.source)
    existing = session.get(ConversationThread, payload.thread_id)

    if existing:
        existing.session_id = payload.session_id
        existing.selected_text = payload.source.selected_text
        existing.source_url = payload.source.source_url
        existing.source_domain = payload.source.source_domain
        existing.page_title = payload.source.page_title
        existing.status = payload.status
        thread = existing
    else:
        thread = ConversationThread(
            thread_id=payload.thread_id,
            session_id=payload.session_id,
            selected_text=payload.source.selected_text,
            source_url=payload.source.source_url,
            source_domain=payload.source.source_domain,
            page_title=payload.source.page_title,
            status=payload.status,
        )

    workspace = session.get(WorkspaceSession, payload.session_id)
    if workspace:
        workspace.active_thread_id = payload.thread_id
        session.add(workspace)

    session.add(thread)
    session.commit()
    session.refresh(thread)
    return thread
