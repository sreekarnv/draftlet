from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.db.models import ConversationThread, DraftVariant, GenerationRun, Turn, WorkspaceSession
from app.schemas.domain import (
    ConversationThreadCreate,
    ConversationThreadSnapshot,
    DomainHistoryItem,
    DraftVariantCreate,
    DraftVariantStateUpdate,
    GenerationRunClaim,
    GenerationRunExecutionState,
    GenerationRunHeartbeat,
    GenerationRunReconcileRequest,
    GenerationRunStatusUpdate,
    SourceSnapshot,
    TurnCreate,
    TurnStatusUpdate,
    WorkspaceSessionSnapshot,
    WorkspaceSessionUpsert,
)

ACTIVE_GENERATION_RUN_STATUSES = {"active", "streaming"}
TERMINAL_GENERATION_RUN_STATUSES = {"completed", "failed", "cancelled", "interrupted"}
DEFAULT_GENERATION_RUN_STALE_AFTER_SECONDS = 30


class GenerationRunConflictError(RuntimeError):
    def __init__(self, code: str, message: str, run: GenerationRun) -> None:
        super().__init__(message)
        self.code = code
        self.run = run


def upsert_workspace_session(session: Session, payload: WorkspaceSessionUpsert) -> WorkspaceSession:
    existing = session.get(WorkspaceSession, payload.session_id)

    if existing:
        existing.tab_id = payload.tab_id
        existing.window_id = payload.window_id
        existing.page_url = payload.page_url
        existing.page_title = payload.page_title
        existing.selected_text = payload.selected_text
        existing.source_domain = payload.source_domain
        existing.status = payload.status
        existing.active_thread_id = payload.active_thread_id
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
    session.commit()
    session.refresh(turn)
    return turn


def update_turn_status(session: Session, turn_id: str, status: str, error_code: str | None = None, error_message: str | None = None) -> Turn | None:
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


def claim_generation_run(session: Session, payload: GenerationRunClaim) -> GenerationRun | None:
    turn = session.get(Turn, payload.turn_id)

    if not turn or turn.thread_id != payload.thread_id:
        return None

    thread = session.get(ConversationThread, payload.thread_id)

    if not thread or thread.session_id != payload.session_id:
        return None

    run = session.get(GenerationRun, payload.run_id)
    now = datetime.now(UTC)
    reconcile_stale_generation_runs(
        session,
        GenerationRunReconcileRequest(
            session_id=payload.session_id,
            stale_after_seconds=payload.stale_after_seconds,
            error_code="generation_run_stale",
            error_message="A previous draft generation lease became stale before completion.",
        ),
    )
    active_conflicts = [
        active_run
        for active_run in list_active_generation_runs(session, session_id=payload.session_id)
        if active_run.run_id != payload.run_id
    ]

    if active_conflicts:
        conflict = active_conflicts[0]
        if conflict.turn_id == payload.turn_id:
            raise GenerationRunConflictError(
                "generation_run_turn_active",
                "This turn already has an active draft generation run.",
                conflict,
            )

        raise GenerationRunConflictError(
            "generation_run_session_active",
            "This session already has an active draft generation run.",
            conflict,
        )

    if run:
        run.session_id = payload.session_id
        run.thread_id = payload.thread_id
        run.turn_id = payload.turn_id
        run.status = payload.status
        run.lease_owner = payload.lease_owner
        run.claimed_at = now
        run.heartbeat_at = now
        run.released_at = None
        run.completed_at = None
        run.cancelled_at = None
        run.interrupted_at = None
        run.failed_at = None
        run.error_code = None
        run.error_message = None
    else:
        run = GenerationRun(
            run_id=payload.run_id,
            session_id=payload.session_id,
            thread_id=payload.thread_id,
            turn_id=payload.turn_id,
            status=payload.status,
            lease_owner=payload.lease_owner,
            heartbeat_at=now,
        )

    session.add(run)
    session.commit()
    session.refresh(run)
    return run


def heartbeat_generation_run(session: Session, run_id: str, payload: GenerationRunHeartbeat | None = None) -> GenerationRun | None:
    run = session.get(GenerationRun, run_id)

    if not run:
        return None

    session.refresh(run)

    if run.status in TERMINAL_GENERATION_RUN_STATUSES:
        return run

    if payload and payload.lease_owner:
        run.lease_owner = payload.lease_owner

    run.heartbeat_at = datetime.now(UTC)
    session.add(run)
    session.commit()
    session.refresh(run)
    return run


