import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.db.session import get_session
from app.main import app
from app.schemas.domain import ConversationThreadCreate, DraftVariantCreate, SourceSnapshot, TurnCreate, WorkspaceSessionUpsert
from app.services.domain_service import create_or_update_thread, create_or_update_turn, create_or_update_variant, upsert_workspace_session


def create_test_sessionmaker():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    create_fts_tables(engine)
    return sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def create_fts_tables(engine) -> None:
    statements = [
        """
        CREATE VIRTUAL TABLE turns_fts USING fts5(
            turn_id UNINDEXED,
            instruction,
            selected_text,
            source_url UNINDEXED,
            source_domain UNINDEXED,
            tokenize='porter unicode61'
        )
        """,
        """
        CREATE TRIGGER turns_ai AFTER INSERT ON turns BEGIN
            INSERT INTO turns_fts(turn_id, instruction, selected_text, source_url, source_domain)
            VALUES (new.turn_id, new.instruction, new.selected_text, new.source_url, new.source_domain);
        END
        """,
        """
        CREATE TRIGGER turns_ad AFTER DELETE ON turns BEGIN
            DELETE FROM turns_fts WHERE turn_id = old.turn_id;
        END
        """,
        """
        CREATE TRIGGER turns_au AFTER UPDATE ON turns BEGIN
            DELETE FROM turns_fts WHERE turn_id = old.turn_id;
            INSERT INTO turns_fts(turn_id, instruction, selected_text, source_url, source_domain)
            VALUES (new.turn_id, new.instruction, new.selected_text, new.source_url, new.source_domain);
        END
        """,
        """
        CREATE VIRTUAL TABLE draft_variants_fts USING fts5(
            variant_id UNINDEXED,
            turn_id UNINDEXED,
            content,
            tokenize='porter unicode61'
        )
        """,
        """
        CREATE TRIGGER draft_variants_ai AFTER INSERT ON draft_variants BEGIN
            INSERT INTO draft_variants_fts(variant_id, turn_id, content)
            VALUES (new.variant_id, new.turn_id, new.content);
        END
        """,
        """
        CREATE TRIGGER draft_variants_ad AFTER DELETE ON draft_variants BEGIN
            DELETE FROM draft_variants_fts WHERE variant_id = old.variant_id;
        END
        """,
        """
        CREATE TRIGGER draft_variants_au AFTER UPDATE ON draft_variants BEGIN
            DELETE FROM draft_variants_fts WHERE variant_id = old.variant_id;
            INSERT INTO draft_variants_fts(variant_id, turn_id, content)
            VALUES (new.variant_id, new.turn_id, new.content);
        END
        """,
    ]
    with engine.begin() as connection:
        for statement in statements:
            connection.exec_driver_sql(statement)


@pytest.fixture()
def client():
    Session = create_test_sessionmaker()

    def override_get_session():
        session = Session()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_session] = override_get_session
    seed_search_data(Session)
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()


def seed_search_data(Session) -> None:
    with Session() as session:
        workspace = upsert_workspace_session(
            session,
            WorkspaceSessionUpsert(
                session_id="session-search",
                page_url="https://example.com/inbox",
                selected_text="Initial search selection",
                source_domain="example.com",
            ),
        )
        for index in range(1, 4):
            thread = create_or_update_thread(
                session,
                ConversationThreadCreate(
                    thread_id=f"thread-{index}",
                    session_id=workspace.session_id,
                    source=SourceSnapshot(
                        selected_text=f"Thread {index} context",
                        source_url=f"https://example.com/thread-{index}",
                        source_domain="example.com",
                    ),
                ),
            )
            selected_text = "The customer needs verification before Friday." if index == 2 else f"Distinct turn content {index}."
            create_or_update_turn(
                session,
                TurnCreate(
                    turn_id=f"turn-{index}",
                    thread_id=thread.thread_id,
                    instruction=f"Draft reply {index}",
                    source=SourceSnapshot(
                        selected_text=selected_text,
                        source_url=f"https://example.com/thread-{index}",
                        source_domain="example.com",
                    ),
                    tone="friendly",
                ),
            )

        variants = [
            ("variant-1", "turn-1", "A concise alpha response for the first thread.", "generated", False),
            ("variant-2", "turn-1", "A warmer beta response for the first thread.", "accepted", True),
            ("variant-3", "turn-2", "A careful response that avoids the keyword.", "generated", False),
            ("variant-4", "turn-2", "A detailed zephyr response for the second thread.", "generated", False),
            ("variant-5", "turn-3", "A final response for the third thread.", "generated", False),
        ]
        for rank, (variant_id, turn_id, content, status, is_current) in enumerate(variants):
            create_or_update_variant(
                session,
                DraftVariantCreate(
                    variant_id=variant_id,
                    turn_id=turn_id,
                    tone="friendly",
                    content=content,
                    rank=rank,
                    status=status,
                    is_current=is_current,
                ),
            )


