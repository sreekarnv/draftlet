import asyncio

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.api.models import get_ollama_model_state
from app.core.config import Settings
from app.db.base import Base
from app.schemas.model import ModelSelectionUpdate
from app.services.model_service import get_runtime_model_state, set_runtime_selected_model
from app.services.ollama_client import OllamaClientError


def create_test_sessionmaker():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)



def test_runtime_model_state_defaults_to_gemma_when_available(monkeypatch) -> None:
    async def list_models(*, base_url: str):
        return [
            {"name": "gemma3:4b", "size": 1},
            {"name": "qwen2.5:7b", "size": 2},
        ]

    monkeypatch.setattr("app.services.model_service.list_ollama_models", list_models)
    Session = create_test_sessionmaker()

    with Session() as session:
        state = asyncio.run(get_runtime_model_state(session, Settings(default_model="gemma3:4b")))

    assert state.selected_model == "gemma3:4b"
    assert state.default_model == "gemma3:4b"
    assert state.ollama_available is True
    assert [model.name for model in state.installed_models] == ["gemma3:4b", "qwen2.5:7b"]
    assert {recommendation.model: recommendation.installed for recommendation in state.recommendations} == {
        "gemma3:4b": True,
        "qwen2.5:7b": True,
        "llama3.2:3b": False,
    }


def test_runtime_model_selection_is_not_hard_locked_to_installed_models(monkeypatch) -> None:
    async def list_models(*, base_url: str):
        return [{"name": "gemma3:4b"}]

    monkeypatch.setattr("app.services.model_service.list_ollama_models", list_models)
    Session = create_test_sessionmaker()

    with Session() as session:
        state = asyncio.run(
            set_runtime_selected_model(
                session,
                Settings(default_model="gemma3:4b"),
                ModelSelectionUpdate(selected_model="custom-local:13b"),
            )
        )

    assert state.selected_model == "custom-local:13b"
    assert state.installed_models[0].name == "gemma3:4b"


def test_runtime_model_state_returns_structured_error_when_ollama_listing_fails(monkeypatch) -> None:
    async def list_models(*, base_url: str):
        raise OllamaClientError("Could not connect to Ollama")

    monkeypatch.setattr("app.services.model_service.list_ollama_models", list_models)
    Session = create_test_sessionmaker()

    with Session() as session:
        state = asyncio.run(get_runtime_model_state(session, Settings(default_model="gemma3:4b")))

    assert state.selected_model == "gemma3:4b"
    assert state.installed_models == []
    assert state.ollama_available is False
    assert state.error is not None
    assert state.error.code == "ollama_models_unavailable"
    assert state.error.retryable is True


def test_ollama_model_state_route_is_registered_and_returns_state(monkeypatch) -> None:
    async def list_models(*, base_url: str):
        return [{"name": "gemma3:4b"}]

    monkeypatch.setattr("app.services.model_service.list_ollama_models", list_models)
    Session = create_test_sessionmaker()

    with Session() as session:
        state = asyncio.run(get_ollama_model_state(session=session, settings=Settings(default_model="gemma3:4b")))

    assert state.selected_model == "gemma3:4b"
    assert state.installed_models[0].name == "gemma3:4b"
