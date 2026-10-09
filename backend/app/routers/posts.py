from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
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
)
from app.schemas.schemas import PostCreate, PostOut, VoteRequest

router = APIRouter(prefix="/posts", tags=["posts"])


async def attach_user_votes(
    posts: list[Post],
    user_id,
    db: AsyncSession,
) -> list[Post]:
    """Attach each post's current user's vote for response serialization."""
    if not posts:
        return posts

    post_ids = [post.id for post in posts]

    result = await db.execute(
        select(Vote.target_id, Vote.value).where(
            Vote.user_id == user_id,
            Vote.target_type == "post",
            Vote.target_id.in_(post_ids),
        )
    )

    votes_by_post = {target_id: value for target_id, value in result.all()}

    for post in posts:
        post.user_vote = votes_by_post.get(post.id, 0)

    return posts


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

    await db.commit()

    return {
        "message": "Vote recorded",
        "action": action,
        "target_id": str(data.target_id),
        "target_type": data.target_type,
        "user_vote": user_vote,
        "upvotes": target.upvotes if data.target_type == "post" else None,
        "downvotes": target.downvotes if data.target_type == "post" else None,
    }


@router.get("/community/{community_id}", response_model=list[PostOut])
async def get_community_posts(
    community_id: str,
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
    post_id: str,
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


@router.post("/{community_id}", response_model=PostOut)
async def create_post(
    community_id: str,
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
