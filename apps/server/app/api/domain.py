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
    GenerationRunClaim,
    GenerationRunExecutionState,
    GenerationRunHeartbeat,
    GenerationRunProgressSnapshot,
    GenerationRunRead,
    GenerationRunReconcileRequest,
    GenerationRunStatusUpdate,
    TurnCreate,
    TurnRead,
    TurnStatusUpdate,
    WorkspaceSessionRead,
    WorkspaceSessionSnapshot,
    WorkspaceSessionUpsert,
)
from app.services.domain_service import (
    create_or_update_thread,
    create_or_update_turn,
    create_or_update_variant,
    GenerationRunConflictError,
    claim_generation_run,
    get_session_snapshot,
    get_generation_run_progress_snapshot,
    get_thread_snapshot,
    heartbeat_generation_run,
    inspect_generation_run_execution_state,
    list_active_generation_runs,
    list_recent_domain_history,
    reconcile_stale_generation_runs,
    update_generation_run_status,
    update_variant_state,
    update_turn_lifecycle,
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
    payload: TurnStatusUpdate | None = None,
    status: str | None = None,
    session: Session = Depends(get_session),
) -> TurnRead:
    if payload is not None:
        turn = update_turn_lifecycle(session, turn_id, payload)
    elif status is not None:
        turn = update_turn_status(session, turn_id, status)
    else:
        raise HTTPException(status_code=400, detail="status is required")

    if not turn:
        raise HTTPException(status_code=404, detail="Turn not found")

    return turn


@router.put("/generation-runs/{run_id}", response_model=GenerationRunRead)
def put_generation_run(
    run_id: str,
    payload: GenerationRunClaim,
    session: Session = Depends(get_session),
) -> GenerationRunRead:
    if payload.run_id != run_id:
        raise HTTPException(status_code=400, detail="run_id does not match path")

    try:
        run = claim_generation_run(session, payload)
    except GenerationRunConflictError as error:
        raise HTTPException(
            status_code=409,
            detail={
                "code": error.code,
                "message": str(error),
                "run_id": error.run.run_id,
                "session_id": error.run.session_id,
                "thread_id": error.run.thread_id,
                "turn_id": error.run.turn_id,
            },
        ) from error

    if not run:
        raise HTTPException(status_code=404, detail="Generation run domain refs not found")

    return run


@router.get("/generation-runs/active", response_model=list[GenerationRunRead])
def get_active_generation_runs(
    session_id: str | None = None,
    thread_id: str | None = None,
    turn_id: str | None = None,
    session: Session = Depends(get_session),
) -> list[GenerationRunRead]:
    return list_active_generation_runs(session, session_id=session_id, thread_id=thread_id, turn_id=turn_id)


@router.get("/generation-runs/execution-state", response_model=GenerationRunExecutionState)
def get_generation_run_execution_state(
    session_id: str | None = None,
    thread_id: str | None = None,
    turn_id: str | None = None,
    stale_after_seconds: int = Query(default=30, ge=0),
    session: Session = Depends(get_session),
) -> GenerationRunExecutionState:
    return inspect_generation_run_execution_state(
        session,
        session_id=session_id,
        thread_id=thread_id,
        turn_id=turn_id,
        stale_after_seconds=stale_after_seconds,
    )


@router.get("/generation-runs/{run_id}/progress", response_model=GenerationRunProgressSnapshot)
def get_generation_run_progress(
    run_id: str,
    after_sequence: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
    session: Session = Depends(get_session),
) -> GenerationRunProgressSnapshot:
    snapshot = get_generation_run_progress_snapshot(session, run_id, after_sequence=after_sequence, limit=limit)

    if not snapshot:
        raise HTTPException(status_code=404, detail="Generation run not found")

    return snapshot


@router.patch("/generation-runs/{run_id}/heartbeat", response_model=GenerationRunRead)
def patch_generation_run_heartbeat(
    run_id: str,
    payload: GenerationRunHeartbeat | None = None,
    session: Session = Depends(get_session),
) -> GenerationRunRead:
    run = heartbeat_generation_run(session, run_id, payload)

    if not run:
        raise HTTPException(status_code=404, detail="Generation run not found")

    return run


@router.patch("/generation-runs/{run_id}/status", response_model=GenerationRunRead)
def patch_generation_run_status(
    run_id: str,
    payload: GenerationRunStatusUpdate,
    session: Session = Depends(get_session),
) -> GenerationRunRead:
    run = update_generation_run_status(session, run_id, payload)

    if not run:
        raise HTTPException(status_code=404, detail="Generation run not found")

    return run


@router.post("/generation-runs/reconcile", response_model=list[GenerationRunRead])
def post_reconcile_generation_runs(
    payload: GenerationRunReconcileRequest,
    session: Session = Depends(get_session),
) -> list[GenerationRunRead]:
    return reconcile_stale_generation_runs(session, payload)


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
