from pydantic import BaseModel, Field, field_validator


class RuntimeErrorInfo(BaseModel):
    code: str = Field(min_length=1, max_length=120)
    message: str = Field(min_length=1, max_length=1000)
    retryable: bool = False


class OllamaModelRead(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    size: int | None = Field(default=None, ge=0)
    digest: str | None = Field(default=None, max_length=160)
    modified_at: str | None = Field(default=None, max_length=80)


class RuntimeModelRecommendation(BaseModel):
    model: str = Field(min_length=1, max_length=160)
    label: str = Field(min_length=1, max_length=80)
    description: str = Field(min_length=1, max_length=240)
    installed: bool = False


class RuntimeModelState(BaseModel):
    selected_model: str = Field(min_length=1, max_length=160)
    default_model: str = Field(min_length=1, max_length=160)
    installed_models: list[OllamaModelRead] = Field(default_factory=list)
    recommendations: list[RuntimeModelRecommendation] = Field(default_factory=list)
    ollama_available: bool
    error: RuntimeErrorInfo | None = None


class ModelSelectionUpdate(BaseModel):
    selected_model: str = Field(min_length=1, max_length=160)

    @field_validator("selected_model", mode="before")
    @classmethod
    def strip_selected_model(cls, value: str | None) -> str | None:
        if value is None:
            return None

        return value.strip() or None
