from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.models import (
    Comment,
    Community,
    CommunityMember,
    Post,
    User,
    Vote,
    SavedPost,
    Notification,
    PostLike,
)
from app.schemas.schemas import PostCreate, PostOut, PostUpdate, VoteRequest
from app.services.post_service import attach_user_votes

router = APIRouter(prefix="/posts", tags=["posts"])


async def update_post_vote_counts(
    post: Post,
    db: AsyncSession,
) -> None:
    """Recalculate the post's vote totals from vote records."""
    result = await db.execute(
        select(Vote.value).where(
            Vote.target_id == post.id,
            Vote.target_type == "post",
        )
    )
    values = result.scalars().all()

    post.upvotes = sum(1 for value in values if value == 1)
    post.downvotes = sum(1 for value in values if value == -1)


@router.post("/vote")
async def vote(
    data: VoteRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if data.target_type not in {"post", "comment"}:
        raise HTTPException(
            status_code=422,
            detail="target_type must be 'post' or 'comment'",
        )

    if data.value not in {-1, 1}:
        raise HTTPException(
            status_code=422,
            detail="value must be 1 or -1",
        )

    if data.target_type == "post":
        result = await db.execute(select(Post).where(Post.id == data.target_id))
    else:
        result = await db.execute(select(Comment).where(Comment.id == data.target_id))

    target = result.scalar_one_or_none()

    if target is None:
        raise HTTPException(status_code=404, detail="Target not found")

    existing_result = await db.execute(
        select(Vote).where(
            Vote.user_id == current_user.id,
            Vote.target_id == data.target_id,
            Vote.target_type == data.target_type,
        )
    )
    existing = existing_result.scalar_one_or_none()

    if existing:
        if existing.value == data.value:
            await db.delete(existing)
            action = "removed"
            user_vote = 0
        else:
            existing.value = data.value
            action = "updated"
            user_vote = data.value
    else:
        db.add(
            Vote(
                user_id=current_user.id,
                target_id=data.target_id,
                target_type=data.target_type,
                value=data.value,
            )
        )
        action = "created"
        user_vote = data.value

    await db.flush()

    if data.target_type == "post":
        await update_post_vote_counts(target, db)
    else:
        comment_votes_result = await db.execute(
            select(Vote.value).where(
                Vote.target_id == target.id, Vote.target_type == "comment"
            )
        )
        target.upvotes = sum(1 for vote_value in comment_votes_result.scalars().all() if vote_value == 1)

    await db.commit()

    return {
        "message": "Vote recorded",
        "action": action,
        "target_id": str(data.target_id),
        "target_type": data.target_type,
        "user_vote": user_vote,
        "upvotes": target.upvotes,
        "downvotes": target.downvotes if data.target_type == "post" else None,
    }


@router.post("/{post_id}/like")
async def toggle_post_like(
    post_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    post_result = await db.execute(select(Post.id).where(Post.id == post_id))
    if post_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Post not found")
    existing_result = await db.execute(select(PostLike).where(PostLike.post_id == post_id, PostLike.user_id == current_user.id))
    existing = existing_result.scalar_one_or_none()
    if existing:
        await db.delete(existing)
        liked = False
    else:
        db.add(PostLike(post_id=post_id, user_id=current_user.id))
        liked = True
    await db.flush()
    count_result = await db.execute(select(func.count(PostLike.id)).where(PostLike.post_id == post_id))
    count = count_result.scalar_one()
    await db.commit()
    return {"liked_by_me": liked, "likes_count": count}


@router.get("/community/{community_id}", response_model=list[PostOut])
async def get_community_posts(
    community_id: UUID,
    sort: str = "new",
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if sort not in {"new", "top"}:
        raise HTTPException(
            status_code=422,
            detail="sort must be 'new' or 'top'",
        )

    community_result = await db.execute(
        select(Community).where(Community.id == community_id)
    )

    if community_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Community not found")

    query = (
        select(Post)
        .where(Post.community_id == community_id)
        .options(selectinload(Post.author))
    )

    if sort == "top":
        query = query.order_by(Post.upvotes.desc(), Post.created_at.desc())
    else:
        query = query.order_by(Post.created_at.desc())

    result = await db.execute(query)
    posts = result.scalars().all()

    return await attach_user_votes(posts, current_user.id, db)


@router.get("/feed", response_model=list[PostOut])
async def home_feed(
    sort: str = "new",
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if sort not in {"new", "top"}:
        raise HTTPException(
            status_code=422,
            detail="sort must be 'new' or 'top'",
        )

    memberships_result = await db.execute(
        select(CommunityMember.community_id).where(
            CommunityMember.user_id == current_user.id
        )
    )
    community_ids = memberships_result.scalars().all()

    if not community_ids:
        return []

    query = (
        select(Post)
        .where(Post.community_id.in_(community_ids))
        .options(selectinload(Post.author))
    )

    if sort == "top":
        query = query.order_by(Post.upvotes.desc(), Post.created_at.desc())
    else:
        query = query.order_by(Post.created_at.desc())

    result = await db.execute(query)
    posts = result.scalars().all()

    return await attach_user_votes(posts, current_user.id, db)


@router.get("/{post_id}", response_model=PostOut)
async def get_post(
    post_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Post).where(Post.id == post_id).options(selectinload(Post.author))
    )
    post = result.scalar_one_or_none()

    if post is None:
        raise HTTPException(status_code=404, detail="Post not found")

    await attach_user_votes([post], current_user.id, db)
    return post


@router.patch("/{post_id}", response_model=PostOut)
async def update_post(
    post_id: UUID,
    data: PostUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Post).where(Post.id == post_id))
    post = result.scalar_one_or_none()
    if post is None:
        raise HTTPException(status_code=404, detail="Post not found")

    membership_result = await db.execute(
        select(CommunityMember.role).where(
            CommunityMember.community_id == post.community_id,
            CommunityMember.user_id == current_user.id,
        )
    )
    role = membership_result.scalar_one_or_none()
    if post.author_id != current_user.id and role not in {"admin", "moderator"}:
        raise HTTPException(status_code=403, detail="You cannot edit this post")

    title = data.title.strip()
    if not title or len(title) > 300:
        raise HTTPException(status_code=422, detail="Title must be between 1 and 300 characters")
    post.title = title
    post.content = data.content.strip() if data.content else None
    post.image_url = data.image_url
    await db.commit()

    refreshed = await db.execute(
        select(Post).where(Post.id == post_id).options(selectinload(Post.author))
    )
    updated = refreshed.scalar_one()
    await attach_user_votes([updated], current_user.id, db)
    return updated


@router.delete("/{post_id}", status_code=204)
async def delete_post(
    post_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Post).where(Post.id == post_id))
    post = result.scalar_one_or_none()
    if post is None:
        raise HTTPException(status_code=404, detail="Post not found")

    membership_result = await db.execute(
        select(CommunityMember.role).where(
            CommunityMember.community_id == post.community_id,
            CommunityMember.user_id == current_user.id,
        )
    )
    role = membership_result.scalar_one_or_none()
    if post.author_id != current_user.id and role not in {"admin", "moderator"}:
        raise HTTPException(status_code=403, detail="You cannot delete this post")

    comment_result = await db.execute(select(Comment).where(Comment.post_id == post_id))
    remaining_comments = {comment.id: comment for comment in comment_result.scalars().all()}
    comment_ids = list(remaining_comments)
    if comment_ids:
        await db.execute(delete(Notification).where(Notification.comment_id.in_(comment_ids)))
        await db.execute(delete(Vote).where(Vote.target_id.in_(comment_ids), Vote.target_type == "comment"))
        # Delete leaf comments first so the self-referencing parent FK stays valid.
        while remaining_comments:
            parent_ids = {comment.parent_id for comment in remaining_comments.values() if comment.parent_id is not None}
            leaf_ids = [comment_id for comment_id in remaining_comments if comment_id not in parent_ids]
            if not leaf_ids:
                raise HTTPException(status_code=409, detail="Comment tree contains an invalid cycle")
            await db.execute(delete(Comment).where(Comment.id.in_(leaf_ids)))
            for comment_id in leaf_ids:
                remaining_comments.pop(comment_id, None)
    await db.execute(delete(Vote).where(Vote.target_id == post_id, Vote.target_type == "post"))
    await db.execute(delete(SavedPost).where(SavedPost.post_id == post_id))
    await db.delete(post)
    await db.commit()


@router.post("/{community_id}", response_model=PostOut)
async def create_post(
    community_id: UUID,
    data: PostCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    community_result = await db.execute(
        select(Community).where(Community.id == community_id)
    )
    community = community_result.scalar_one_or_none()

    if community is None:
        raise HTTPException(status_code=404, detail="Community not found")

    post = Post(
        community_id=community.id,
        author_id=current_user.id,
        title=data.title,
        content=data.content,
        image_url=data.image_url,
    )

    db.add(post)
    await db.commit()

    result = await db.execute(
        select(Post).where(Post.id == post.id).options(selectinload(Post.author))
    )
    created_post = result.scalar_one()
    created_post.user_vote = 0

    return created_post
