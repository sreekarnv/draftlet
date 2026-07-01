import asyncio
from datetime import UTC, datetime, timedelta

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.api.diagnostics import get_support_bundle
from app.core.config import (
    API_VERSION,
    DEFAULT_SERVER_PORT,
    RUNTIME_VERSION,
    SCHEMA_VERSION,
    get_server_port,
)
from app.db.base import Base
from app.db.models import (
    ConversationThread,
    DraftVariant,
    GenerationRun,
    Preference,
    Turn,
    WorkspaceSession,
)
from app.main import app
from app.schemas.support_bundle import (
    CountsBundle,
    ModelsBundle,
    PreferencesBundle,
    RuntimeStatusBundle,
    SupportBundle,
)
from app.services.diagnostics_service import (
    clear_generation_run_maintenance_status,
    clear_latest_browser_recapture_report,
    record_generation_run_maintenance_outcome,
)
from app.services.preference_service import upsert_preference
from app.services.support_bundle_service import (
    build_counts_bundle,
    build_models_bundle_from_state,
    build_preferences_bundle,
    build_runtime_status_bundle,
    build_support_bundle,
)
from app.schemas.model import RuntimeModelState
from app.schemas.preference import PreferenceUpsert


PRIVATE_SELECTED_TEXT = "PRIVATE-DRAFTLET-SELECTED-MARKER-7E2B"
PRIVATE_DRAFT_CONTENT = "PRIVATE-DRAFTLET-DRAFT-MARKER-7E2B"
PRIVATE_PAGE_TITLE = "PRIVATE-DRAFTLET-PAGE-MARKER-7E2B"
PRIVATE_URL = "https://example.com/PRIVATE-DRAFTLET-URL-MARKER"


def create_test_sessionmaker():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def seed_private_data(session) -> None:
    workspace = WorkspaceSession(
        session_id="private-session",
        page_url=PRIVATE_URL,
        page_title=PRIVATE_PAGE_TITLE,
        selected_text=PRIVATE_SELECTED_TEXT,
        source_domain="example.com",
        status="active",
    )
    thread = ConversationThread(
        thread_id="private-thread",
        session_id=workspace.session_id,
        selected_text=PRIVATE_SELECTED_TEXT,
        source_url=PRIVATE_URL,
        source_domain="example.com",
        page_title=PRIVATE_PAGE_TITLE,
        status="active",
    )
    turn = Turn(
        turn_id="private-turn",
        thread_id=thread.thread_id,
        instruction="private-instruction-marker",
        selected_text=PRIVATE_SELECTED_TEXT,
        source_url=PRIVATE_URL,
        source_domain="example.com",
        page_title=PRIVATE_PAGE_TITLE,
        tone="friendly",
        generation_status="completed",
    )
    variant = DraftVariant(
        variant_id="private-variant",
        turn_id=turn.turn_id,
        tone="friendly",
        content=PRIVATE_DRAFT_CONTENT,
        rank=0,
        status="generated",
        is_current=True,
    )
    run = GenerationRun(
        run_id="private-run",
        session_id=workspace.session_id,
        thread_id=thread.thread_id,
        turn_id=turn.turn_id,
        status="completed",
        lease_owner="private",
        error_code="private-error-marker",
        error_message="private-error-message-marker",
    )
    preference = Preference(
        scope="private",
        key="private-key",
        value=PRIVATE_DRAFT_CONTENT,
    )

    session.add_all([workspace, thread, turn, variant, run, preference])
    session.commit()


def test_support_bundle_endpoint_is_registered() -> None:
    assert any(
        route.path == "/diagnostics/support-bundle" and "GET" in route.methods
        for route in app.routes
        if hasattr(route, "methods")
    )


def test_support_bundle_returns_typed_envelope() -> None:
    Session = create_test_sessionmaker()

    async def go() -> SupportBundle:
        with Session() as session:
            return await get_support_bundle(session=session)

    bundle = asyncio.run(go())
    assert isinstance(bundle, SupportBundle)
    assert bundle.capturedAt <= datetime.now(UTC) + timedelta(seconds=5)
    assert bundle.capturedAt >= datetime.now(UTC) - timedelta(seconds=30)


def test_support_bundle_runtime_section_uses_constants() -> None:
    runtime = build_runtime_status_bundle()
    assert isinstance(runtime, RuntimeStatusBundle)
    assert runtime.runtimeVersion == RUNTIME_VERSION
    assert runtime.schemaVersion == SCHEMA_VERSION
    assert runtime.apiVersion == API_VERSION
    assert runtime.serverPort == DEFAULT_SERVER_PORT


