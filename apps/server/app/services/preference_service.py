from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Preference
from app.schemas.preference import PreferenceUpsert


SERVER_MODEL_PREFERENCE_SCOPE = "server"
SERVER_MODEL_PREFERENCE_KEY = "default_model"


def list_preferences(session: Session, scope: str | None = None) -> list[Preference]:
    statement = select(Preference).order_by(Preference.scope, Preference.key)

    if scope:
        statement = statement.where(Preference.scope == scope)

    return list(session.scalars(statement).all())


def upsert_preference(session: Session, data: PreferenceUpsert) -> Preference:
    preference = session.scalar(
        select(Preference).where(
            Preference.scope == data.scope,
            Preference.key == data.key,
        )
    )

    if preference is None:
        preference = Preference(scope=data.scope, key=data.key, value=data.value)
        session.add(preference)
    else:
        preference.value = data.value

    session.commit()
    session.refresh(preference)
    return preference


def get_preference_value(session: Session, scope: str, key: str) -> str | None:
    preference = session.scalar(
        select(Preference).where(
            Preference.scope == scope,
            Preference.key == key,
        )
    )

    if preference is None:
        return None

    value = preference.value.strip()
    return value or None
