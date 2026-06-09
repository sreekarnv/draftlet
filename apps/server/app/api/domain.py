from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import get_session
from app.schemas.domain import (
    ConversationThreadCreate,
    ConversationThreadRead,
    DomainHistoryItem,
    ConversationThreadSnapshot,
    DraftVariantCreate,
    DraftVariantRead,
    DraftVariantStateUpdate,
    TurnCreate,
    TurnRead,
    WorkspaceSessionRead,
    WorkspaceSessionSnapshot,
    WorkspaceSessionUpsert,
)
from app.services.domain_service import (
    create_or_update_thread,
    create_or_update_turn,
    create_or_update_variant,
    get_session_snapshot,
    get_thread_snapshot,
    list_recent_domain_history,
    update_variant_state,
    update_turn_status,
    upsert_workspace_session,
)

router = APIRouter(prefix="/domain", tags=["domain"])


@router.get("/history", response_model=list[DomainHistoryItem])
def get_domain_history(
    limit: int = Query(default=20, ge=1, le=100),
    session: Session = Depends(get_session),
) -> list[DomainHistoryItem]:
    return list_recent_domain_history(session, limit=limit)


@router.put("/sessions/{session_id}", response_model=WorkspaceSessionRead)
def put_workspace_session(
    session_id: str,
    payload: WorkspaceSessionUpsert,
    session: Session = Depends(get_session),
) -> WorkspaceSessionRead:
    if payload.session_id != session_id:
        raise HTTPException(status_code=400, detail="session_id does not match path")

    return upsert_workspace_session(session, payload)


@router.get("/sessions/{session_id}", response_model=WorkspaceSessionSnapshot)
def get_workspace_session_snapshot(
    session_id: str,
    session: Session = Depends(get_session),
) -> WorkspaceSessionSnapshot:
    snapshot = get_session_snapshot(session, session_id)

    if not snapshot:
        raise HTTPException(status_code=404, detail="Workspace session not found")

    return snapshot


@router.put("/threads/{thread_id}", response_model=ConversationThreadRead)
def put_conversation_thread(
    thread_id: str,
    payload: ConversationThreadCreate,
    session: Session = Depends(get_session),
) -> ConversationThreadRead:
    if payload.thread_id != thread_id:
        raise HTTPException(status_code=400, detail="thread_id does not match path")

    return create_or_update_thread(session, payload)


@router.get("/threads/{thread_id}", response_model=ConversationThreadSnapshot)
def get_conversation_thread_snapshot(
    thread_id: str,
    session: Session = Depends(get_session),
) -> ConversationThreadSnapshot:
    snapshot = get_thread_snapshot(session, thread_id)

    if not snapshot:
        raise HTTPException(status_code=404, detail="Conversation thread not found")

    return snapshot


@router.put("/turns/{turn_id}", response_model=TurnRead)
def put_turn(
    turn_id: str,
    payload: TurnCreate,
    session: Session = Depends(get_session),
) -> TurnRead:
    if payload.turn_id != turn_id:
        raise HTTPException(status_code=400, detail="turn_id does not match path")

    return create_or_update_turn(session, payload)


@router.patch("/turns/{turn_id}/status", response_model=TurnRead)
def patch_turn_status(
    turn_id: str,
    status: str,
    session: Session = Depends(get_session),
) -> TurnRead:
    turn = update_turn_status(session, turn_id, status)

    if not turn:
        raise HTTPException(status_code=404, detail="Turn not found")

    return turn


@router.put("/variants/{variant_id}", response_model=DraftVariantRead)
def put_draft_variant(
    variant_id: str,
    payload: DraftVariantCreate,
    session: Session = Depends(get_session),
) -> DraftVariantRead:
    if payload.variant_id != variant_id:
        raise HTTPException(status_code=400, detail="variant_id does not match path")

    return create_or_update_variant(session, payload)



@router.patch("/variants/{variant_id}/state", response_model=ConversationThreadSnapshot)
def patch_draft_variant_state(
    variant_id: str,
    payload: DraftVariantStateUpdate,
    session: Session = Depends(get_session),
) -> ConversationThreadSnapshot:
    snapshot = update_variant_state(session, variant_id, payload)

    if not snapshot:
        raise HTTPException(status_code=404, detail="Draft variant not found")

    return snapshot