def list_active_generation_runs(
    session: Session,
    session_id: str | None = None,
    thread_id: str | None = None,
    turn_id: str | None = None,
) -> list[GenerationRun]:
    statement = select(GenerationRun).where(GenerationRun.status.in_(ACTIVE_GENERATION_RUN_STATUSES))

    if session_id:
        statement = statement.where(GenerationRun.session_id == session_id)

    if thread_id:
        statement = statement.where(GenerationRun.thread_id == thread_id)

    if turn_id:
        statement = statement.where(GenerationRun.turn_id == turn_id)

    return list(session.scalars(statement.order_by(GenerationRun.claimed_at.desc())))


def inspect_generation_run_execution_state(
    session: Session,
    session_id: str | None = None,
    thread_id: str | None = None,
    turn_id: str | None = None,
    stale_after_seconds: int = DEFAULT_GENERATION_RUN_STALE_AFTER_SECONDS,
) -> GenerationRunExecutionState:
    now = datetime.now(UTC)
    active_runs = list_active_generation_runs(session, session_id=session_id, thread_id=thread_id, turn_id=turn_id)
    live: list[GenerationRun] = []
    stale: list[GenerationRun] = []

    for run in active_runs:
        if is_generation_run_stale(run, now, stale_after_seconds):
            stale.append(run)
        else:
            live.append(run)

    return GenerationRunExecutionState(
        checked_at=now,
        stale_after_seconds=stale_after_seconds,
        active=active_runs,
        live=live,
        stale=stale,
    )


def update_generation_run_status(session: Session, run_id: str, payload: GenerationRunStatusUpdate) -> GenerationRun | None:
    run = session.get(GenerationRun, run_id)

    if not run:
        return None

    session.refresh(run)

    if run.status in TERMINAL_GENERATION_RUN_STATUSES:
        return run

    apply_generation_run_lifecycle(run, payload.status, payload.error_code, payload.error_message)
    reconcile_turn_for_generation_run(session, run, payload.status, payload.error_code, payload.error_message)
    session.add(run)
    session.commit()
    session.refresh(run)
    return run


def reconcile_stale_generation_runs(session: Session, payload: GenerationRunReconcileRequest) -> list[GenerationRun]:
    now = datetime.now(UTC)
    runs = list_active_generation_runs(
        session,
        session_id=payload.session_id,
        thread_id=payload.thread_id,
        turn_id=payload.turn_id,
    )
    reconciled: list[GenerationRun] = []

    for run in runs:
        if not is_generation_run_stale(run, now, payload.stale_after_seconds):
            continue

        apply_generation_run_lifecycle(run, "interrupted", payload.error_code, payload.error_message)
        reconcile_turn_for_generation_run(session, run, "interrupted", payload.error_code, payload.error_message)
        session.add(run)
        reconciled.append(run)

    session.commit()

    for run in reconciled:
        session.refresh(run)

    return reconciled


def is_generation_run_stale(run: GenerationRun, now: datetime | None = None, stale_after_seconds: int = DEFAULT_GENERATION_RUN_STALE_AFTER_SECONDS) -> bool:
    checked_at = now or datetime.now(UTC)
    cutoff = checked_at - timedelta(seconds=stale_after_seconds)
    activity_at = as_utc(run.heartbeat_at or run.claimed_at or run.updated_at)
    return activity_at is None or activity_at <= cutoff


def is_generation_run_active(session: Session, run_id: str) -> bool:
    run = session.get(GenerationRun, run_id)

    if not run:
        return False

    session.refresh(run)
    return run.status in ACTIVE_GENERATION_RUN_STATUSES


def as_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None

    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)

    return value.astimezone(UTC)


def apply_generation_run_lifecycle(run: GenerationRun, status: str, error_code: str | None = None, error_message: str | None = None) -> None:
    now = datetime.now(UTC)
    run.status = status
    run.heartbeat_at = now

    if status == "streaming":
        return

    if status == "completed":
        run.completed_at = now
        run.released_at = now
        run.error_code = None
        run.error_message = None
        return

    if status == "cancelled":
        run.cancelled_at = now
        run.released_at = now
        run.error_code = error_code
        run.error_message = error_message
        return

    if status == "interrupted":
        run.interrupted_at = now
        run.released_at = now
        run.error_code = error_code
        run.error_message = error_message
        return

    if status == "failed":
        run.failed_at = now
        run.released_at = now
        run.error_code = error_code
        run.error_message = error_message


