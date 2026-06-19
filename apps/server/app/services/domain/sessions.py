from sqlalchemy.orm import Session

from app.db.models import WorkspaceSession
from app.schemas.domain import SourceSnapshot, WorkspaceSessionUpsert


def upsert_workspace_session(session: Session, payload: WorkspaceSessionUpsert) -> WorkspaceSession:
    existing = session.get(WorkspaceSession, payload.session_id)

    if existing:
        existing.tab_id = payload.tab_id if payload.tab_id is not None else existing.tab_id
        existing.window_id = payload.window_id if payload.window_id is not None else existing.window_id
        existing.page_url = payload.page_url
        existing.page_title = payload.page_title
        existing.selected_text = payload.selected_text
        existing.source_domain = payload.source_domain
        existing.status = payload.status
        existing.active_thread_id = payload.active_thread_id
        existing.active_turn_id = payload.active_turn_id
        existing.active_run_id = payload.active_run_id
        apply_compose_target(existing, payload.compose_target)
        session.add(existing)
        session.commit()
        session.refresh(existing)
        return existing

    workspace = WorkspaceSession(
        session_id=payload.session_id,
        tab_id=payload.tab_id,
        window_id=payload.window_id,
        page_url=payload.page_url,
        page_title=payload.page_title,
        selected_text=payload.selected_text,
        source_domain=payload.source_domain,
        status=payload.status,
        active_thread_id=payload.active_thread_id,
        active_turn_id=payload.active_turn_id,
        active_run_id=payload.active_run_id,
    )
    apply_compose_target(workspace, payload.compose_target)
    session.add(workspace)
    session.commit()
    session.refresh(workspace)
    return workspace


def apply_compose_target(workspace: WorkspaceSession, target) -> None:
    if not target:
        return

    workspace.compose_target_id = target.target_id
    workspace.compose_target_kind = target.kind
    workspace.compose_target_page_url = target.page_url
    workspace.compose_target_origin = target.origin
    workspace.compose_target_page_title = target.page_title
    workspace.compose_target_selector = target.selector
    workspace.compose_target_fingerprint = target.fingerprint
    workspace.compose_target_label = target.label
    workspace.compose_target_last_seen_at = target.last_seen_at


def ensure_workspace_session_exists(session: Session, session_id: str, source: SourceSnapshot) -> None:
    if session.get(WorkspaceSession, session_id):
        return

    workspace = WorkspaceSession(
        session_id=session_id,
        page_url=source.source_url,
        page_title=source.page_title,
        selected_text=source.selected_text,
        source_domain=source.source_domain,
        status="active",
    )
    session.add(workspace)
    session.commit()