def test_get_server_port_falls_back_to_default(monkeypatch) -> None:
    monkeypatch.delenv("DRAFTLET_SERVER_PORT", raising=False)
    assert get_server_port() == DEFAULT_SERVER_PORT


def test_get_server_port_honors_override(monkeypatch) -> None:
    monkeypatch.setenv("DRAFTLET_SERVER_PORT", "49999")
    assert get_server_port() == 49999


def test_get_server_port_ignores_invalid_override(monkeypatch) -> None:
    monkeypatch.setenv("DRAFTLET_SERVER_PORT", "not-a-port")
    assert get_server_port() == DEFAULT_SERVER_PORT


def test_support_bundle_models_section_propagates_state() -> None:
    state = RuntimeModelState(
        selected_model="qwen2.5:7b",
        default_model="gemma3:4b",
        installed_models=[],
        recommendations=[],
        ollama_available=False,
        error=None,
    )
    models = build_models_bundle_from_state(state)
    assert isinstance(models, ModelsBundle)
    assert models.defaultModel == "gemma3:4b"
    assert models.selectedModel == "qwen2.5:7b"
    assert models.availableModels == []
    assert models.ollamaAvailable is False
    assert models.ollamaErrorCode is None
    assert models.ollamaErrorMessage is None


def test_support_bundle_models_section_reports_ollama_error() -> None:
    state = RuntimeModelState(
        selected_model="gemma3:4b",
        default_model="gemma3:4b",
        installed_models=[],
        recommendations=[],
        ollama_available=False,
        error={"code": "ollama_unreachable", "message": "Ollama offline", "retryable": True},
    )
    models = build_models_bundle_from_state(state)
    assert models.ollamaAvailable is False
    assert models.ollamaErrorCode == "ollama_unreachable"
    assert models.ollamaErrorMessage == "Ollama offline"


def test_support_bundle_preferences_section_omits_values() -> None:
    Session = create_test_sessionmaker()

    with Session() as session:
        upsert_preference(
            session,
            PreferenceUpsert(scope="server", key="default_model", value="PRIVATE-PREF-VALUE-1"),
        )
        upsert_preference(
            session,
            PreferenceUpsert(scope="private", key="draftlet-private-key", value="PRIVATE-PREF-VALUE-2"),
        )
        bundle = build_preferences_bundle(session)

    assert isinstance(bundle, PreferencesBundle)
    keys = {(entry.scope, entry.key) for entry in bundle.entries}
    assert ("server", "default_model") in keys
    assert ("private", "draftlet-private-key") in keys
    for entry in bundle.entries:
        assert not hasattr(entry, "value")


def test_support_bundle_preferences_section_is_bounded() -> None:
    Session = create_test_sessionmaker()

    with Session() as session:
        for index in range(250):
            upsert_preference(
                session,
                PreferenceUpsert(scope=f"scope-{index}", key=f"key-{index}", value=f"value-{index}"),
            )
        bundle = build_preferences_bundle(session)

    assert len(bundle.entries) <= 200


def test_support_bundle_counts_section_reflects_seeded_records() -> None:
    Session = create_test_sessionmaker()

    with Session() as session:
        seed_private_data(session)
        counts = build_counts_bundle(session)

    assert isinstance(counts, CountsBundle)
    assert counts.workspaceSessions == 1
    assert counts.conversationThreads == 1
    assert counts.turns == 1
    assert counts.draftVariants == 1
    assert counts.generationRuns == 1


def test_support_bundle_never_includes_selected_text_or_draft_content() -> None:
    Session = create_test_sessionmaker()

    with Session() as session:
        clear_latest_browser_recapture_report(session)
        clear_generation_run_maintenance_status(session)
        seed_private_data(session)
        record_generation_run_maintenance_outcome(
            "startup_maintenance",
            source="startup",
            error_code="private-error-marker",
            error_message="private-error-message-marker",
            session=session,
        )

    async def go() -> SupportBundle:
        with Session() as session:
            return await build_support_bundle(session)

    bundle = asyncio.run(go())
    payload = bundle.model_dump(mode="json")

    def find_marker(obj):
        if isinstance(obj, dict):
            for value in obj.values():
                yield from find_marker(value)
        elif isinstance(obj, list):
            for item in obj:
                yield from find_marker(item)
        elif isinstance(obj, str):
            yield obj

    serialized = "\n".join(find_marker(payload))

    assert PRIVATE_SELECTED_TEXT not in serialized
    assert PRIVATE_DRAFT_CONTENT not in serialized
    assert "PRIVATE-DRAFTLET-URL-MARKER" not in serialized
    assert "PRIVATE-DRAFTLET-PAGE-MARKER-7E2B" not in serialized
    assert "private-instruction-marker" not in serialized
