import os

import uvicorn

from app.core.config import get_settings
from app.core.database import engine
from app.db import models  # noqa: F401
from app.db.base import Base
from app.main import app

DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 47632


def ensure_database() -> None:
    Base.metadata.create_all(bind=engine)


def main() -> None:
    ensure_database()
    port = int(os.getenv("DRAFTLET_SERVER_PORT", str(DEFAULT_PORT)))
    settings = get_settings()

    uvicorn.run(
        app,
        host=DEFAULT_HOST,
        port=port,
        log_level=os.getenv("DRAFTLET_LOG_LEVEL", "info"),
        lifespan="on",
        proxy_headers=False,
    )


if __name__ == "__main__":
    main()
