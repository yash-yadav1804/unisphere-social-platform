"""Shared post response enrichment used by feed, search and saved-post routes."""

from uuid import UUID

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import Post, PostLike, SavedPost, Vote


async def attach_user_votes(
    posts: list[Post], user_id: UUID, db: AsyncSession
) -> list[Post]:
    if not posts:
        return posts

    post_ids = [post.id for post in posts]
    votes_result = await db.execute(
        select(Vote.target_id, Vote.value).where(
            Vote.user_id == user_id,
            Vote.target_type == "post",
            Vote.target_id.in_(post_ids),
        )
    )
    votes_by_post = {target_id: value for target_id, value in votes_result.all()}

    saved_result = await db.execute(
        select(SavedPost.post_id).where(
            SavedPost.user_id == user_id, SavedPost.post_id.in_(post_ids)
        )
    )
    saved_post_ids = set(saved_result.scalars().all())

    likes_result = await db.execute(select(PostLike.post_id).where(PostLike.user_id == user_id, PostLike.post_id.in_(post_ids)))
    liked_ids = set(likes_result.scalars().all())
    counts_result = await db.execute(select(PostLike.post_id, func.count(PostLike.id)).where(PostLike.post_id.in_(post_ids)).group_by(PostLike.post_id))
    like_counts = dict(counts_result.all())
    for post in posts:
        post.user_vote = votes_by_post.get(post.id, 0)
        post.is_saved = post.id in saved_post_ids
        post.liked_by_me = post.id in liked_ids
        post.likes_count = like_counts.get(post.id, 0)
    return posts


async def attach_public_post_likes(posts: list[Post], db: AsyncSession) -> list[Post]:
    """Attach public like totals without requiring the viewer to be authenticated."""
    if not posts:
        return posts
    post_ids = [post.id for post in posts]
    counts_result = await db.execute(
        select(PostLike.post_id, func.count(PostLike.id))
        .where(PostLike.post_id.in_(post_ids))
        .group_by(PostLike.post_id)
    )
    counts = dict(counts_result.all())
    for post in posts:
        post.likes_count = counts.get(post.id, 0)
        post.liked_by_me = False
    return posts
