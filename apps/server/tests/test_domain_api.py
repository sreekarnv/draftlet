import asyncio
from datetime import UTC, datetime

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.api import domain as domain_api
from app.db.base import Base
from app.schemas.domain import (
    ConversationThreadCreate,
    GenerationRunClaim,
    SourceSnapshot,
    TurnCreate,
    WorkspaceSessionUpsert,
)
from app.services.domain_service import claim_generation_run, create_or_update_thread, create_or_update_turn, upsert_workspace_session
from app.services.execution_registry import ReplyExecutionFeedSnapshot


def create_test_sessionmaker():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def test_execution_state_includes_live_feed_attachment_truth(monkeypatch) -> None:
    async def inspect_feed(run_id: str, after_sequence: int = 0) -> ReplyExecutionFeedSnapshot:
        return ReplyExecutionFeedSnapshot(
            run_id=run_id,
            live=True,
            replay_available=True,
            subscriber_count=2,
            last_sequence=3,
        )

    monkeypatch.setattr(domain_api, "inspect_reply_execution_feed", inspect_feed)
    Session = create_test_sessionmaker()

    with Session() as session:
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
        run.heartbeat_at = datetime.now(UTC)
        session.add(run)
        session.commit()

        state = asyncio.run(domain_api.get_generation_run_execution_state(
            session_id=workspace.session_id,
            stale_after_seconds=30,
            session=session,
        ))

    attachment = state.feed_attachments["run-1"]
    assert [run.run_id for run in state.live] == ["run-1"]
    assert attachment.mode == "live_attached"
    assert attachment.live_attached is True
    assert attachment.replay_available is True
    assert attachment.subscriber_count == 2
    assert len(state.restore_candidates) == 1
    candidate = state.restore_candidates[0]
    assert candidate.run_id == "run-1"
    assert candidate.thread_id == "thread-1"
    assert candidate.turn_id == "turn-1"
    assert candidate.status == "active"
    assert candidate.restore_mode == "live_attached"
    assert candidate.live_attached is True
    assert candidate.replay_available is True
    assert candidate.subscriber_count == 2
    assert candidate.recoverable is True
    assert candidate.stale is False
    assert candidate.interrupted is False
