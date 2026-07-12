from uvicorn import run

from draftlet_api.core.config import get_settings


def dev() -> None:
    settings = get_settings()
    run(
        "draftlet_api.main:app",
        host=settings.host,
        port=settings.port,
        log_level=settings.log_level,
        reload=settings.environment == "development",
        workers=1,
    )
