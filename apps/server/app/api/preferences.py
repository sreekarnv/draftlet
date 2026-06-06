from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_session
from app.schemas.preference import PreferenceRead, PreferenceUpsert
from app.services.preference_service import list_preferences, upsert_preference


router = APIRouter(tags=["preferences"])


@router.get("/preferences", response_model=list[PreferenceRead])
def get_preferences(
    scope: str | None = Query(default=None, min_length=1, max_length=80),
    session: Session = Depends(get_session),
) -> list[PreferenceRead]:
    return list_preferences(session, scope=scope)


@router.put("/preferences", response_model=PreferenceRead)
def put_preference(data: PreferenceUpsert, session: Session = Depends(get_session)) -> PreferenceRead:
    return upsert_preference(session, data)
