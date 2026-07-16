import os
from pathlib import Path

from platformdirs import user_data_path

from draftlet_api.core.config import DraftletSettings, get_settings


def telegram_session_path(settings: DraftletSettings | None = None) -> Path:
    settings = settings or get_settings()
    if settings.telegram_session_path:
        return Path(settings.telegram_session_path).expanduser()
    return user_data_path("draftlet", appauthor=False) / "telegram.session"


def ensure_private_file(path: Path) -> None:
    if path.exists():
        os.chmod(path, 0o600)


def ensure_private_parent(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    os.chmod(path.parent, 0o700)
