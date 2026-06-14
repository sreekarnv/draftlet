from datetime import UTC, datetime

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
    GenerationRunLiveFeedAttachment,
    GenerationRunProgressSnapshot,
    GenerationRunRead,
    GenerationRunReconcileRequest,
    GenerationRunRestoreCandidate,
    GenerationRunStatusUpdate,
    TurnCreate,
    TurnRead,
    TurnStatusUpdate,
    WorkspaceSessionRead,
    WorkspaceSessionSnapshot,
    WorkspaceSessionUpsert,
)
from app.api.replies import inspect_reply_execution_feed
from app.services.domain_service import (
    ACTIVE_GENERATION_RUN_STATUSES,
    create_or_update_thread,
    create_or_update_turn,
    create_or_update_variant,
    GenerationRunConflictError,
    claim_generation_run,
    get_session_snapshot,
    get_generation_run_progress_snapshot,
    get_thread_snapshot,
    heartbeat_generation_run,
    is_generation_run_stale,
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
async def get_generation_run_execution_state(
    session_id: str | None = None,
    thread_id: str | None = None,
    turn_id: str | None = None,
    stale_after_seconds: int = Query(default=30, ge=0),
    session: Session = Depends(get_session),
) -> GenerationRunExecutionState:
    checked_at = datetime.now(UTC)
    active_runs = list_active_generation_runs(session, session_id=session_id, thread_id=thread_id, turn_id=turn_id)
    restore_candidates: list[GenerationRunRestoreCandidate] = []

    for run in active_runs:
        feed = await inspect_reply_execution_feed(run.run_id)
        attachment = build_live_feed_attachment(
            run_status=run.status,
            registry_live=feed.live,
            replay_available=feed.replay_available,
            subscriber_count=feed.subscriber_count,
        )
        stale = is_generation_run_stale(run, checked_at, stale_after_seconds)
        restore_candidates.append(build_restore_candidate(run, attachment, stale=stale))

    return GenerationRunExecutionState(
        checked_at=checked_at,
        stale_after_seconds=stale_after_seconds,
        restore_candidates=restore_candidates,
    )


@router.get("/generation-runs/{run_id}/progress", response_model=GenerationRunProgressSnapshot)
async def get_generation_run_progress(
    run_id: str,
    after_sequence: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
    session: Session = Depends(get_session),
) -> GenerationRunProgressSnapshot:
    snapshot = get_generation_run_progress_snapshot(session, run_id, after_sequence=after_sequence, limit=limit)

    if not snapshot:
        raise HTTPException(status_code=404, detail="Generation run not found")

    feed = await inspect_reply_execution_feed(run_id, after_sequence=after_sequence)
    snapshot.live_feed_attachment = build_live_feed_attachment(
        run_status=snapshot.run.status,
        registry_live=feed.live,
        replay_available=feed.replay_available or bool(snapshot.events),
        subscriber_count=feed.subscriber_count,
    )
    return snapshot


def build_live_feed_attachment(
    run_status: str,
    registry_live: bool,
    replay_available: bool,
    subscriber_count: int,
) -> GenerationRunLiveFeedAttachment:
    if registry_live:
        return GenerationRunLiveFeedAttachment(
            mode="live_attached",
            live_attached=True,
            replay_available=replay_available,
            subscriber_count=subscriber_count,
            reason="producer_attached",
        )

    if run_status in ACTIVE_GENERATION_RUN_STATUSES:
        return GenerationRunLiveFeedAttachment(
            mode="stale",
            live_attached=False,
            replay_available=replay_available,
            subscriber_count=subscriber_count,
            reason="active_run_without_live_producer",
        )

    return GenerationRunLiveFeedAttachment(
        mode="replay_only",
        live_attached=False,
        replay_available=replay_available,
        subscriber_count=subscriber_count,
        reason="no_live_producer",
    )


def build_restore_candidate(
    run: GenerationRunRead,
    attachment: GenerationRunLiveFeedAttachment,
    stale: bool,
) -> GenerationRunRestoreCandidate:
    interrupted = run.status == "interrupted"
    last_activity_at = (
        run.heartbeat_at
        or run.interrupted_at
        or run.completed_at
        or run.cancelled_at
        or run.failed_at
        or run.released_at
        or run.claimed_at
        or run.updated_at
    )

    return GenerationRunRestoreCandidate(
        run_id=run.run_id,
        session_id=run.session_id,
        thread_id=run.thread_id,
        turn_id=run.turn_id,
        status=run.status,
        lease_owner=run.lease_owner,
        restore_mode=attachment.mode,
        live_attached=attachment.live_attached,
        replay_available=attachment.replay_available,
        subscriber_count=attachment.subscriber_count,
        recoverable=attachment.live_attached or attachment.replay_available or stale or interrupted,
        stale=stale or attachment.mode == "stale",
        interrupted=interrupted,
        reason=attachment.reason,
        claimed_at=run.claimed_at,
        heartbeat_at=run.heartbeat_at,
        interrupted_at=run.interrupted_at,
        last_activity_at=last_activity_at,
        updated_at=run.updated_at,
    )


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
    return reconcile_stale_generation_runs(session, payload, maintenance_source="domain_reconcile_endpoint")


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
