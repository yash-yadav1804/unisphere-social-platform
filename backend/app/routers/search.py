from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func
from sqlalchemy.orm import selectinload
from app.db.session import get_db
from app.models.models import Post, Community, User
from app.schemas.schemas import PostOut, CommunityOut, PublicUserOut
from app.core.deps import get_optional_current_user
from app.services.post_service import attach_user_votes, attach_public_post_likes

router = APIRouter(prefix="/search", tags=["search"])

@router.get("/posts", response_model=list[PostOut])
async def search_posts(
    q: str = Query(..., min_length=1),
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_optional_current_user),
):
    result = await db.execute(
        select(Post).where(
            or_(
                Post.title.ilike(f"%{q}%"),
                Post.content.ilike(f"%{q}%")
            )
        ).options(selectinload(Post.author)).order_by(Post.created_at.desc()).limit(20)
    )
    posts = list(result.scalars().all())
    if current_user is not None:
        return await attach_user_votes(posts, current_user.id, db)
    for post in posts:
        post.user_vote = 0
        post.is_saved = False
    return await attach_public_post_likes(posts, db)

@router.get("/communities", response_model=list[CommunityOut])
async def search_communities(q: str = Query(..., min_length=1), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Community).where(
            or_(
                Community.name.ilike(f"%{q}%"),
                Community.description.ilike(f"%{q}%")
            )
        ).order_by(Community.created_at.desc()).limit(20)
    )
    return result.scalars().all()


@router.get("/users", response_model=list[PublicUserOut])
async def search_users(
    q: str = Query(..., min_length=1),
    db: AsyncSession = Depends(get_db),
):
    """Search people by username, ignoring case and whitespace."""
    normalized_query = "".join(q.split()).casefold()

    if not normalized_query:
        return []

    normalized_username = func.replace(
        func.lower(User.username),
        " ",
        "",
    )

    result = await db.execute(
        select(User)
        .where(normalized_username.ilike(f"%{normalized_query}%"))
        .order_by(User.username.asc())
        .limit(20)
    )
    return result.scalars().all()
