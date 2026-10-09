from pydantic import BaseModel, EmailStr
from uuid import UUID
from datetime import datetime
from typing import Optional


class RegisterRequest(BaseModel):
    username: str
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: UUID
    username: str
    email: str
    avatar_url: Optional[str]
    bio: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class CommunityCreate(BaseModel):
    name: str
    description: Optional[str] = None


class CommunityOut(BaseModel):
    id: UUID
    name: str
    description: Optional[str]
    banner_url: Optional[str]
    created_by: UUID
    created_at: datetime
    member_count: Optional[int] = 0

    class Config:
        from_attributes = True


class PostCreate(BaseModel):
    title: str
    content: Optional[str] = None
    image_url: Optional[str] = None


class PostOut(BaseModel):
    id: UUID
    community_id: UUID
    author_id: UUID
    title: str
    content: Optional[str]
    image_url: Optional[str]
    upvotes: int
    downvotes: int
    created_at: datetime
    author: Optional[UserOut] = None
    user_vote: int = 0

    class Config:
        from_attributes = True


class CommentCreate(BaseModel):
    content: str
    parent_id: Optional[UUID] = None
    idempotency_key: UUID


class CommentOut(BaseModel):
    id: UUID
    post_id: UUID
    author_id: UUID
    parent_id: Optional[UUID]
    content: str
    upvotes: int
    created_at: datetime
    author: Optional[UserOut] = None
    replies: list["CommentOut"] = []

    class Config:
        from_attributes = True


CommentOut.model_rebuild()


class VoteRequest(BaseModel):
    target_id: UUID
    target_type: str  # "post" or "comment"
    value: int  # 1 or -1


class MessageOut(BaseModel):
    id: UUID
    sender_id: UUID
    receiver_id: UUID
    content: str
    is_read: bool
    sent_at: datetime

    class Config:
        from_attributes = True
