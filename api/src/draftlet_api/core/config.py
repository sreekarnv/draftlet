from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class DraftletSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite+aiosqlite:///./draftletapi.db"
    environment: str = "development"
    host: str = "127.0.0.1"
    port: int = 8000
    log_level: str = "info"
    db_echo: bool = False
    ollama_base_url: str = "http://127.0.0.1:11434"
    ollama_default_model: str = "gemma3:4b"
    cors_origins: list[str] = []


@lru_cache
def get_settings() -> DraftletSettings:
    return DraftletSettings()
