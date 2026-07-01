from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.diagnostics import (
    BrowserRecaptureDiagnosticsState,
    GenerationRunMaintenanceStatus,
)


class RuntimeStatusBundle(BaseModel):
    model_config = ConfigDict(extra="forbid")

    runtimeVersion: str = Field(min_length=1, max_length=40)
    schemaVersion: str = Field(min_length=1, max_length=40)
    apiVersion: str = Field(min_length=1, max_length=40)
    serverPort: int = Field(ge=0, le=65535)


class ModelsBundle(BaseModel):
    model_config = ConfigDict(extra="forbid")

    defaultModel: str = Field(min_length=1, max_length=160)
    selectedModel: str = Field(min_length=1, max_length=160)
    availableModels: list[str] = Field(default_factory=list, max_length=200)
    ollamaAvailable: bool
    ollamaErrorCode: str | None = Field(default=None, max_length=120)
    ollamaErrorMessage: str | None = Field(default=None, max_length=1000)


class CountsBundle(BaseModel):
    model_config = ConfigDict(extra="forbid")

    workspaceSessions: int = Field(ge=0)
    conversationThreads: int = Field(ge=0)
    turns: int = Field(ge=0)
    draftVariants: int = Field(ge=0)
    generationRuns: int = Field(ge=0)


class PreferenceBundleEntry(BaseModel):
    model_config = ConfigDict(extra="forbid")

    scope: str = Field(min_length=1, max_length=80)
    key: str = Field(min_length=1, max_length=120)
    updatedAt: datetime


class PreferencesBundle(BaseModel):
    model_config = ConfigDict(extra="forbid")

    entries: list[PreferenceBundleEntry] = Field(default_factory=list, max_length=200)


class SupportBundle(BaseModel):
    model_config = ConfigDict(extra="forbid")

    capturedAt: datetime
    runtime: RuntimeStatusBundle
    models: ModelsBundle
    recapture: BrowserRecaptureDiagnosticsState
    maintenance: GenerationRunMaintenanceStatus
    preferences: PreferencesBundle
    counts: CountsBundle


__all__ = [
    "CountsBundle",
    "ModelsBundle",
    "PreferenceBundleEntry",
    "PreferencesBundle",
    "RuntimeStatusBundle",
    "SupportBundle",
]
