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
