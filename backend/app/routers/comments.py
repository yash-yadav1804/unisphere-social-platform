from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.models import Comment, Post, User
from app.schemas.schemas import CommentCreate, CommentOut

router = APIRouter(prefix="/comments", tags=["comments"])


def build_tree(comments: list[Comment]) -> list[dict]:
    """Serialize comments into a nested tree without exposing ORM internals."""
    children: dict[UUID | None, list[Comment]] = {}

    for comment in comments:
        children.setdefault(comment.parent_id, []).append(comment)

    def serialize(comment: Comment) -> dict:
        author = comment.author

        return {
            "id": comment.id,
            "post_id": comment.post_id,
            "author_id": comment.author_id,
            "parent_id": comment.parent_id,
            "content": comment.content,
            "upvotes": comment.upvotes,
            "created_at": comment.created_at,
            "author": author,
            "replies": [serialize(reply) for reply in children.get(comment.id, [])],
        }

    return [serialize(comment) for comment in children.get(None, [])]


@router.post(
    "/{post_id}",
    response_model=CommentOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_comment(
    post_id: UUID,
    data: CommentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    content = data.content.strip()

    if not content:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Comment content cannot be empty.",
        )

    if len(content) > 5000:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Comment content must be 5000 characters or fewer.",
        )

    post_result = await db.execute(select(Post.id).where(Post.id == post_id))
    if post_result.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found.",
        )

    if data.parent_id is not None:
        parent_result = await db.execute(
            select(Comment).where(
                Comment.id == data.parent_id,
                Comment.post_id == post_id,
            )
        )
        if parent_result.scalar_one_or_none() is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Parent comment does not belong to this post.",
            )

    comment = Comment(
        post_id=post_id,
        author_id=current_user.id,
        content=content,
        parent_id=data.parent_id,
    )

    db.add(comment)
    await db.commit()

    result = await db.execute(
        select(Comment)
        .where(Comment.id == comment.id)
        .options(selectinload(Comment.author))
    )
    created_comment = result.scalar_one()

    return {
        "id": created_comment.id,
        "post_id": created_comment.post_id,
        "author_id": created_comment.author_id,
        "parent_id": created_comment.parent_id,
        "content": created_comment.content,
        "upvotes": created_comment.upvotes,
        "created_at": created_comment.created_at,
        "author": created_comment.author,
        "replies": [],
    }


@router.get("/{post_id}", response_model=list[CommentOut])
async def get_comments(
    post_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    post_result = await db.execute(select(Post.id).where(Post.id == post_id))
    if post_result.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found.",
        )

    result = await db.execute(
        select(Comment)
        .where(Comment.post_id == post_id)
        .options(selectinload(Comment.author))
        .order_by(Comment.created_at.asc(), Comment.id.asc())
    )

    comments = list(result.scalars().all())
    return build_tree(comments)


@router.delete("/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_comment(
    comment_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Comment).where(Comment.id == comment_id))
    comment = result.scalar_one_or_none()

    if comment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Comment not found.",
        )

    if comment.author_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete your own comments.",
        )

    # Delete replies first so foreign-key references remain valid.
    replies_result = await db.execute(
        select(Comment).where(Comment.parent_id == comment.id)
    )
    replies = list(replies_result.scalars().all())

    while replies:
        next_level = []
        for reply in replies:
            children_result = await db.execute(
                select(Comment).where(Comment.parent_id == reply.id)
            )
            next_level.extend(children_result.scalars().all())

        for reply in replies:
            await db.delete(reply)

        replies = next_level

    await db.delete(comment)
    await db.commit()
    return None
