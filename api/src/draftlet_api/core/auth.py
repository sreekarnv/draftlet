from fastapi import Header, HTTPException, status

from draftlet_api.core.config import get_settings


async def require_runtime_token(
    token: str | None = Header(default=None, alias="X-Draftlet-Runtime-Token"),
) -> None:
    expected = get_settings().runtime_auth_token
    if not expected:
        return

    if token != expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid runtime token",
        )
