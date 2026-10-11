from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
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
    result = await db.execute(
        select(Community, func.count(CommunityMember.id))
        .outerjoin(CommunityMember, CommunityMember.community_id == Community.id)
        .group_by(Community.id)
        .order_by(Community.created_at.desc())
    )
    return [
        {
            **{column.name: getattr(community, column.name) for column in Community.__table__.columns},
            "member_count": member_count,
        }
        for community, member_count in result.all()
    ]

@router.get("/{name}", response_model=CommunityOut)
async def get_community(name: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Community).where(Community.name == name))
    community = result.scalar_one_or_none()
    if not community:
        raise HTTPException(status_code=404, detail="Community not found")
    count_result = await db.execute(
        select(func.count(CommunityMember.id)).where(CommunityMember.community_id == community.id)
    )
    return {**{column.name: getattr(community, column.name) for column in Community.__table__.columns}, "member_count": count_result.scalar_one()}

@router.post("/{community_id}/join")
async def join_community(
    community_id: UUID,
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
        return {"message": "Already a member", "is_member": True}

    member = CommunityMember(community_id=community_id, user_id=current_user.id)
    db.add(member)
    await db.commit()
    return {"message": "Joined successfully", "is_member": True}

@router.post("/{community_id}/leave")
async def leave_community(
    community_id: UUID,
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
    if member.role == "admin":
        raise HTTPException(status_code=400, detail="The community admin cannot leave their own community")
    await db.delete(member)
    await db.commit()
    return {"message": "Left community", "is_member": False}


@router.get("/{community_id}/membership")
async def community_membership(
    community_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Community.id, CommunityMember.role)
        .outerjoin(
            CommunityMember,
            (CommunityMember.community_id == Community.id)
            & (CommunityMember.user_id == current_user.id),
        )
        .where(Community.id == community_id)
    )
    row = result.one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Community not found")
    role = row.role
    return {"is_member": role is not None, "role": role}


@router.get("/{community_id}/members")
async def list_community_members(
    community_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    role_result = await db.execute(
        select(CommunityMember.role).where(
            CommunityMember.community_id == community_id,
            CommunityMember.user_id == current_user.id,
        )
    )
    if role_result.scalar_one_or_none() != "admin":
        raise HTTPException(status_code=403, detail="Only community admins can manage members")
    result = await db.execute(
        select(CommunityMember, User.username)
        .join(User, User.id == CommunityMember.user_id)
        .where(CommunityMember.community_id == community_id)
        .order_by(CommunityMember.joined_at.asc())
    )
    return [
        {
            "user_id": member.user_id,
            "username": username,
            "role": member.role,
            "joined_at": member.joined_at,
        }
        for member, username in result.all()
    ]


@router.patch("/{community_id}/members/{member_user_id}/role")
async def update_member_role(
    community_id: UUID,
    member_user_id: UUID,
    role: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if role not in {"member", "moderator"}:
        raise HTTPException(status_code=422, detail="Role must be 'member' or 'moderator'")
    admin_result = await db.execute(
        select(CommunityMember.id).where(
            CommunityMember.community_id == community_id,
            CommunityMember.user_id == current_user.id,
            CommunityMember.role == "admin",
        )
    )
    if admin_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=403, detail="Only community admins can manage roles")
    target_result = await db.execute(
        select(CommunityMember).where(
            CommunityMember.community_id == community_id,
            CommunityMember.user_id == member_user_id,
        )
    )
    target = target_result.scalar_one_or_none()
    if target is None:
        raise HTTPException(status_code=404, detail="Community member not found")
    if target.role == "admin":
        raise HTTPException(status_code=400, detail="The community admin role cannot be changed")
    target.role = role
    await db.commit()
    return {"message": "Member role updated", "role": role}
