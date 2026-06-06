from functools import lru_cache
import os

from pydantic import BaseModel


class Settings(BaseModel):
    app_name: str = "Draftlet Server"
    ollama_base_url: str = "http://127.0.0.1:11434"
    default_model: str = "gemma3:4b"
    database_url: str = "sqlite:///./draftlet.db"


@lru_cache
def get_settings() -> Settings:
    return Settings(
        ollama_base_url=os.getenv("DRAFTLET_OLLAMA_BASE_URL", "http://127.0.0.1:11434"),
        default_model=os.getenv("DRAFTLET_OLLAMA_MODEL", "gemma3:4b"),
        database_url=os.getenv("DRAFTLET_DATABASE_URL", "sqlite:///./draftlet.db"),
    )
