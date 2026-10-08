import uuid as _uuid
from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_
from app.db.session import get_db, AsyncSessionLocal
from app.models.models import Message, User
from app.schemas.schemas import MessageOut
from app.core.deps import get_current_user
from app.core.security import decode_token
from jose import JWTError
import json

router = APIRouter(prefix="/messages", tags=["messages"])

class ConnectionManager:
    def __init__(self):
        self.active: dict[str, WebSocket] = {}

    async def connect(self, user_id: str, websocket: WebSocket):
        await websocket.accept()
        self.active[user_id] = websocket

    def disconnect(self, user_id: str):
        self.active.pop(user_id, None)

    async def send_to(self, user_id: str, data: dict):
        ws = self.active.get(user_id)
        if ws:
            await ws.send_text(json.dumps(data))

manager = ConnectionManager()

@router.websocket("/ws/{token}")
async def websocket_endpoint(websocket: WebSocket, token: str):
    try:
        payload = decode_token(token)
        user_id = payload.get("sub")
        if not user_id:
            await websocket.close(code=1008)
            return
    except JWTError:
        await websocket.close(code=1008)
        return

    await manager.connect(user_id, websocket)
    try:
        while True:
            data = await websocket.receive_text()
            msg_data = json.loads(data)
            receiver_id = msg_data.get("receiver_id")
            content = msg_data.get("content")

            async with AsyncSessionLocal() as db:
                message = Message(
                    sender_id=user_id,
                    receiver_id=receiver_id,
                    content=content
                )
                db.add(message)
                await db.commit()
                await db.refresh(message)

            payload = {
                "id": str(message.id),
                "sender_id": str(message.sender_id),
                "receiver_id": str(message.receiver_id),
                "content": message.content,
                "is_read": message.is_read,
                "sent_at": message.sent_at.isoformat()
            }
            await manager.send_to(user_id, payload)
            await manager.send_to(receiver_id, payload)

    except WebSocketDisconnect:
        manager.disconnect(user_id)

@router.get("/history/{other_user_id}", response_model=list[MessageOut])
async def message_history(
    other_user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    other_uuid = _uuid.UUID(other_user_id)
    result = await db.execute(
        select(Message).where(
            or_(
                and_(Message.sender_id == current_user.id, Message.receiver_id == other_uuid),
                and_(Message.sender_id == other_uuid, Message.receiver_id == current_user.id)
            )
        ).order_by(Message.sent_at.asc())
    )
    messages = result.scalars().all()

    unread = [m for m in messages if str(m.receiver_id) == str(current_user.id) and not m.is_read]
    for m in unread:
        m.is_read = True
    if unread:
        await db.commit()

    return messages

@router.get("/conversations", response_model=list[MessageOut])
async def conversations(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(Message).where(
            or_(Message.sender_id == current_user.id, Message.receiver_id == current_user.id)
        ).order_by(Message.sent_at.desc())
    )
    return result.scalars().all()
