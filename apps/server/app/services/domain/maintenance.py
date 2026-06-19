from sqlalchemy.orm import Session

from app.services.diagnostics_service import record_generation_run_maintenance_outcome


def record_replay_prune_maintenance(
    session: Session,
    maintenance_source: str,
    pruned_count: int,
    older_than_days: int,
    replay_limit: int,
    max_runs: int,
) -> None:
    record_generation_run_maintenance_outcome(
        "replay_prune",
        source=maintenance_source,
        pruned_event_count=pruned_count,
        retention_days=older_than_days,
        replay_limit=replay_limit,
        prune_batch_size=max_runs,
        session=session,
    )


def record_stale_reconciliation_maintenance(
    session: Session,
    maintenance_source: str,
    reconciled_run_ids: list[str],
    stale_after_seconds: int,
) -> None:
    record_generation_run_maintenance_outcome(
        "stale_reconciliation",
        source=maintenance_source,
        reconciled_run_ids=reconciled_run_ids,
        stale_after_seconds=stale_after_seconds,
        session=session,
    )
