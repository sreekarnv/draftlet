from sqlalchemy.orm import Session

from app.core.config import Settings
from app.schemas.model import (
    ModelSelectionUpdate,
    OllamaModelRead,
    RuntimeErrorInfo,
    RuntimeModelRecommendation,
    RuntimeModelState,
)
from app.schemas.preference import PreferenceUpsert
from app.services.ollama_client import OllamaClientError, list_ollama_models
from app.services.preference_service import (
    SERVER_MODEL_PREFERENCE_KEY,
    SERVER_MODEL_PREFERENCE_SCOPE,
    get_preference_value,
    upsert_preference,
)


DEFAULT_RECOMMENDED_MODEL = "gemma3:4b"
POWER_USER_RECOMMENDED_MODEL = "qwen2.5:7b"
LOW_END_FALLBACK_MODEL = "llama3.2:3b"


async def get_runtime_model_state(session: Session, settings: Settings) -> RuntimeModelState:
    installed_models: list[OllamaModelRead] = []
    error: RuntimeErrorInfo | None = None

    try:
        installed_models = [
            model
            for model in (
                normalize_ollama_model(raw_model)
                for raw_model in await list_ollama_models(base_url=settings.ollama_base_url)
            )
            if model is not None
        ]
    except OllamaClientError as exc:
        error = RuntimeErrorInfo(
            code="ollama_models_unavailable",
            message=str(exc),
            retryable=True,
        )

    default_model = resolve_default_model(settings.default_model, installed_models)
    selected_model = get_selected_model_preference(session) or default_model

    return RuntimeModelState(
        selected_model=selected_model,
        default_model=default_model,
        installed_models=installed_models,
        recommendations=build_model_recommendations(installed_models),
        ollama_available=error is None,
        error=error,
    )


async def set_runtime_selected_model(
    session: Session,
    settings: Settings,
    data: ModelSelectionUpdate,
) -> RuntimeModelState:
    upsert_preference(
        session,
        PreferenceUpsert(
            scope=SERVER_MODEL_PREFERENCE_SCOPE,
            key=SERVER_MODEL_PREFERENCE_KEY,
            value=data.selected_model,
        ),
    )
    return await get_runtime_model_state(session, settings)


def resolve_generation_model(session: Session, fallback_model: str) -> str:
    return get_selected_model_preference(session) or fallback_model


def get_selected_model_preference(session: Session) -> str | None:
    return get_preference_value(
        session,
        SERVER_MODEL_PREFERENCE_SCOPE,
        SERVER_MODEL_PREFERENCE_KEY,
    )


def resolve_default_model(configured_default_model: str, installed_models: list[OllamaModelRead]) -> str:
    configured = configured_default_model.strip() or DEFAULT_RECOMMENDED_MODEL
    installed_names = {model.name for model in installed_models}

    if configured == DEFAULT_RECOMMENDED_MODEL and DEFAULT_RECOMMENDED_MODEL in installed_names:
        return DEFAULT_RECOMMENDED_MODEL

    return configured


def build_model_recommendations(installed_models: list[OllamaModelRead]) -> list[RuntimeModelRecommendation]:
    installed_names = {model.name for model in installed_models}
    return [
        RuntimeModelRecommendation(
            model=DEFAULT_RECOMMENDED_MODEL,
            label="Default",
            description="Recommended balance for everyday drafting quality and local performance.",
            installed=DEFAULT_RECOMMENDED_MODEL in installed_names,
        ),
        RuntimeModelRecommendation(
            model=POWER_USER_RECOMMENDED_MODEL,
            label="Power user",
            description="Higher-capacity local model for longer or more nuanced threads.",
            installed=POWER_USER_RECOMMENDED_MODEL in installed_names,
        ),
        RuntimeModelRecommendation(
            model=LOW_END_FALLBACK_MODEL,
            label="Low-end fallback",
            description="Smaller fallback recommendation for constrained machines.",
            installed=LOW_END_FALLBACK_MODEL in installed_names,
        ),
    ]


def normalize_ollama_model(raw: dict) -> OllamaModelRead | None:
    name = str(raw.get("name") or raw.get("model") or "").strip()

    if not name:
        return None

    return OllamaModelRead(
        name=name,
        size=raw.get("size") if isinstance(raw.get("size"), int) else None,
        digest=str(raw.get("digest")).strip() if raw.get("digest") else None,
        modified_at=str(raw.get("modified_at")).strip() if raw.get("modified_at") else None,
    )
