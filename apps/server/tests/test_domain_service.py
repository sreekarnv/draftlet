import unittest

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.base import Base
from app.schemas.domain import ConversationThreadCreate, DraftVariantCreate, SourceSnapshot, TurnCreate, WorkspaceSessionUpsert
from app.services.domain_service import (
    create_or_update_thread,
    create_or_update_turn,
    create_or_update_variant,
    get_session_snapshot,
    update_turn_status,
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


if __name__ == "__main__":
    unittest.main()
