from functools import lru_cache
from pathlib import Path
import os
import tomllib

from pydantic import BaseModel


# Local-development CORS defaults. The Draftlet extension service worker
# fetches the runtime over loopback, and the optional Vite dev server runs on
# 5173. Loopback origins only are allowed by default; everything else must
# be opted in explicitly.
DEFAULT_CORS_ALLOW_ORIGINS: tuple[str, ...] = (
    "http://127.0.0.1:47632",
    "http://localhost:47632",
    "http://127.0.0.1:5173",
    "http://localhost:5173",
)

# Chrome extension service workers send an `Origin: chrome-extension://<id>`
# header for cross-origin fetches. Unpacked extension IDs are not stable, so
# the safest practical default is to allow any chrome-extension origin from
# the local workstation. The Draftlet server is bound to 127.0.0.1 only and
# the loopback exposure is the trade-off. Operators who want a tighter
# setting can override this with a stricter regex or full origin list via
# environment variables, or set `DRAFTLET_CORS_ALLOW_ORIGIN_REGEX=disabled`
# to drop chrome-extension origins entirely and rely on the explicit
# `DRAFTLET_CORS_ALLOW_ORIGINS` list instead.
DEFAULT_CORS_ALLOW_ORIGIN_REGEX: str | None = r"chrome-extension://[a-z]+"

# Server port that the FastAPI app is expected to bind to. Mirrored in
# `app/packaged_main.py`; both share the same env override.
DEFAULT_SERVER_PORT = 47632

# Schema and API versions for the Draftlet runtime contract. These are
# bumped when the public surface area changes; the runtime version comes
# from pyproject.toml.
SCHEMA_VERSION = "0.2.0"
API_VERSION = "0.2.0"


def _resolve_runtime_version() -> str:
    candidates = [
        Path(__file__).resolve().parent.parent.parent / "pyproject.toml",
        Path.cwd() / "pyproject.toml",
    ]

    for candidate in candidates:
        if candidate.is_file():
            with candidate.open("rb") as handle:
                data = tomllib.load(handle)
            return str(data["project"]["version"])

    return "0.0.0"


RUNTIME_VERSION = _resolve_runtime_version()


class Settings(BaseModel):
    app_name: str = "Draftlet Server"
    ollama_base_url: str = "http://127.0.0.1:11434"
    default_model: str = "gemma3:4b"
    database_url: str = "sqlite:///./draftlet.db"
    cors_allow_origins: list[str] = list(DEFAULT_CORS_ALLOW_ORIGINS)
    cors_allow_origin_regex: str | None = DEFAULT_CORS_ALLOW_ORIGIN_REGEX


@lru_cache
def get_settings() -> Settings:
    return Settings(
        ollama_base_url=os.getenv("DRAFTLET_OLLAMA_BASE_URL", "http://127.0.0.1:11434"),
        default_model=os.getenv("DRAFTLET_OLLAMA_MODEL", "gemma3:4b"),
        database_url=os.getenv("DRAFTLET_DATABASE_URL", "sqlite:///./draftlet.db"),
        cors_allow_origins=_parse_cors_allow_origins(
            os.getenv("DRAFTLET_CORS_ALLOW_ORIGINS")
        ),
        cors_allow_origin_regex=_parse_cors_allow_origin_regex(
            os.getenv("DRAFTLET_CORS_ALLOW_ORIGIN_REGEX")
        ),
    )


def get_server_port() -> int:
    raw = os.getenv("DRAFTLET_SERVER_PORT")

    if raw is None or not raw.strip():
        return DEFAULT_SERVER_PORT

    try:
        return int(raw.strip())
    except ValueError:
        return DEFAULT_SERVER_PORT


def get_runtime_version() -> str:
    return RUNTIME_VERSION


def get_schema_version() -> str:
    return SCHEMA_VERSION


def get_api_version() -> str:
    return API_VERSION


def _parse_cors_allow_origins(raw: str | None) -> list[str]:
    if raw is None or not raw.strip():
        return list(DEFAULT_CORS_ALLOW_ORIGINS)

    origins = [origin.strip() for origin in raw.split(",") if origin.strip()]
    return origins or list(DEFAULT_CORS_ALLOW_ORIGINS)


def _parse_cors_allow_origin_regex(raw: str | None) -> str | None:
    if raw is None:
        return DEFAULT_CORS_ALLOW_ORIGIN_REGEX

    cleaned = raw.strip()
    if not cleaned or cleaned.lower() == "disabled":
        return None

    return cleaned
