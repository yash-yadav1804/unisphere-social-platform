from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from app.db.session import get_db
from app.models.models import Post, Community
from app.schemas.schemas import PostOut, CommunityOut

router = APIRouter(prefix="/search", tags=["search"])

@router.get("/posts", response_model=list[PostOut])
async def search_posts(q: str = Query(..., min_length=1), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Post).where(
            or_(
                Post.title.ilike(f"%{q}%"),
                Post.content.ilike(f"%{q}%")
            )
        ).order_by(Post.created_at.desc()).limit(20)
    )
    return result.scalars().all()

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
