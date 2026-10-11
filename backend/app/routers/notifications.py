from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.models import Notification, User
from app.schemas.schemas import NotificationOut

router = APIRouter(prefix="/notifications", tags=["notifications"])


def serialize_notification(notification: Notification, actor_username: str | None):
    return {
        "id": notification.id,
        "actor_id": notification.actor_id,
        "notification_type": notification.notification_type,
        "post_id": notification.post_id,
        "comment_id": notification.comment_id,
        "message": notification.message,
        "is_read": notification.is_read,
        "created_at": notification.created_at,
        "actor_username": actor_username,
    }


@router.get("/", response_model=list[NotificationOut])
async def list_notifications(
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    limit = max(1, min(limit, 100))
    result = await db.execute(
        select(Notification, User.username)
        .outerjoin(User, User.id == Notification.actor_id)
        .where(Notification.recipient_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .limit(limit)
    )
    return [serialize_notification(item, username) for item, username in result.all()]


@router.get("/unread-count")
async def unread_count(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(func.count(Notification.id)).where(
            Notification.recipient_id == current_user.id,
            Notification.is_read.is_(False),
        )
    )
    return {"count": result.scalar_one()}


@router.patch("/{notification_id}/read")
async def mark_notification_read(
    notification_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.recipient_id == current_user.id,
        )
    )
    notification = result.scalar_one_or_none()
    if notification is None:
        raise HTTPException(status_code=404, detail="Notification not found")
    notification.is_read = True
    await db.commit()
    return {"message": "Notification marked as read"}


@router.post("/read-all", status_code=status.HTTP_200_OK)
async def mark_all_read(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await db.execute(
        update(Notification)
        .where(
            Notification.recipient_id == current_user.id,
            Notification.is_read.is_(False),
        )
        .values(is_read=True)
    )
    await db.commit()
    return {"message": "All notifications marked as read"}