def test_search_returns_turn_hit_for_turn_content(client: TestClient) -> None:
    response = client.get("/search", params={"q": "verification"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["query"] == "verification"
    assert payload["scope"] == "all"
    assert payload["total_hits"] >= 1
    assert payload["hits"][0]["scope"] == "turn"
    assert payload["hits"][0]["id"] == "turn-2"
    assert "<mark>verification</mark>" in payload["hits"][0]["snippet"]


def test_search_variants_scope_does_not_return_turn_matches(client: TestClient) -> None:
    response = client.get("/search", params={"q": "verification", "scope": "variants"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["scope"] == "variants"
    assert payload["hits"] == []
    assert payload["total_hits"] == 0


def test_search_returns_variant_hit_for_variant_content(client: TestClient) -> None:
    response = client.get("/search", params={"q": "zephyr"})

    assert response.status_code == 200
    hits = response.json()["hits"]
    assert any(hit["scope"] == "variant" and hit["id"] == "variant-4" for hit in hits)


def test_search_rejects_empty_query(client: TestClient) -> None:
    response = client.get("/search", params={"q": ""})

    assert response.status_code == 422


def test_search_rejects_limit_out_of_bounds(client: TestClient) -> None:
    response = client.get("/search", params={"q": "verification", "limit": 200})

    assert response.status_code == 422


def test_turn_insert_trigger_updates_search_index(client: TestClient) -> None:
    response = client.put(
        "/domain/turns/turn-new",
        json={
            "turn_id": "turn-new",
            "thread_id": "thread-1",
            "instruction": "Draft reply with comettrail",
            "source": {
                "selected_text": "Fresh comettrail content from an inserted turn.",
                "source_url": "https://example.com/thread-1",
                "source_domain": "example.com",
            },
            "tone": "friendly",
        },
    )
    assert response.status_code == 200

    search_response = client.get("/search", params={"q": "comettrail"})
    hits = search_response.json()["hits"]
    assert any(hit["scope"] == "turn" and hit["id"] == "turn-new" for hit in hits)


def test_turn_update_trigger_removes_old_content_from_search_index(client: TestClient) -> None:
    response = client.put(
        "/domain/turns/turn-2",
        json={
            "turn_id": "turn-2",
            "thread_id": "thread-2",
            "instruction": "Draft reply without old token",
            "source": {
                "selected_text": "Updated replacement content only.",
                "source_url": "https://example.com/thread-2",
                "source_domain": "example.com",
            },
            "tone": "friendly",
        },
    )
    assert response.status_code == 200

    search_response = client.get("/search", params={"q": "verification"})
    assert search_response.status_code == 200
    assert search_response.json()["hits"] == []


def test_variant_delete_trigger_removes_old_content_from_search_index(client: TestClient) -> None:
    session_generator = app.dependency_overrides[get_session]()
    session = next(session_generator)
    try:
        session.execute(text("DELETE FROM draft_variants WHERE variant_id = :variant_id"), {"variant_id": "variant-4"})
        session.commit()
    finally:
        session_generator.close()

    response = client.get("/search", params={"q": "zephyr"})
    assert response.status_code == 200
    assert response.json()["hits"] == []
