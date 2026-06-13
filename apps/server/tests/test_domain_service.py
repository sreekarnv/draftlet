import unittest
from datetime import UTC, datetime, timedelta

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.base import Base
from app.schemas.domain import (
    ConversationThreadCreate,
    ComposeTargetRef,
    DraftVariantCreate,
    DraftVariantStateUpdate,
    GenerationRunClaim,
    GenerationRunHeartbeat,
    GenerationRunReconcileRequest,
    GenerationRunStatusUpdate,
    SourceSnapshot,
    TurnCreate,
    WorkspaceSessionUpsert,
)
from app.services.domain_service import (
    GenerationRunConflictError,
    append_generation_run_event,
    claim_generation_run,
    create_or_update_thread,
    create_or_update_turn,
    create_or_update_variant,
    get_generation_run_progress_snapshot,
    get_session_snapshot,
    heartbeat_generation_run,
    inspect_generation_run_execution_state,
    list_generation_run_events,
    list_active_generation_runs,
    list_recent_domain_history,
    prune_terminal_generation_run_events,
    reconcile_stale_generation_runs,
    update_generation_run_status,
    update_turn_status,
    update_variant_state,
    upsert_workspace_session,
)
from app.services.diagnostics_service import clear_generation_run_maintenance_status, get_generation_run_maintenance_status


