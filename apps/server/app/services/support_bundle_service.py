from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.core.config import (
    API_VERSION,
    RUNTIME_VERSION,
    SCHEMA_VERSION,
    get_server_port,
    get_settings,
)
from app.schemas.model import RuntimeModelState
from app.schemas.support_bundle import (
    CountsBundle,
    ModelsBundle,
    PreferenceBundleEntry,
    PreferencesBundle,
    RuntimeStatusBundle,
    SupportBundle,
)
from app.services.diagnostics_service import (
    count_durable_records,
    get_browser_recapture_diagnostics_state,
    get_generation_run_maintenance_status,
)
from app.services.model_service import get_runtime_model_state
from app.services.preference_service import list_preferences


PREFERENCE_BUNDLE_MAX_ENTRIES = 200


def build_runtime_status_bundle() -> RuntimeStatusBundle:
    return RuntimeStatusBundle(
        runtimeVersion=RUNTIME_VERSION,
        schemaVersion=SCHEMA_VERSION,
        apiVersion=API_VERSION,
        serverPort=get_server_port(),
    )


def build_models_bundle_from_state(state: RuntimeModelState) -> ModelsBundle:
    available_models = [model.name for model in state.installed_models if model.name]
    error = state.error
    return ModelsBundle(
        defaultModel=state.default_model,
        selectedModel=state.selected_model,
        availableModels=available_models,
        ollamaAvailable=state.ollama_available,
        ollamaErrorCode=error.code if error else None,
        ollamaErrorMessage=error.message if error else None,
    )


def build_preferences_bundle(session: Session) -> PreferencesBundle:
    preferences = list_preferences(session)
    bounded = preferences[:PREFERENCE_BUNDLE_MAX_ENTRIES]
    entries = [
        PreferenceBundleEntry(scope=preference.scope, key=preference.key, updatedAt=preference.updated_at)
        for preference in bounded
    ]
    return PreferencesBundle(entries=entries)


def build_counts_bundle(session: Session) -> CountsBundle:
    counts = count_durable_records(session)
    return CountsBundle(
        workspaceSessions=counts["workspace_sessions"],
        conversationThreads=counts["conversation_threads"],
        turns=counts["turns"],
        draftVariants=counts["draft_variants"],
        generationRuns=counts["generation_runs"],
    )


async def build_support_bundle(session: Session) -> SupportBundle:
    settings = get_settings()
    model_state = await get_runtime_model_state(session, settings)
    recapture = get_browser_recapture_diagnostics_state(session)
    maintenance = get_generation_run_maintenance_status(session)
    preferences = build_preferences_bundle(session)
    counts = build_counts_bundle(session)
    runtime = build_runtime_status_bundle()
    models = build_models_bundle_from_state(model_state)

    return SupportBundle(
        capturedAt=datetime.now(UTC),
        runtime=runtime,
        models=models,
        recapture=recapture,
        maintenance=maintenance,
        preferences=preferences,
        counts=counts,
    )


__all__ = [
    "PREFERENCE_BUNDLE_MAX_ENTRIES",
    "build_counts_bundle",
    "build_models_bundle_from_state",
    "build_preferences_bundle",
    "build_runtime_status_bundle",
    "build_support_bundle",
    "resolve_server_port",
]
