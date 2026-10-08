from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.db.session import get_db
from app.models.models import Comment, User
from app.schemas.schemas import CommentCreate, CommentOut
from app.core.deps import get_current_user

router = APIRouter(prefix="/comments", tags=["comments"])

def build_tree(comments: list, parent_id=None) -> list:
    return [
        {**c.__dict__, "replies": build_tree(comments, c.id)}
        for c in comments if c.parent_id == parent_id
    ]

@router.post("/{post_id}", response_model=CommentOut)
async def create_comment(
    post_id: str,
    data: CommentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    comment = Comment(
        post_id=post_id,
        author_id=current_user.id,
        content=data.content,
        parent_id=data.parent_id
    )
    db.add(comment)
    await db.commit()
    await db.refresh(comment)
    return comment

@router.get("/{post_id}", response_model=list[CommentOut])
async def get_comments(post_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Comment)
        .where(Comment.post_id == post_id)
        .options(selectinload(Comment.author))
        .order_by(Comment.created_at.asc())
    )
    comments = result.scalars().all()
    return build_tree(comments, parent_id=None)
