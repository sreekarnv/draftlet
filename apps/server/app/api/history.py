from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_session
from app.schemas.history import HistoryGeneration
from app.services.history_service import list_recent_generations


router = APIRouter(tags=["history"])


@router.get("/history", response_model=list[HistoryGeneration])
def get_history(
    limit: int = Query(default=20, ge=1, le=100),
    session: Session = Depends(get_session),
) -> list[HistoryGeneration]:
    return list_recent_generations(session, limit=limit)
