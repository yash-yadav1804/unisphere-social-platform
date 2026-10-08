from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.db.session import get_db
from app.models.models import Community, CommunityMember, User
from app.schemas.schemas import CommunityCreate, CommunityOut
from app.core.deps import get_current_user

router = APIRouter(prefix="/communities", tags=["communities"])

@router.post("/", response_model=CommunityOut)
async def create_community(
    data: CommunityCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Community).where(Community.name == data.name))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Community name already taken")

    community = Community(name=data.name, description=data.description, created_by=current_user.id)
    db.add(community)
    await db.flush()

    member = CommunityMember(community_id=community.id, user_id=current_user.id, role="admin")
    db.add(member)
    await db.commit()
    await db.refresh(community)
    return community

@router.get("/", response_model=list[CommunityOut])
async def list_communities(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Community).order_by(Community.created_at.desc()))
    return result.scalars().all()

@router.get("/{name}", response_model=CommunityOut)
async def get_community(name: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Community).where(Community.name == name))
    community = result.scalar_one_or_none()
    if not community:
        raise HTTPException(status_code=404, detail="Community not found")
    return community

@router.post("/{community_id}/join")
async def join_community(
    community_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(CommunityMember).where(
            CommunityMember.community_id == community_id,
            CommunityMember.user_id == current_user.id
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Already a member")

    member = CommunityMember(community_id=community_id, user_id=current_user.id)
    db.add(member)
    await db.commit()
    return {"message": "Joined successfully"}

@router.post("/{community_id}/leave")
async def leave_community(
    community_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(CommunityMember).where(
            CommunityMember.community_id == community_id,
            CommunityMember.user_id == current_user.id
        )
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Not a member")
    await db.delete(member)
    await db.commit()
    return {"message": "Left community"}