class DomainServiceTest(unittest.TestCase):
    def setUp(self) -> None:
        engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
        Base.metadata.create_all(engine)
        self.Session = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
        clear_generation_run_maintenance_status()

    def test_persists_session_thread_turn_and_variant_snapshot(self) -> None:
        with self.Session() as session:
            source = SourceSnapshot(
                selected_text="Can you send the report?",
                source_url="https://example.com/thread",
                source_domain="example.com",
                page_title="Inbox",
            )
            workspace = upsert_workspace_session(
                session,
                WorkspaceSessionUpsert(
                    session_id="session-1",
                    tab_id=10,
                    window_id=1,
                    page_url=source.source_url,
                    page_title=source.page_title,
                    selected_text=source.selected_text,
                    source_domain=source.source_domain,
                ),
            )
            thread = create_or_update_thread(
                session,
                ConversationThreadCreate(
                    thread_id="thread-1",
                    session_id=workspace.session_id,
                    source=source,
                ),
            )
            turn = create_or_update_turn(
                session,
                TurnCreate(
                    turn_id="turn-1",
                    thread_id=thread.thread_id,
                    source=source,
                    tone="friendly",
                ),
            )
            create_or_update_variant(
                session,
                DraftVariantCreate(
                    variant_id="variant-1",
                    turn_id=turn.turn_id,
                    tone="friendly",
                    content="Sure, I can send it today.",
                    rank=0,
                ),
            )
            update_turn_status(session, turn.turn_id, "completed")

            snapshot = get_session_snapshot(session, workspace.session_id)

            self.assertIsNotNone(snapshot)
            self.assertEqual(snapshot.session.session_id, "session-1")
            self.assertEqual(snapshot.thread.thread.thread_id, "thread-1")
            self.assertEqual(snapshot.thread.turns[0].generation_status, "completed")
            self.assertEqual(snapshot.thread.variants[0].content, "Sure, I can send it today.")

    def test_persists_compose_target_ref_on_workspace_session(self) -> None:
        with self.Session() as session:
            target = ComposeTargetRef(
                target_id="textarea-1",
                kind="textarea",
                page_url="https://example.com/thread",
                origin="https://example.com",
                page_title="Inbox",
                selector='textarea[name="reply"]',
                fingerprint="textarea|reply",
                label="Reply",
                last_seen_at=datetime(2026, 1, 1, tzinfo=UTC),
            )

            workspace = upsert_workspace_session(
                session,
                WorkspaceSessionUpsert(
                    session_id="session-1",
                    tab_id=10,
                    window_id=1,
                    page_url="https://example.com/thread",
                    page_title="Inbox",
                    selected_text="Can you send the report?",
                    source_domain="example.com",
                    compose_target=target,
                ),
            )
            snapshot = get_session_snapshot(session, workspace.session_id)

            self.assertIsNotNone(snapshot)
            self.assertIsNotNone(snapshot.session.compose_target)
            self.assertEqual(snapshot.session.compose_target.target_id, "textarea-1")
            self.assertEqual(snapshot.session.compose_target.kind, "textarea")

    def test_turn_lifecycle_status_records_timestamps_and_errors(self) -> None:
        with self.Session() as session:
            source = SourceSnapshot(
                selected_text="Can you send the report?",
                source_url="https://example.com/thread",
            )
            workspace = upsert_workspace_session(
                session,
                WorkspaceSessionUpsert(
                    session_id="session-1",
                    page_url=source.source_url,
                    selected_text=source.selected_text,
                ),
            )
            thread = create_or_update_thread(
                session,
                ConversationThreadCreate(
                    thread_id="thread-1",
                    session_id=workspace.session_id,
                    source=source,
                ),
            )
            turn = create_or_update_turn(
                session,
                TurnCreate(
                    turn_id="turn-1",
                    thread_id=thread.thread_id,
                    source=source,
                    tone="friendly",
                ),
            )

            streaming = update_turn_status(session, turn.turn_id, "streaming")
            failed = update_turn_status(session, turn.turn_id, "failed", "runtime_unavailable", "Draftlet server is not reachable.")

            self.assertIsNotNone(streaming.generation_started_at)
            self.assertIsNotNone(failed.generation_failed_at)
            self.assertEqual(failed.generation_error_code, "runtime_unavailable")
            self.assertEqual(failed.generation_error_message, "Draftlet server is not reachable.")

    def test_generation_run_claim_and_cancel_reconcile_turn_lifecycle(self) -> None:
        with self.Session() as session:
            source = SourceSnapshot(
                selected_text="Can you send the report?",
                source_url="https://example.com/thread",
            )
            workspace = upsert_workspace_session(
                session,
                WorkspaceSessionUpsert(
                    session_id="session-1",
                    page_url=source.source_url,
                    selected_text=source.selected_text,
                ),
            )
            thread = create_or_update_thread(
                session,
                ConversationThreadCreate(
                    thread_id="thread-1",
                    session_id=workspace.session_id,
                    source=source,
                ),
            )
            turn = create_or_update_turn(
                session,
                TurnCreate(
                    turn_id="turn-1",
                    thread_id=thread.thread_id,
                    source=source,
                    tone="friendly",
                ),
            )

            run = claim_generation_run(
                session,
                GenerationRunClaim(
                    run_id="run-1",
                    session_id=workspace.session_id,
                    thread_id=thread.thread_id,
                    turn_id=turn.turn_id,
                    lease_owner="extension-background",
                ),
            )
            active_runs = list_active_generation_runs(session, session_id=workspace.session_id)
            claimed_snapshot = get_session_snapshot(session, workspace.session_id)
            cancelled = update_generation_run_status(
                session,
                "run-1",
                GenerationRunStatusUpdate(
                    status="cancelled",
                    error_code="generation_cancelled",
                    error_message="Draft generation was cancelled.",
                ),
            )
            snapshot = get_session_snapshot(session, workspace.session_id)

            self.assertIsNotNone(run)
            self.assertEqual(claimed_snapshot.session.active_run_id, run.run_id)
            self.assertEqual(claimed_snapshot.session.active_turn_id, turn.turn_id)
            self.assertEqual(active_runs[0].run_id, "run-1")
            self.assertEqual(cancelled.status, "cancelled")
            self.assertIsNotNone(cancelled.cancelled_at)
            self.assertIsNone(snapshot.session.active_run_id)
            self.assertEqual(snapshot.session.active_turn_id, turn.turn_id)
            self.assertEqual(snapshot.thread.turns[0].generation_status, "cancelled")
            self.assertEqual(snapshot.thread.turns[0].generation_error_code, "generation_cancelled")

    def test_generation_run_progress_snapshot_replays_persisted_variants(self) -> None:
        with self.Session() as session:
            source = SourceSnapshot(
                selected_text="Can you send the report?",
                source_url="https://example.com/thread",
            )
            workspace = upsert_workspace_session(
                session,
                WorkspaceSessionUpsert(
                    session_id="session-1",
                    page_url=source.source_url,
                    selected_text=source.selected_text,
                ),
            )
            thread = create_or_update_thread(
                session,
                ConversationThreadCreate(
                    thread_id="thread-1",
                    session_id=workspace.session_id,
                    source=source,
                ),
            )
            turn = create_or_update_turn(
                session,
                TurnCreate(
                    turn_id="turn-1",
                    thread_id=thread.thread_id,
                    source=source,
                    tone="friendly",
                ),
            )
            claim_generation_run(
                session,
                GenerationRunClaim(
                    run_id="run-1",
                    session_id=workspace.session_id,
                    thread_id=thread.thread_id,
                    turn_id=turn.turn_id,
                    lease_owner="extension-background",
                ),
            )
            create_or_update_variant(
                session,
                DraftVariantCreate(
                    variant_id="variant-1",
                    turn_id=turn.turn_id,
                    tone="friendly",
                    content="Sure, I can send it today.",
                    rank=0,
                ),
            )
            create_or_update_variant(
                session,
                DraftVariantCreate(
                    variant_id="variant-2",
                    turn_id=turn.turn_id,
                    tone="friendly",
                    content="I will send it over today.",
                    rank=1,
                ),
            )
            append_generation_run_event(session, "run-1", "run_started", status="active", message="run_started")
            append_generation_run_event(
                session,
                "run-1",
                "variant_persisted",
                status="generated",
                variant_id="variant-1",
                reply_text="Sure, I can send it today.",
            )
            append_generation_run_event(
                session,
                "run-1",
                "variant_persisted",
                status="generated",
                variant_id="variant-2",
                reply_text="I will send it over today.",
            )
            update_generation_run_status(session, "run-1", GenerationRunStatusUpdate(status="completed"))

            progress = get_generation_run_progress_snapshot(session, "run-1")
            replayed = get_generation_run_progress_snapshot(session, "run-1", after_sequence=2)

            self.assertIsNotNone(progress)
            self.assertEqual(progress.run.run_id, "run-1")
            self.assertEqual(progress.thread.thread.thread_id, "thread-1")
            self.assertEqual([event.event_type for event in progress.events], [
                "run_started",
                "variant_persisted",
                "variant_persisted",
                "run_completed",
            ])
            self.assertEqual(progress.replay_cursor, 4)
            self.assertEqual([event.variant_id for event in replayed.events], ["variant-2", None])

    def test_generation_run_events_are_replayable_from_durable_state(self) -> None:
        with self.Session() as session:
            source = SourceSnapshot(
                selected_text="Can you send the report?",
                source_url="https://example.com/thread",
            )
            workspace = upsert_workspace_session(
                session,
                WorkspaceSessionUpsert(
                    session_id="session-1",
                    page_url=source.source_url,
                    selected_text=source.selected_text,
                ),
            )
            thread = create_or_update_thread(
                session,
                ConversationThreadCreate(
                    thread_id="thread-1",
                    session_id=workspace.session_id,
                    source=source,
                ),
            )
            turn = create_or_update_turn(
                session,
                TurnCreate(
                    turn_id="turn-1",
                    thread_id=thread.thread_id,
                    source=source,
                    tone="friendly",
                ),
            )
            claim_generation_run(
                session,
                GenerationRunClaim(
                    run_id="run-1",
                    session_id=workspace.session_id,
                    thread_id=thread.thread_id,
                    turn_id=turn.turn_id,
                    lease_owner="extension-background",
                ),
            )
            append_generation_run_event(session, "run-1", "run_started", status="active", message="run_started")
            append_generation_run_event(
                session,
                "run-1",
                "variant_persisted",
                status="generated",
                variant_id="variant-1",
                reply_text="Sure, I can send it today.",
            )
            update_generation_run_status(session, "run-1", GenerationRunStatusUpdate(status="completed"))

        with self.Session() as session:
            events = list_generation_run_events(session, "run-1", after_sequence=1)
            progress = get_generation_run_progress_snapshot(session, "run-1", after_sequence=1)

            self.assertEqual([event.sequence for event in events], [2, 3])
            self.assertEqual([event.event_type for event in events], ["variant_persisted", "run_completed"])
            self.assertEqual([event.event_type for event in progress.events], ["variant_persisted", "run_completed"])
            self.assertEqual(progress.replay_cursor, 3)

    def test_prunes_old_terminal_generation_run_events_only(self) -> None:
        with self.Session() as session:
            source = SourceSnapshot(
                selected_text="Can you send the report?",
                source_url="https://example.com/thread",
            )
            workspace = upsert_workspace_session(
                session,
                WorkspaceSessionUpsert(
                    session_id="session-1",
                    page_url=source.source_url,
                    selected_text=source.selected_text,
                ),
            )
            thread = create_or_update_thread(
                session,
                ConversationThreadCreate(
                    thread_id="thread-1",
                    session_id=workspace.session_id,
                    source=source,
                ),
            )
            old_turn = create_or_update_turn(
                session,
                TurnCreate(
                    turn_id="turn-old",
                    thread_id=thread.thread_id,
                    source=source,
                    tone="friendly",
                ),
            )
            recent_turn = create_or_update_turn(
                session,
                TurnCreate(
                    turn_id="turn-recent",
                    thread_id=thread.thread_id,
                    source=source,
                    tone="friendly",
                ),
            )
            active_turn = create_or_update_turn(
                session,
                TurnCreate(
                    turn_id="turn-active",
                    thread_id=thread.thread_id,
                    source=source,
                    tone="friendly",
                ),
            )

            claim_generation_run(
                session,
                GenerationRunClaim(
                    run_id="run-old",
                    session_id=workspace.session_id,
                    thread_id=thread.thread_id,
                    turn_id=old_turn.turn_id,
                    lease_owner="extension-background",
                    stale_after_seconds=30,
                ),
            )
            append_generation_run_event(session, "run-old", "run_started", status="active", message="run_started")
            old_run = update_generation_run_status(session, "run-old", GenerationRunStatusUpdate(status="completed"))

            claim_generation_run(
                session,
                GenerationRunClaim(
                    run_id="run-recent",
                    session_id=workspace.session_id,
                    thread_id=thread.thread_id,
                    turn_id=recent_turn.turn_id,
                    lease_owner="extension-background",
                    stale_after_seconds=30,
                ),
            )
            append_generation_run_event(session, "run-recent", "run_started", status="active", message="run_started")
            update_generation_run_status(session, "run-recent", GenerationRunStatusUpdate(status="completed"))

            claim_generation_run(
                session,
                GenerationRunClaim(
                    run_id="run-active",
                    session_id=workspace.session_id,
                    thread_id=thread.thread_id,
                    turn_id=active_turn.turn_id,
                    lease_owner="extension-background",
                    stale_after_seconds=30,
                ),
            )
            append_generation_run_event(session, "run-active", "run_started", status="active", message="run_started")
            old_at = datetime.now(UTC) - timedelta(days=30)
            old_run.completed_at = old_at
            old_run.released_at = old_at
            old_run.updated_at = old_at
            session.add(old_run)
            session.commit()

            pruned = prune_terminal_generation_run_events(session, older_than_days=14, max_runs=20)
            old_progress = get_generation_run_progress_snapshot(session, "run-old")
            maintenance = get_generation_run_maintenance_status()

            self.assertEqual(pruned, 2)
            self.assertEqual(list_generation_run_events(session, "run-old"), [])
            self.assertEqual([event.event_type for event in list_generation_run_events(session, "run-recent")], [
                "run_started",
                "run_completed",
            ])
            self.assertEqual([event.event_type for event in list_generation_run_events(session, "run-active")], ["run_started"])
            self.assertEqual([event.event_type for event in old_progress.events], ["generation_run_status"])
            self.assertEqual(old_progress.run.status, "completed")
            self.assertEqual(maintenance.latestReplayPrune.prunedEventCount, 2)
            self.assertEqual(maintenance.latestReplayPrune.retentionDays, 14)
            self.assertEqual(maintenance.latestReplayPrune.pruneBatchSize, 20)

    def test_reconcile_stale_generation_runs_marks_turn_failed_interrupted(self) -> None:
        with self.Session() as session:
            source = SourceSnapshot(
                selected_text="Can you send the report?",
                source_url="https://example.com/thread",
            )
            workspace = upsert_workspace_session(
                session,
                WorkspaceSessionUpsert(
                    session_id="session-1",
                    page_url=source.source_url,
                    selected_text=source.selected_text,
                ),
            )
            thread = create_or_update_thread(
                session,
                ConversationThreadCreate(
                    thread_id="thread-1",
                    session_id=workspace.session_id,
                    source=source,
                ),
            )
            turn = create_or_update_turn(
                session,
                TurnCreate(
                    turn_id="turn-1",
                    thread_id=thread.thread_id,
                    source=source,
                    tone="friendly",
                ),
            )
            claim_generation_run(
                session,
                GenerationRunClaim(
                    run_id="run-1",
                    session_id=workspace.session_id,
                    thread_id=thread.thread_id,
                    turn_id=turn.turn_id,
                    lease_owner="extension-background",
                ),
            )

            reconciled = reconcile_stale_generation_runs(
                session,
                GenerationRunReconcileRequest(session_id=workspace.session_id, stale_after_seconds=0),
            )
            snapshot = get_session_snapshot(session, workspace.session_id)
            maintenance = get_generation_run_maintenance_status()

            self.assertEqual([run.run_id for run in reconciled], ["run-1"])
            self.assertEqual(reconciled[0].status, "interrupted")
            self.assertIsNotNone(reconciled[0].interrupted_at)
            self.assertIsNone(snapshot.session.active_run_id)
            self.assertEqual(snapshot.session.active_turn_id, turn.turn_id)
            self.assertEqual(snapshot.thread.turns[0].generation_status, "failed")
            self.assertEqual(snapshot.thread.turns[0].generation_error_code, "generation_interrupted")
            self.assertEqual(maintenance.latestStaleReconciliation.reconciledRunCount, 1)
            self.assertEqual(maintenance.latestStaleReconciliation.reconciledRunIds, ["run-1"])
            self.assertEqual(maintenance.latestStaleReconciliation.staleAfterSeconds, 0)

    def test_generation_run_claim_blocks_fresh_same_session_conflict(self) -> None:
        with self.Session() as session:
            source = SourceSnapshot(
                selected_text="Can you send the report?",
                source_url="https://example.com/thread",
            )
            workspace = upsert_workspace_session(
                session,
                WorkspaceSessionUpsert(
                    session_id="session-1",
                    page_url=source.source_url,
                    selected_text=source.selected_text,
                ),
            )
            thread = create_or_update_thread(
                session,
                ConversationThreadCreate(
                    thread_id="thread-1",
                    session_id=workspace.session_id,
                    source=source,
                ),
            )
            first_turn = create_or_update_turn(
                session,
                TurnCreate(
                    turn_id="turn-1",
                    thread_id=thread.thread_id,
                    source=source,
                    tone="friendly",
                ),
            )
            second_turn = create_or_update_turn(
                session,
                TurnCreate(
                    turn_id="turn-2",
                    thread_id=thread.thread_id,
                    source=source,
                    tone="friendly",
                ),
            )
            claim_generation_run(
                session,
                GenerationRunClaim(
                    run_id="run-1",
                    session_id=workspace.session_id,
                    thread_id=thread.thread_id,
                    turn_id=first_turn.turn_id,
                    lease_owner="extension-background",
                    stale_after_seconds=30,
                ),
            )

            with self.assertRaises(GenerationRunConflictError) as raised:
                claim_generation_run(
                    session,
                    GenerationRunClaim(
                        run_id="run-2",
                        session_id=workspace.session_id,
                        thread_id=thread.thread_id,
                        turn_id=second_turn.turn_id,
                        lease_owner="extension-background",
                        stale_after_seconds=30,
                    ),
                )

            self.assertEqual(raised.exception.code, "generation_run_session_active")

    def test_generation_run_claim_reconciles_stale_conflict_before_claiming(self) -> None:
        with self.Session() as session:
            source = SourceSnapshot(
                selected_text="Can you send the report?",
                source_url="https://example.com/thread",
            )
            workspace = upsert_workspace_session(
                session,
                WorkspaceSessionUpsert(
                    session_id="session-1",
                    page_url=source.source_url,
                    selected_text=source.selected_text,
                ),
            )
            thread = create_or_update_thread(
                session,
                ConversationThreadCreate(
                    thread_id="thread-1",
                    session_id=workspace.session_id,
                    source=source,
                ),
            )
            first_turn = create_or_update_turn(
                session,
                TurnCreate(
                    turn_id="turn-1",
                    thread_id=thread.thread_id,
                    source=source,
                    tone="friendly",
                ),
            )
            second_turn = create_or_update_turn(
                session,
                TurnCreate(
                    turn_id="turn-2",
                    thread_id=thread.thread_id,
                    source=source,
                    tone="friendly",
                ),
            )
            claim_generation_run(
                session,
                GenerationRunClaim(
                    run_id="run-1",
                    session_id=workspace.session_id,
                    thread_id=thread.thread_id,
                    turn_id=first_turn.turn_id,
                    lease_owner="extension-background",
                    stale_after_seconds=30,
                ),
            )

            claimed = claim_generation_run(
                session,
                GenerationRunClaim(
                    run_id="run-2",
                    session_id=workspace.session_id,
                    thread_id=thread.thread_id,
                    turn_id=second_turn.turn_id,
                    lease_owner="extension-background",
                    stale_after_seconds=0,
                ),
            )
            active_runs = list_active_generation_runs(session, session_id=workspace.session_id)
            snapshot = get_session_snapshot(session, workspace.session_id)

            self.assertEqual(claimed.run_id, "run-2")
            self.assertEqual([run.run_id for run in active_runs], ["run-2"])
            self.assertEqual(snapshot.session.active_run_id, "run-2")
            self.assertEqual(snapshot.session.active_turn_id, second_turn.turn_id)
            self.assertEqual(snapshot.thread.turns[0].generation_status, "failed")
            self.assertEqual(snapshot.thread.turns[0].generation_error_code, "generation_run_stale")

    def test_generation_run_heartbeat_and_execution_state_classify_live_and_stale(self) -> None:
        with self.Session() as session:
            source = SourceSnapshot(
                selected_text="Can you send the report?",
                source_url="https://example.com/thread",
            )
            workspace = upsert_workspace_session(
                session,
                WorkspaceSessionUpsert(
                    session_id="session-1",
                    page_url=source.source_url,
                    selected_text=source.selected_text,
                ),
            )
            thread = create_or_update_thread(
                session,
                ConversationThreadCreate(
                    thread_id="thread-1",
                    session_id=workspace.session_id,
                    source=source,
                ),
            )
            turn = create_or_update_turn(
                session,
                TurnCreate(
                    turn_id="turn-1",
                    thread_id=thread.thread_id,
                    source=source,
                    tone="friendly",
                ),
            )
            claim_generation_run(
                session,
                GenerationRunClaim(
                    run_id="run-1",
                    session_id=workspace.session_id,
                    thread_id=thread.thread_id,
                    turn_id=turn.turn_id,
                    lease_owner="extension-background",
                    stale_after_seconds=30,
                ),
            )

            heartbeat = heartbeat_generation_run(
                session,
                "run-1",
                GenerationRunHeartbeat(lease_owner="extension-background"),
            )
            live_state = inspect_generation_run_execution_state(session, session_id=workspace.session_id, stale_after_seconds=30)
            stale_state = inspect_generation_run_execution_state(session, session_id=workspace.session_id, stale_after_seconds=0)

            self.assertIsNotNone(heartbeat.heartbeat_at)
            self.assertEqual([run.run_id for run in live_state.live], ["run-1"])
            self.assertEqual([run.run_id for run in stale_state.stale], ["run-1"])

    def test_terminal_generation_run_status_is_not_overwritten_by_late_completion(self) -> None:
        with self.Session() as session:
            source = SourceSnapshot(
                selected_text="Can you send the report?",
                source_url="https://example.com/thread",
            )
            workspace = upsert_workspace_session(
                session,
                WorkspaceSessionUpsert(
                    session_id="session-1",
                    page_url=source.source_url,
                    selected_text=source.selected_text,
                ),
            )
            thread = create_or_update_thread(
                session,
                ConversationThreadCreate(
                    thread_id="thread-1",
                    session_id=workspace.session_id,
                    source=source,
                ),
            )
            turn = create_or_update_turn(
                session,
                TurnCreate(
                    turn_id="turn-1",
                    thread_id=thread.thread_id,
                    source=source,
                    tone="friendly",
                ),
            )
            claim_generation_run(
                session,
                GenerationRunClaim(
                    run_id="run-1",
                    session_id=workspace.session_id,
                    thread_id=thread.thread_id,
                    turn_id=turn.turn_id,
                    lease_owner="extension-background",
                ),
            )
            cancelled = update_generation_run_status(
                session,
                "run-1",
                GenerationRunStatusUpdate(
                    status="cancelled",
                    error_code="generation_cancelled",
                    error_message="Draft generation was cancelled.",
                ),
            )
            completed = update_generation_run_status(session, "run-1", GenerationRunStatusUpdate(status="completed"))

            self.assertEqual(cancelled.status, "cancelled")
            self.assertEqual(completed.status, "cancelled")

    def test_upsert_session_updates_active_routing_metadata(self) -> None:
        with self.Session() as session:
            first = upsert_workspace_session(
                session,
                WorkspaceSessionUpsert(
                    session_id="session-1",
                    tab_id=10,
                    window_id=1,
                    page_url="https://example.com/one",
                    selected_text="First",
                ),
            )
            second = upsert_workspace_session(
                session,
                WorkspaceSessionUpsert(
                    session_id="session-1",
                    page_url="https://example.com/two",
                    selected_text="Second",
                    active_thread_id="thread-2",
                    active_turn_id="turn-2",
                    active_run_id="run-2",
                ),
            )

            self.assertEqual(first.session_id, second.session_id)
            self.assertEqual(second.tab_id, 10)
            self.assertEqual(second.window_id, 1)
            self.assertEqual(second.page_url, "https://example.com/two")
            self.assertEqual(second.active_thread_id, "thread-2")
            self.assertEqual(second.active_turn_id, "turn-2")
            self.assertEqual(second.active_run_id, "run-2")

    def test_variant_state_is_bounded_to_one_current_and_one_accepted_per_thread(self) -> None:
        with self.Session() as session:
            source = SourceSnapshot(
                selected_text="Can you send the report?",
                source_url="https://example.com/thread",
                source_domain="example.com",
                page_title="Inbox",
            )
            workspace = upsert_workspace_session(
                session,
                WorkspaceSessionUpsert(
                    session_id="session-1",
                    page_url=source.source_url,
                    selected_text=source.selected_text,
                ),
            )
            thread = create_or_update_thread(
                session,
                ConversationThreadCreate(
                    thread_id="thread-1",
                    session_id=workspace.session_id,
                    source=source,
                ),
            )
            turn = create_or_update_turn(
                session,
                TurnCreate(
                    turn_id="turn-1",
                    thread_id=thread.thread_id,
                    source=source,
                    tone="friendly",
                ),
            )
            create_or_update_variant(
                session,
                DraftVariantCreate(
                    variant_id="variant-1",
                    turn_id=turn.turn_id,
                    tone="friendly",
                    content="First draft",
                    rank=0,
                ),
            )
            create_or_update_variant(
                session,
                DraftVariantCreate(
                    variant_id="variant-2",
                    turn_id=turn.turn_id,
                    tone="friendly",
                    content="Second draft",
                    rank=1,
                ),
            )

            selected = update_variant_state(session, "variant-1", DraftVariantStateUpdate(is_current=True))
            accepted = update_variant_state(session, "variant-2", DraftVariantStateUpdate(status="accepted"))

            self.assertIsNotNone(selected)
            self.assertIsNotNone(accepted)
            variants = {variant.variant_id: variant for variant in accepted.variants}
            self.assertFalse(variants["variant-1"].is_current)
            self.assertEqual(variants["variant-1"].status, "generated")
            self.assertTrue(variants["variant-2"].is_current)
            self.assertEqual(variants["variant-2"].status, "accepted")

    def test_lists_recent_domain_history_from_threads(self) -> None:
        with self.Session() as session:
            first_source = SourceSnapshot(
                selected_text="First selected message",
                source_url="https://example.com/first",
                source_domain="example.com",
                page_title="First",
            )
            second_source = SourceSnapshot(
                selected_text="Second selected message",
                source_url="https://example.com/second",
                source_domain="example.com",
                page_title="Second",
            )
            first_workspace = upsert_workspace_session(
                session,
                WorkspaceSessionUpsert(
                    session_id="session-1",
                    page_url=first_source.source_url,
                    page_title=first_source.page_title,
                    selected_text=first_source.selected_text,
                    source_domain=first_source.source_domain,
                ),
            )
            second_workspace = upsert_workspace_session(
                session,
                WorkspaceSessionUpsert(
                    session_id="session-2",
                    page_url=second_source.source_url,
                    page_title=second_source.page_title,
                    selected_text=second_source.selected_text,
                    source_domain=second_source.source_domain,
                ),
            )
            first_thread = create_or_update_thread(
                session,
                ConversationThreadCreate(
                    thread_id="thread-1",
                    session_id=first_workspace.session_id,
                    source=first_source,
                ),
            )
            second_thread = create_or_update_thread(
                session,
                ConversationThreadCreate(
                    thread_id="thread-2",
                    session_id=second_workspace.session_id,
                    source=second_source,
                ),
            )
            first_turn = create_or_update_turn(
                session,
                TurnCreate(
                    turn_id="turn-1",
                    thread_id=first_thread.thread_id,
                    source=first_source,
                    tone="friendly",
                ),
            )
            second_turn = create_or_update_turn(
                session,
                TurnCreate(
                    turn_id="turn-2",
                    thread_id=second_thread.thread_id,
                    source=second_source,
                    tone="professional",
                ),
            )
            create_or_update_variant(
                session,
                DraftVariantCreate(
                    variant_id="variant-1",
                    turn_id=first_turn.turn_id,
                    tone="friendly",
                    content="First draft",
                    rank=0,
                ),
            )
            create_or_update_variant(
                session,
                DraftVariantCreate(
                    variant_id="variant-2",
                    turn_id=second_turn.turn_id,
                    tone="professional",
                    content="Second draft",
                    rank=0,
                    status="accepted",
                    is_current=True,
                ),
            )

            history = list_recent_domain_history(session, limit=10)

            self.assertEqual({item.session.session_id for item in history}, {"session-1", "session-2"})
            by_thread = {item.thread.thread.thread_id: item for item in history}
            self.assertEqual(by_thread["thread-1"].session.page_title, "First")
            self.assertEqual(by_thread["thread-2"].thread.turns[0].tone, "professional")
            self.assertEqual(by_thread["thread-2"].thread.variants[0].content, "Second draft")
            self.assertTrue(by_thread["thread-2"].thread.variants[0].is_current)


if __name__ == "__main__":
    unittest.main()
