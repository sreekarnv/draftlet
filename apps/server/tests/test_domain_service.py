import unittest

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.base import Base
from app.schemas.domain import ConversationThreadCreate, DraftVariantCreate, DraftVariantStateUpdate, SourceSnapshot, TurnCreate, WorkspaceSessionUpsert
from app.services.domain_service import (
    create_or_update_thread,
    create_or_update_turn,
    create_or_update_variant,
    get_session_snapshot,
    list_recent_domain_history,
    update_turn_status,
    update_variant_state,
    upsert_workspace_session,
)


class DomainServiceTest(unittest.TestCase):
    def setUp(self) -> None:
        engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
        Base.metadata.create_all(engine)
        self.Session = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

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

    def test_upsert_session_updates_active_thread(self) -> None:
        with self.Session() as session:
            first = upsert_workspace_session(
                session,
                WorkspaceSessionUpsert(
                    session_id="session-1",
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
                ),
            )

            self.assertEqual(first.session_id, second.session_id)
            self.assertEqual(second.page_url, "https://example.com/two")
            self.assertEqual(second.active_thread_id, "thread-2")

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
