from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.models import Post, SavedPost, User
from app.services.post_service import attach_user_votes
from app.schemas.schemas import PostOut

router = APIRouter(prefix="/saved-posts", tags=["saved posts"])


@router.get("/", response_model=list[PostOut])
async def list_saved_posts(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Post)
        .join(SavedPost, SavedPost.post_id == Post.id)
        .where(SavedPost.user_id == current_user.id)
        .options(selectinload(Post.author))
        .order_by(SavedPost.created_at.desc())
    )
    posts = list(result.scalars().all())
    return await attach_user_votes(posts, current_user.id, db)


@router.put("/{post_id}", status_code=status.HTTP_201_CREATED)
async def save_post(
    post_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    post_result = await db.execute(select(Post.id).where(Post.id == post_id))
    if post_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Post not found")

    existing_result = await db.execute(
        select(SavedPost.id).where(
            SavedPost.user_id == current_user.id,
            SavedPost.post_id == post_id,
        )
    )
    if existing_result.scalar_one_or_none() is None:
        db.add(SavedPost(user_id=current_user.id, post_id=post_id))
        await db.commit()
    return {"message": "Post saved", "is_saved": True}


@router.delete("/{post_id}")
async def unsave_post(
    post_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(SavedPost).where(
            SavedPost.user_id == current_user.id,
            SavedPost.post_id == post_id,
        )
    )
    saved = result.scalar_one_or_none()
    if saved is not None:
        await db.delete(saved)
        await db.commit()
    return {"message": "Post removed from saved items", "is_saved": False}
