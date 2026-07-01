from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.db.session import get_session
from app.schemas.model import ModelSelectionUpdate, RuntimeModelState
from app.services.model_service import get_runtime_model_state, set_runtime_selected_model


router = APIRouter(prefix="/models", tags=["models"])


@router.get("/ollama", response_model=RuntimeModelState)
async def get_ollama_model_state(
    session: Session = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> RuntimeModelState:
    return await get_runtime_model_state(session, settings)


@router.put("/ollama/selection", response_model=RuntimeModelState)
async def put_ollama_model_selection(
    data: ModelSelectionUpdate,
    session: Session = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> RuntimeModelState:
    return await set_runtime_selected_model(session, settings, data)
