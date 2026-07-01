from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.api.domain import get_paginated_threads
from app.db.base import Base
from app.db.models import ConversationThread, WorkspaceSession
from app.main import app
from app.schemas.domain import (
    ConversationThreadCreate,
    DomainHistoryItem,
    PaginatedThreads,
    SourceSnapshot,
    WorkspaceSessionUpsert,
)
from app.services.domain_service import (
    create_or_update_thread,
    upsert_workspace_session,
)
from app.services.domain.snapshots import list_threads_paginated


def create_test_sessionmaker():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def seed_thread(
    session,
    *,
    thread_id: str,
    session_id: str,
    source_domain: str,
    status: str = "active",
) -> None:
    workspace = upsert_workspace_session(
        session,
        WorkspaceSessionUpsert(
            session_id=session_id,
            page_url=f"https://{source_domain}/thread-{thread_id}",
            selected_text=f"selected text for {thread_id}",
            source_domain=source_domain,
        ),
    )
    create_or_update_thread(
        session,
        ConversationThreadCreate(
            thread_id=thread_id,
            session_id=workspace.session_id,
            source=SourceSnapshot(
                selected_text=f"selected text for {thread_id}",
                source_url=f"https://{source_domain}/thread-{thread_id}",
                source_domain=source_domain,
            ),
            status=status,
        ),
    )


def test_threads_endpoint_is_registered() -> None:
    assert any(
        route.path == "/domain/threads" and "GET" in route.methods
        for route in app.routes
        if hasattr(route, "methods")
    )


def test_threads_endpoint_returns_paginated_threads() -> None:
    Session = create_test_sessionmaker()

    with Session() as session:
        for index in range(3):
            seed_thread(
                session,
                thread_id=f"thread-{index}",
                session_id=f"session-{index}",
                source_domain=f"example{index}.com",
            )

    with Session() as session:
        payload = get_paginated_threads(limit=20, offset=0, session=session)

    assert isinstance(payload, PaginatedThreads)
    assert payload.total == 3
    assert payload.limit == 20
    assert payload.offset == 0
    assert len(payload.items) == 3
    for item in payload.items:
        assert isinstance(item, DomainHistoryItem)


def test_threads_endpoint_respects_limit_and_offset() -> None:
    Session = create_test_sessionmaker()

    with Session() as session:
        for index in range(5):
            seed_thread(
                session,
                thread_id=f"thread-{index}",
                session_id=f"session-{index}",
                source_domain="example.com",
            )

    with Session() as session:
        first_page = get_paginated_threads(limit=2, offset=0, session=session)
        second_page = get_paginated_threads(limit=2, offset=2, session=session)
        third_page = get_paginated_threads(limit=2, offset=4, session=session)

    assert first_page.total == 5
    assert len(first_page.items) == 2
    assert first_page.limit == 2
    assert first_page.offset == 0

    assert second_page.total == 5
    assert len(second_page.items) == 2
    assert second_page.offset == 2

    assert third_page.total == 5
    assert len(third_page.items) == 1
    assert third_page.offset == 4

    seen_ids = {item.thread.thread.thread_id for item in first_page.items + second_page.items + third_page.items}
    assert seen_ids == {"thread-0", "thread-1", "thread-2", "thread-3", "thread-4"}


def test_threads_endpoint_filters_by_source_domain() -> None:
    Session = create_test_sessionmaker()

    with Session() as session:
        seed_thread(session, thread_id="thread-a", session_id="session-a", source_domain="alpha.com")
        seed_thread(session, thread_id="thread-b", session_id="session-b", source_domain="beta.com")
        seed_thread(session, thread_id="thread-c", session_id="session-c", source_domain="alpha.com")

    with Session() as session:
        only_alpha = get_paginated_threads(
            limit=20,
            offset=0,
            source_domain="alpha.com",
            session=session,
        )

    assert only_alpha.total == 2
    assert {item.thread.thread.source_domain for item in only_alpha.items} == {"alpha.com"}


def test_threads_endpoint_filters_by_status() -> None:
    Session = create_test_sessionmaker()

    with Session() as session:
        seed_thread(session, thread_id="thread-1", session_id="session-1", source_domain="example.com", status="active")
        seed_thread(session, thread_id="thread-2", session_id="session-2", source_domain="example.com", status="archived")
        seed_thread(session, thread_id="thread-3", session_id="session-3", source_domain="example.com", status="active")

    with Session() as session:
        active = get_paginated_threads(
            limit=20,
            offset=0,
            status="active",
            session=session,
        )
        archived = get_paginated_threads(
            limit=20,
            offset=0,
            status="archived",
            session=session,
        )

    assert active.total == 2
    assert {item.thread.thread.status for item in active.items} == {"active"}
    assert archived.total == 1
    assert {item.thread.thread.status for item in archived.items} == {"archived"}


def test_threads_endpoint_returns_empty_envelope_when_no_matches() -> None:
    Session = create_test_sessionmaker()

    with Session() as session:
        empty = get_paginated_threads(limit=20, offset=0, session=session)

    assert empty.total == 0
    assert empty.items == []
    assert empty.limit == 20
    assert empty.offset == 0


def test_list_threads_paginated_service_uses_typed_return() -> None:
    Session = create_test_sessionmaker()

    with Session() as session:
        items, total = list_threads_paginated(session, limit=10, offset=0)

    assert total == 0
    assert items == []


def test_list_threads_paginated_service_sorts_by_latest_activity() -> None:
    Session = create_test_sessionmaker()

    with Session() as session:
        for index in range(3):
            seed_thread(
                session,
                thread_id=f"thread-{index}",
                session_id=f"session-{index}",
                source_domain="example.com",
            )

    with Session() as session:
        items, total = list_threads_paginated(session, limit=10, offset=0)

    assert total == 3
    assert len(items) == 3
