from fastapi import Request
from fastapi.responses import JSONResponse

from draftlet_api.core.errors import DraftletApiError


async def problem_details_handler(request: Request, error: Exception) -> JSONResponse:
    if not isinstance(error, DraftletApiError):
        return JSONResponse(
            status_code=500,
            media_type="application/problem+json",
            content={
                "type": "about:blank",
                "title": "Internal Server Error",
                "status": 500,
                "detail": "Internal server error",
                "instance": request.url.path,
                "code": "internal_error",
            },
        )

    return JSONResponse(
        status_code=error.status,
        media_type="application/problem+json",
        content={
            "type": "about:blank",
            "title": error.code.replace("_", " ").title(),
            "status": error.status,
            "detail": error.detail,
            "instance": request.url.path,
            "code": error.code,
        },
    )
