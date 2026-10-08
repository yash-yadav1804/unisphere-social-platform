from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.db.session import get_db
from app.models.models import User, Post, Comment
from app.schemas.schemas import UserOut, PostOut, CommentOut
from app.core.deps import get_current_user

router = APIRouter(prefix="/users", tags=["users"])

@router.get("/{username}", response_model=UserOut)
async def get_profile(username: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@router.get("/{username}/posts", response_model=list[PostOut])
async def user_posts(username: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    posts = await db.execute(
        select(Post).where(Post.author_id == user.id).order_by(Post.created_at.desc())
    )
    return posts.scalars().all()

@router.get("/{username}/comments", response_model=list[CommentOut])
async def user_comments(username: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    comments = await db.execute(
        select(Comment).where(Comment.author_id == user.id).order_by(Comment.created_at.desc())
    )
    return comments.scalars().all()
