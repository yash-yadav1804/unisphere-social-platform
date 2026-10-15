import json
import logging
import uuid as _uuid

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from jose import JWTError
from sqlalchemy import and_, or_, select

from app.core.deps import get_current_user
from app.core.security import decode_token
from app.db.session import AsyncSessionLocal, get_db
from app.models.models import Message, User
from app.schemas.schemas import MessageOut

router = APIRouter(prefix="/messages", tags=["messages"])

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self):
        self.active: dict[str, WebSocket] = {}

    async def connect(self, user_id: str, websocket: WebSocket):
        await websocket.accept()
        self.active[user_id] = websocket
        logger.info("WebSocket connected: user_id=%s", user_id)

    def disconnect(self, user_id: str, websocket: WebSocket):
        # Do not remove a newer connection when an older socket closes.
        if self.active.get(user_id) is websocket:
            self.active.pop(user_id, None)
            logger.info("WebSocket disconnected: user_id=%s", user_id)

    async def send_to(self, user_id: str, data: dict) -> bool:
        websocket = self.active.get(user_id)

        if websocket is None:
            logger.warning(
                "Message recipient/sender is not connected: user_id=%s",
                user_id,
            )
            return False

        try:
            await websocket.send_json(data)
            return True
        except Exception:
            logger.exception(
                "Failed to deliver WebSocket message: user_id=%s",
                user_id,
            )
            if self.active.get(user_id) is websocket:
                self.active.pop(user_id, None)
            return False


manager = ConnectionManager()


def serialize_message(message: Message) -> dict:
    return {
        "id": str(message.id),
        "sender_id": str(message.sender_id),
        "receiver_id": str(message.receiver_id),
        "content": message.content,
        "is_read": message.is_read,
        "sent_at": message.sent_at.isoformat(),
    }


@router.websocket("/ws/{token}")
async def websocket_endpoint(websocket: WebSocket, token: str):
    try:
        payload = decode_token(token)
        user_id = payload.get("sub")

        if not user_id:
            await websocket.close(code=1008)
            return

        user_uuid = _uuid.UUID(str(user_id))
        user_id = str(user_uuid)

    except (JWTError, ValueError, TypeError):
        await websocket.close(code=1008)
        return

    await manager.connect(user_id, websocket)

    try:
        while True:
            raw_data = await websocket.receive_text()

            try:
                data = json.loads(raw_data)
            except json.JSONDecodeError:
                await websocket.send_json(
                    {"type": "error", "detail": "Invalid JSON message."}
                )
                continue

            if not isinstance(data, dict):
                await websocket.send_json(
                    {"type": "error", "detail": "Message must be a JSON object."}
                )
                continue

            try:
                receiver_uuid = _uuid.UUID(str(data.get("receiver_id", "")))
            except (ValueError, TypeError, AttributeError):
                await websocket.send_json(
                    {"type": "error", "detail": "Invalid receiver ID."}
                )
                continue

            content = data.get("content")

            if not isinstance(content, str) or not content.strip():
                await websocket.send_json(
                    {"type": "error", "detail": "Message cannot be empty."}
                )
                continue

            content = content.strip()

            if len(content) > 5000:
                await websocket.send_json(
                    {"type": "error", "detail": "Message is too long."}
                )
                continue

            if receiver_uuid == user_uuid:
                await websocket.send_json(
                    {"type": "error", "detail": "You cannot message yourself."}
                )
                continue

            try:
                async with AsyncSessionLocal() as db:
                    receiver = await db.get(User, receiver_uuid)

                    if receiver is None:
                        await websocket.send_json(
                            {"type": "error", "detail": "Recipient not found."}
                        )
                        continue

                    message = Message(
                        sender_id=user_uuid,
                        receiver_id=receiver_uuid,
                        content=content,
                    )
                    db.add(message)
                    await db.commit()
                    await db.refresh(message)

                    message_payload = serialize_message(message)

            except Exception:
                logger.exception(
                    "Failed to save message: sender=%s receiver=%s",
                    user_id,
                    str(receiver_uuid),
                )
                await websocket.send_json(
                    {
                        "type": "error",
                        "detail": "Message could not be saved. Please try again.",
                    }
                )
                continue

            logger.info(
                "Message saved: id=%s sender=%s receiver=%s",
                message_payload["id"],
                user_id,
                str(receiver_uuid),
            )

            # Send the saved message to both connected users.
            await manager.send_to(user_id, message_payload)
            await manager.send_to(str(receiver_uuid), message_payload)

    except WebSocketDisconnect:
        logger.info("WebSocket closed by client: user_id=%s", user_id)

    except Exception:
        logger.exception("Unexpected WebSocket error: user_id=%s", user_id)

    finally:
        manager.disconnect(user_id, websocket)


@router.get("/history/{other_user_id}", response_model=list[MessageOut])
async def message_history(
    other_user_id: str,
    db=Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        other_uuid = _uuid.UUID(other_user_id)
    except (ValueError, TypeError, AttributeError):
        raise HTTPException(status_code=400, detail="Invalid user ID.")

    if other_uuid == current_user.id:
        raise HTTPException(
            status_code=400,
            detail="Cannot open a conversation with yourself.",
        )

    result = await db.execute(
        select(Message)
        .where(
            or_(
                and_(
                    Message.sender_id == current_user.id,
                    Message.receiver_id == other_uuid,
                ),
                and_(
                    Message.sender_id == other_uuid,
                    Message.receiver_id == current_user.id,
                ),
            )
        )
        .order_by(Message.sent_at.asc())
    )

    messages = result.scalars().all()

    unread = [
        message
        for message in messages
        if message.receiver_id == current_user.id and not message.is_read
    ]

    for message in unread:
        message.is_read = True

    if unread:
        await db.commit()

    return messages


@router.get("/conversations", response_model=list[MessageOut])
async def conversations(
    db=Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Message)
        .where(
            or_(
                Message.sender_id == current_user.id,
                Message.receiver_id == current_user.id,
            )
        )
        .order_by(Message.sent_at.desc())
    )

    return result.scalars().all()
