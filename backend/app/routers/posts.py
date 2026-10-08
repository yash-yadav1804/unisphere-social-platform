from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.db.session import get_db
from app.models.models import Post, Community, Vote, User
from app.schemas.schemas import PostCreate, PostOut, VoteRequest
from app.core.deps import get_current_user

router = APIRouter(prefix="/posts", tags=["posts"])

@router.post("/{community_id}", response_model=PostOut)
async def create_post(
    community_id: str,
    data: PostCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Community).where(Community.id == community_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Community not found")

    post = Post(
        community_id=community_id,
        author_id=current_user.id,
        title=data.title,
        content=data.content,
        image_url=data.image_url
    )
    db.add(post)
    await db.commit()
    await db.refresh(post)
    return post

@router.get("/community/{community_id}", response_model=list[PostOut])
async def get_community_posts(
    community_id: str,
    sort: str = "new",
    db: AsyncSession = Depends(get_db)
):
    query = select(Post).where(Post.community_id == community_id).options(selectinload(Post.author))
    if sort == "top":
        query = query.order_by(Post.upvotes.desc())
    else:
        query = query.order_by(Post.created_at.desc())
    result = await db.execute(query)
    return result.scalars().all()

@router.get("/feed", response_model=list[PostOut])
async def home_feed(
    sort: str = "new",
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.models.models import CommunityMember
    memberships = await db.execute(
        select(CommunityMember.community_id).where(CommunityMember.user_id == current_user.id)
    )
    community_ids = [r[0] for r in memberships.all()]

    query = select(Post).where(Post.community_id.in_(community_ids)).options(selectinload(Post.author))
    if sort == "top":
        query = query.order_by(Post.upvotes.desc())
    else:
        query = query.order_by(Post.created_at.desc())
    result = await db.execute(query)
    return result.scalars().all()

@router.get("/{post_id}", response_model=PostOut)
async def get_post(post_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Post).where(Post.id == post_id).options(selectinload(Post.author))
    )
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return post

@router.post("/vote")
async def vote(
    data: VoteRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(Vote).where(
            Vote.user_id == current_user.id,
            Vote.target_id == data.target_id,
            Vote.target_type == data.target_type
        )
    )
    existing = result.scalar_one_or_none()

    if existing:
        if existing.value == data.value:
            await db.delete(existing)
        else:
            existing.value = data.value
    else:
        vote = Vote(
            user_id=current_user.id,
            target_id=data.target_id,
            target_type=data.target_type,
            value=data.value
        )
        db.add(vote)

    if data.target_type == "post":
        post_result = await db.execute(select(Post).where(Post.id == data.target_id))
        post = post_result.scalar_one_or_none()
        if post:
            votes_result = await db.execute(
                select(Vote).where(Vote.target_id == data.target_id, Vote.target_type == "post")
            )
            all_votes = votes_result.scalars().all()
            post.upvotes = sum(1 for v in all_votes if v.value == 1)
            post.downvotes = sum(1 for v in all_votes if v.value == -1)

    await db.commit()
    return {"message": "Vote recorded"}
