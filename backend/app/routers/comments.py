from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_current_user, get_optional_current_user
from app.db.session import get_db
from app.models.models import Comment, CommunityMember, Notification, Post, User, Vote
from app.schemas.schemas import CommentCreate, CommentOut, CommentUpdate

router = APIRouter(prefix="/comments", tags=["comments"])


def serialize_comment_response(comment: Comment) -> dict:
    """Serialize a comment without triggering async lazy-loading."""
    return {
        "id": comment.id,
        "post_id": comment.post_id,
        "author_id": comment.author_id,
        "parent_id": comment.parent_id,
        "content": comment.content,
        "upvotes": comment.upvotes,
        "created_at": comment.created_at,
        "author": comment.author,
        "replies": [],
    }


def build_tree(comments: list[Comment], user_votes: dict[UUID, int] | None = None) -> list[dict]:
    """Serialize comments into a nested tree without async lazy-loading."""
    user_votes = user_votes or {}
    children: dict[UUID | None, list[Comment]] = {}

    for comment in comments:
        children.setdefault(comment.parent_id, []).append(comment)

    def serialize(comment: Comment) -> dict:
        return {
            "id": comment.id,
            "post_id": comment.post_id,
            "author_id": comment.author_id,
            "parent_id": comment.parent_id,
            "content": comment.content,
            "upvotes": comment.upvotes,
            "created_at": comment.created_at,
            "author": comment.author,
            "user_vote": user_votes.get(comment.id, 0),
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
            select(Comment.id).where(
                Comment.id == data.parent_id,
                Comment.post_id == post_id,
            )
        )
        if parent_result.scalar_one_or_none() is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Parent comment does not belong to this post.",
            )

    async def find_existing_comment():
        result = await db.execute(
            select(Comment)
            .where(
                Comment.author_id == current_user.id,
                Comment.idempotency_key == data.idempotency_key,
            )
            .options(selectinload(Comment.author))
        )
        return result.scalar_one_or_none()

    def validate_existing_comment(existing: Comment) -> None:
        if (
            existing.post_id != post_id
            or existing.parent_id != data.parent_id
            or existing.content != content
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Idempotency key was already used for another comment.",
            )

    # Return the existing comment when this request was already processed.
    existing = await find_existing_comment()

    if existing is not None:
        validate_existing_comment(existing)
        return serialize_comment_response(existing)

    comment = Comment(
        post_id=post_id,
        author_id=current_user.id,
        content=content,
        parent_id=data.parent_id,
        idempotency_key=data.idempotency_key,
    )

    db.add(comment)

    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()

        # A concurrent request may have inserted the same idempotency key.
        existing = await find_existing_comment()

        if existing is None:
            raise

        validate_existing_comment(existing)
        return serialize_comment_response(existing)

    # Notify the post author and, for replies, the parent comment author.
    post_owner_result = await db.execute(select(Post.author_id).where(Post.id == post_id))
    recipients = {post_owner_result.scalar_one()}
    if data.parent_id is not None:
        parent_owner_result = await db.execute(
            select(Comment.author_id).where(Comment.id == data.parent_id)
        )
        parent_owner = parent_owner_result.scalar_one_or_none()
        if parent_owner is not None:
            recipients.add(parent_owner)
    recipients.discard(current_user.id)
    for recipient_id in recipients:
        db.add(
            Notification(
                recipient_id=recipient_id,
                actor_id=current_user.id,
                notification_type="reply" if data.parent_id else "comment",
                post_id=post_id,
                comment_id=comment.id,
                message=(
                    f"{current_user.username} replied to a comment"
                    if data.parent_id
                    else f"{current_user.username} commented on your post"
                ),
            )
        )
    if recipients:
        await db.commit()

    # Reload the author explicitly; do not return a lazy ORM relationship.
    result = await db.execute(
        select(Comment)
        .where(Comment.id == comment.id)
        .options(selectinload(Comment.author))
    )
    created_comment = result.scalar_one()

    return serialize_comment_response(created_comment)


@router.get("/{post_id}", response_model=list[CommentOut])
async def get_comments(
    post_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_optional_current_user),
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
    user_votes: dict[UUID, int] = {}
    if current_user is not None and comments:
        vote_result = await db.execute(
            select(Vote.target_id, Vote.value).where(
                Vote.user_id == current_user.id,
                Vote.target_type == "comment",
                Vote.target_id.in_([comment.id for comment in comments]),
            )
        )
        user_votes = {target_id: value for target_id, value in vote_result.all()}
    return build_tree(comments, user_votes)


@router.patch("/{comment_id}", response_model=CommentOut)
async def update_comment(
    comment_id: UUID,
    data: CommentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    content = data.content.strip()
    if not content or len(content) > 5000:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Comment content must be between 1 and 5000 characters.",
        )
    result = await db.execute(
        select(Comment).where(Comment.id == comment_id).options(selectinload(Comment.author))
    )
    comment = result.scalar_one_or_none()
    if comment is None:
        raise HTTPException(status_code=404, detail="Comment not found.")
    if comment.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only edit your own comments.")
    comment.content = content
    await db.commit()
    refreshed = await db.execute(
        select(Comment).where(Comment.id == comment_id).options(selectinload(Comment.author))
    )
    return serialize_comment_response(refreshed.scalar_one())


@router.delete(
    "/{comment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
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
        community_result = await db.execute(
            select(Post.community_id).where(Post.id == comment.post_id)
        )
        community_id = community_result.scalar_one_or_none()
        role_result = await db.execute(
            select(CommunityMember.role).where(
                CommunityMember.community_id == community_id,
                CommunityMember.user_id == current_user.id,
            )
        )
        if role_result.scalar_one_or_none() not in {"admin", "moderator"}:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only delete your own comments unless you moderate this community.",
            )

    # Gather the subtree, then remove dependent rows and delete leaves first.
    subtree = {comment.id: comment}
    frontier = [comment.id]
    while frontier:
        child_result = await db.execute(
            select(Comment).where(Comment.parent_id.in_(frontier))
        )
        children = list(child_result.scalars().all())
        frontier = [child.id for child in children]
        subtree.update({child.id: child for child in children})

    subtree_ids = list(subtree)
    await db.execute(delete(Notification).where(Notification.comment_id.in_(subtree_ids)))
    await db.execute(delete(Vote).where(Vote.target_id.in_(subtree_ids), Vote.target_type == "comment"))
    remaining_ids = set(subtree_ids)
    while remaining_ids:
        parent_ids = {
            subtree[item].parent_id
            for item in remaining_ids
            if subtree[item].parent_id in remaining_ids
        }
        leaf_ids = remaining_ids - parent_ids
        if not leaf_ids:
            raise HTTPException(status_code=409, detail="Comment tree contains an invalid cycle")
        await db.execute(delete(Comment).where(Comment.id.in_(leaf_ids)))
        remaining_ids.difference_update(leaf_ids)
    await db.commit()

    return None
