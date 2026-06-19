from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import ConversationThread, GenerationRun, Turn, WorkspaceSession
from app.schemas.domain import GenerationRunClaim, GenerationRunHeartbeat, GenerationRunReconcileRequest, GenerationRunStatusUpdate
from app.services.domain.constants import ACTIVE_GENERATION_RUN_STATUSES, TERMINAL_GENERATION_RUN_STATUSES
from app.services.domain.errors import GenerationRunConflictError
from app.services.domain.generation_events import record_generation_run_terminal_event
from app.services.domain.generation_lifecycle import apply_generation_run_lifecycle, is_generation_run_stale
from app.services.domain.maintenance import record_stale_reconciliation_maintenance
from app.services.domain.turns import apply_turn_lifecycle


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
        maintenance_source="claim_generation_run",
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
    workspace = session.get(WorkspaceSession, payload.session_id)
    if workspace:
        workspace.active_thread_id = payload.thread_id
        workspace.active_turn_id = payload.turn_id
        workspace.active_run_id = payload.run_id
        session.add(workspace)

    session.commit()
    session.refresh(run)
    return run


def heartbeat_generation_run(
    session: Session,
    run_id: str,
    payload: GenerationRunHeartbeat | None = None,
) -> GenerationRun | None:
    run = session.get(GenerationRun, run_id)

    if not run:
        return None

    session.refresh(run)

    if run.status in TERMINAL_GENERATION_RUN_STATUSES:
        record_generation_run_terminal_event(session, run, run.status, run.error_message)
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


def update_generation_run_status(
    session: Session,
    run_id: str,
    payload: GenerationRunStatusUpdate,
) -> GenerationRun | None:
    run = session.get(GenerationRun, run_id)

    if not run:
        return None

    session.refresh(run)

    if run.status in TERMINAL_GENERATION_RUN_STATUSES:
        record_generation_run_terminal_event(session, run, run.status, run.error_message)
        return run

    apply_generation_run_lifecycle(run, payload.status, payload.error_code, payload.error_message)
    reconcile_turn_for_generation_run(session, run, payload.status, payload.error_code, payload.error_message)
    reconcile_workspace_routing_for_generation_run(session, run)
    session.add(run)
    session.commit()
    session.refresh(run)
    record_generation_run_terminal_event(session, run, payload.status, payload.error_message)
    return run


def reconcile_stale_generation_runs(
    session: Session,
    payload: GenerationRunReconcileRequest,
    maintenance_source: str = "runtime",
) -> list[GenerationRun]:
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
        reconcile_workspace_routing_for_generation_run(session, run)
        session.add(run)
        reconciled.append(run)

    session.commit()

    for run in reconciled:
        session.refresh(run)
        record_generation_run_terminal_event(session, run, "interrupted", payload.error_message)

    record_stale_reconciliation_maintenance(
        session,
        maintenance_source,
        [run.run_id for run in reconciled],
        payload.stale_after_seconds,
    )
    return reconciled


def is_generation_run_active(session: Session, run_id: str) -> bool:
    run = session.get(GenerationRun, run_id)

    if not run:
        return False

    session.refresh(run)
    return run.status in ACTIVE_GENERATION_RUN_STATUSES


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


def reconcile_workspace_routing_for_generation_run(session: Session, run: GenerationRun) -> None:
    workspace = session.get(WorkspaceSession, run.session_id)

    if not workspace:
        return

    workspace.active_thread_id = run.thread_id
    workspace.active_turn_id = run.turn_id

    if run.status in ACTIVE_GENERATION_RUN_STATUSES:
        workspace.active_run_id = run.run_id
    elif workspace.active_run_id == run.run_id:
        workspace.active_run_id = None

    session.add(workspace)
