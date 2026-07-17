import os
import sys
from pathlib import Path

from alembic import command
from alembic.config import Config
from platformdirs import user_data_path
from uvicorn import run

from draftlet_api.core.config import get_settings


def runtime_root() -> Path:
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parents[2]


def configure_production_environment() -> None:
    data_dir = user_data_path("draftlet", appauthor=False)
    data_dir.mkdir(parents=True, exist_ok=True)

    os.environ.setdefault("ENVIRONMENT", "production")
    os.environ.setdefault("DATABASE_URL", f"sqlite+aiosqlite:///{data_dir / 'draftletapi.db'}")


def run_migrations() -> None:
    root = runtime_root()
    config = Config(root / "alembic.ini")
    config.set_main_option("script_location", str(root / "alembic"))
    command.upgrade(config, "head")


def main() -> None:
    configure_production_environment()
    run_migrations()
    get_settings.cache_clear()
    settings = get_settings()
    run(
        "draftlet_api.main:app",
        host=settings.host,
        port=settings.port,
        log_level=settings.log_level,
        reload=False,
        workers=1,
    )


if __name__ == "__main__":
    main()
