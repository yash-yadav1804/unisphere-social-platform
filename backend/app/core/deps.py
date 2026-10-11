import uuid

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_token
from app.db.session import get_db
from app.models.models import User


bearer_scheme = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    token = credentials.credentials

    try:
        payload = decode_token(token)
        user_id: str = payload.get("sub")

        if user_id is None:
            raise credentials_exception

    except (JWTError, ValueError):
        raise credentials_exception

    result = await db.execute(
        select(User).where(User.id == uuid.UUID(user_id))
    )

    user = result.scalar_one_or_none()

    if user is None:
        raise credentials_exception

    return user

optional_bearer_scheme = HTTPBearer(auto_error=False)


async def get_optional_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(optional_bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User | None:
    """Resolve a user when a valid bearer token is present; allow public reads otherwise."""
    if credentials is None:
        return None
    try:
        payload = decode_token(credentials.credentials)
        subject = payload.get("sub")
        if not subject:
            return None
        user_id = uuid.UUID(subject)
    except (JWTError, ValueError, TypeError):
        return None
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()
