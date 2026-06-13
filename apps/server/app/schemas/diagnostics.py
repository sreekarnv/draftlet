from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class RecaptureDiagnosticsReportEntry(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: int
    event: str = Field(min_length=1, max_length=120)
    level: str = Field(min_length=1, max_length=40)
    sessionId: str = Field(min_length=1, max_length=120)
    tabId: int | None = None
    status: str | None = Field(default=None, max_length=80)
    outcome: str | None = Field(default=None, max_length=120)
    reason: str | None = Field(default=None, max_length=160)
    message: str = Field(min_length=1, max_length=1000)
    at: str = Field(min_length=1, max_length=80)


class RecaptureDiagnosticsReport(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: str = Field(pattern=r"^draftlet\.recapture-diagnostics$")
    exportedAt: str = Field(min_length=1, max_length=80)
    entries: list[RecaptureDiagnosticsReportEntry] = Field(default_factory=list, max_length=50)


class BrowserRecaptureDiagnosticsState(BaseModel):
    report: RecaptureDiagnosticsReport | None = None
    receivedAt: str | None = None
    stale: bool = False
    staleAfterSeconds: int


class GenerationRunMaintenanceOutcome(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: int
    operation: str = Field(min_length=1, max_length=80)
    status: str = Field(min_length=1, max_length=40)
    source: str | None = Field(default=None, max_length=80)
    at: datetime
    reconciledRunCount: int = Field(default=0, ge=0)
    reconciledRunIds: list[str] = Field(default_factory=list, max_length=20)
    prunedEventCount: int = Field(default=0, ge=0)
    staleAfterSeconds: int | None = Field(default=None, ge=0)
    retentionDays: int | None = Field(default=None, ge=0)
    replayLimit: int | None = Field(default=None, ge=0)
    pruneBatchSize: int | None = Field(default=None, ge=0)
    errorCode: str | None = Field(default=None, max_length=120)
    errorMessage: str | None = Field(default=None, max_length=1000)


class GenerationRunMaintenanceStatus(BaseModel):
    checkedAt: datetime
    processLocal: bool = True
    recentLimit: int
    latestStartup: GenerationRunMaintenanceOutcome | None = None
    latestStaleReconciliation: GenerationRunMaintenanceOutcome | None = None
    latestReplayPrune: GenerationRunMaintenanceOutcome | None = None
    recent: list[GenerationRunMaintenanceOutcome] = Field(default_factory=list)