def reconcile_turn_for_generation_run(
    session: Session,
    run: GenerationRun,
    status: str,
    error_code: str | None = None,
    error_message: str | None = None,
) -> None:
    if status == "streaming":
        turn_status = "streaming"
    elif status == "completed":
        turn_status = "completed"
    elif status == "cancelled":
        turn_status = "cancelled"
    elif status in {"failed", "interrupted"}:
        turn_status = "failed"
    else:
        return

    turn = session.get(Turn, run.turn_id)

    if turn:
        apply_turn_lifecycle(turn, turn_status, error_code, error_message)
        session.add(turn)


def apply_turn_lifecycle(turn: Turn, status: str, error_code: str | None = None, error_message: str | None = None) -> None:
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


def create_or_update_variant(session: Session, payload: DraftVariantCreate) -> DraftVariant:
    existing = session.get(DraftVariant, payload.variant_id)

    if existing:
        existing.turn_id = payload.turn_id
        existing.tone = payload.tone
        existing.length = payload.length
        existing.content = payload.content
        existing.rank = payload.rank
        existing.status = payload.status
        existing.is_current = payload.is_current
        variant = existing
    else:
        variant = DraftVariant(
            variant_id=payload.variant_id,
            turn_id=payload.turn_id,
            tone=payload.tone,
            length=payload.length,
            content=payload.content,
            rank=payload.rank,
            status=payload.status,
            is_current=payload.is_current,
        )

    session.add(variant)
    session.commit()
    session.refresh(variant)
    return variant


def update_variant_state(session: Session, variant_id: str, payload: DraftVariantStateUpdate) -> ConversationThreadSnapshot | None:
    variant = session.get(DraftVariant, variant_id)

    if not variant:
        return None

    turn = session.get(Turn, variant.turn_id)

    if not turn:
        return None

    thread_id = turn.thread_id

    if payload.is_current:
        # Current and accepted are intentionally bounded to one variant per thread for this phase.
        for thread_variant in variants_for_thread(session, thread_id):
            thread_variant.is_current = thread_variant.variant_id == variant_id
            session.add(thread_variant)

    if payload.status == "accepted":
        for thread_variant in variants_for_thread(session, thread_id):
            thread_variant.status = "accepted" if thread_variant.variant_id == variant_id else "generated"
            thread_variant.is_current = thread_variant.variant_id == variant_id
            session.add(thread_variant)
    elif payload.status:
        variant.status = payload.status
        session.add(variant)

    session.commit()
    return get_thread_snapshot(session, thread_id)


def get_session_snapshot(session: Session, session_id: str) -> WorkspaceSessionSnapshot | None:
    workspace = session.get(WorkspaceSession, session_id)

    if not workspace:
        return None

    thread_snapshot = get_thread_snapshot(session, workspace.active_thread_id) if workspace.active_thread_id else None
    return WorkspaceSessionSnapshot(session=workspace, thread=thread_snapshot)


def get_thread_snapshot(session: Session, thread_id: str | None) -> ConversationThreadSnapshot | None:
    if not thread_id:
        return None

    statement = (
        select(ConversationThread)
        .where(ConversationThread.thread_id == thread_id)
        .options(selectinload(ConversationThread.turns).selectinload(Turn.variants))
    )
    thread = session.scalar(statement)

    if not thread:
        return None

    turns = list(thread.turns)
    variants = [variant for turn in turns for variant in turn.variants]
    return ConversationThreadSnapshot(thread=thread, turns=turns, variants=variants)


def list_recent_domain_history(session: Session, limit: int = 20) -> list[DomainHistoryItem]:
    statement = select(ConversationThread).options(
        selectinload(ConversationThread.session),
        selectinload(ConversationThread.turns).selectinload(Turn.variants),
    )
    threads = sorted(
        session.scalars(statement).all(),
        key=latest_thread_activity,
        reverse=True,
    )[:limit]
    items: list[DomainHistoryItem] = []

    for thread in threads:
        turns = list(thread.turns)
        variants = [variant for turn in turns for variant in turn.variants]
        items.append(
            DomainHistoryItem(
                session=thread.session,
                thread=ConversationThreadSnapshot(thread=thread, turns=turns, variants=variants),
            )
        )

    return items


def latest_thread_activity(thread: ConversationThread) -> object:
    timestamps = [thread.updated_at, thread.created_at]

    for turn in thread.turns:
        timestamps.extend([turn.updated_at, turn.created_at])
        for variant in turn.variants:
            timestamps.extend([variant.updated_at, variant.created_at])

    return max(timestamp for timestamp in timestamps if timestamp is not None)


def variants_for_thread(session: Session, thread_id: str) -> list[DraftVariant]:
    statement = (
        select(DraftVariant)
        .join(Turn, DraftVariant.turn_id == Turn.turn_id)
        .where(Turn.thread_id == thread_id)
    )
    return list(session.scalars(statement))


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
