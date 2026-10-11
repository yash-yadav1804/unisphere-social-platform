from uuid import UUID, uuid4
import os

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Request
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError

from app.core.deps import get_current_user, get_optional_current_user
from app.db.session import get_db
from app.models.models import Comment, Follow, Notification, Post, User
from app.services.post_service import attach_user_votes, attach_public_post_likes
from app.schemas.schemas import (
    CommentOut,
    FollowStatusOut,
    PostOut,
    ProfileOut,
    UserOut,
    PublicUserOut,
    ProfileUpdate,
)

router = APIRouter(prefix="/users", tags=["users"])


async def _find_user(db: AsyncSession, identifier: str) -> User | None:
    """Resolve public usernames case-insensitively, or resolve a UUID for chat links."""
    result = await db.execute(
        select(User).where(func.lower(User.username) == identifier.lower())
    )
    user = result.scalar_one_or_none()
    if user is not None:
        return user
    try:
        user_id = UUID(identifier)
    except ValueError:
        return None
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


@router.get("/{username}", response_model=ProfileOut)
async def get_profile(
    username: str,
    db: AsyncSession = Depends(get_db),
):
    user = await _find_user(db, username)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    followers_result = await db.execute(
        select(func.count()).select_from(Follow).where(Follow.following_id == user.id)
    )
    following_result = await db.execute(
        select(func.count()).select_from(Follow).where(Follow.follower_id == user.id)
    )

    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "avatar_url": user.avatar_url,
        "bio": user.bio,
        "created_at": user.created_at,
        "followers_count": followers_result.scalar_one(),
        "following_count": following_result.scalar_one(),
    }


@router.post("/me/avatar")
async def upload_my_avatar(
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    allowed = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
    if file.content_type not in allowed:
        raise HTTPException(status_code=415, detail="Upload a JPG, PNG, or WEBP image")
    content = await file.read(5 * 1024 * 1024 + 1)
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Image must be 5 MB or smaller")
    upload_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads")
    os.makedirs(upload_dir, exist_ok=True)
    filename = f"avatar-{current_user.id}-{uuid4().hex}{allowed[file.content_type]}"
    with open(os.path.join(upload_dir, filename), "wb") as destination:
        destination.write(content)
    current_user.avatar_url = f"{str(request.base_url).rstrip('/')}/uploads/{filename}"
    await db.commit()
    await db.refresh(current_user)
    return {"avatar_url": current_user.avatar_url}


@router.patch("/me", response_model=ProfileOut)
async def update_my_profile(
    data: ProfileUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if data.username is not None:
        username = data.username.strip()
        if len(username) < 3 or len(username) > 50 or not username.replace("_", "").isalnum():
            raise HTTPException(status_code=422, detail="Username must be 3–50 characters and contain only letters, numbers, or underscores")
        existing = await db.execute(select(User.id).where(func.lower(User.username) == username.lower(), User.id != current_user.id))
        if existing.scalar_one_or_none() is not None:
            raise HTTPException(status_code=409, detail="Username is already taken")
        current_user.username = username
    if data.bio is not None:
        if len(data.bio) > 300:
            raise HTTPException(status_code=422, detail="Bio must be 300 characters or fewer")
        current_user.bio = data.bio.strip() or None
    if data.avatar_url is not None:
        current_user.avatar_url = data.avatar_url.strip() or None
    await db.commit()
    await db.refresh(current_user)
    followers = await db.scalar(select(func.count()).select_from(Follow).where(Follow.following_id == current_user.id)) or 0
    following = await db.scalar(select(func.count()).select_from(Follow).where(Follow.follower_id == current_user.id)) or 0
    return {"id": current_user.id, "username": current_user.username, "avatar_url": current_user.avatar_url, "bio": current_user.bio, "created_at": current_user.created_at, "followers_count": followers, "following_count": following}


@router.get("/{username}/followers", response_model=list[PublicUserOut])
async def list_followers(username: str, db: AsyncSession = Depends(get_db)):
    target = await _find_user(db, username)
    if target is None:
        raise HTTPException(status_code=404, detail="User not found")
    result = await db.execute(select(User).join(Follow, Follow.follower_id == User.id).where(Follow.following_id == target.id).order_by(User.username.asc()))
    return result.scalars().all()


@router.get("/{username}/following", response_model=list[PublicUserOut])
async def list_following(username: str, db: AsyncSession = Depends(get_db)):
    target = await _find_user(db, username)
    if target is None:
        raise HTTPException(status_code=404, detail="User not found")
    result = await db.execute(select(User).join(Follow, Follow.following_id == User.id).where(Follow.follower_id == target.id).order_by(User.username.asc()))
    return result.scalars().all()


@router.get("/{username}/posts", response_model=list[PostOut])
async def user_posts(
    username: str,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_optional_current_user),
):
    user = await _find_user(db, username)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    posts_result = await db.execute(
        select(Post).where(Post.author_id == user.id).options(selectinload(Post.author)).order_by(Post.created_at.desc())
    )
    posts = list(posts_result.scalars().all())
    if current_user is not None:
        return await attach_user_votes(posts, current_user.id, db)
    for post in posts:
        post.user_vote = 0
        post.is_saved = False
    return await attach_public_post_likes(posts, db)


@router.get("/{username}/comments", response_model=list[CommentOut])
async def user_comments(
    username: str,
    db: AsyncSession = Depends(get_db),
):
    user = await _find_user(db, username)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    comments_result = await db.execute(
        select(Comment)
        .where(Comment.author_id == user.id)
        .order_by(Comment.created_at.desc())
    )
    return comments_result.scalars().all()


@router.get(
    "/{username}/follow-status",
    response_model=FollowStatusOut,
)
async def get_follow_status(
    username: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    target_user = await _find_user(db, username)
    target_id = target_user.id if target_user is not None else None

    if target_id is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    result = await db.execute(
        select(Follow.id).where(
            Follow.follower_id == current_user.id,
            Follow.following_id == target_id,
        )
    )

    return {"is_following": result.scalar_one_or_none() is not None}


@router.post(
    "/{username}/follow",
    status_code=status.HTTP_200_OK,
)
async def follow_user(
    username: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    target_result = await db.execute(select(User).where(User.username == username))
    target_user = target_result.scalar_one_or_none()

    if target_user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    if target_user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot follow yourself",
        )

    existing_result = await db.execute(
        select(Follow).where(
            Follow.follower_id == current_user.id,
            Follow.following_id == target_user.id,
        )
    )
    existing_follow = existing_result.scalar_one_or_none()

    if existing_follow is not None:
        return {"message": "Already following this user"}
    db.add(
        Follow(
            follower_id=current_user.id,
            following_id=target_user.id,
        )
    )

    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()

        existing_result = await db.execute(
            select(Follow.id).where(
                Follow.follower_id == current_user.id,
                Follow.following_id == target_user.id,
            )
        )

        if existing_result.scalar_one_or_none() is not None:
            return {"message": "Already following this user"}

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Could not create follow relationship",
        )

    db.add(
        Notification(
            recipient_id=target_user.id,
            actor_id=current_user.id,
            notification_type="follow",
            message=f"{current_user.username} started following you",
        )
    )
    await db.commit()
    return {"message": "User followed successfully"}


@router.delete(
    "/{username}/follow",
    status_code=status.HTTP_200_OK,
)
async def unfollow_user(
    username: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    target_result = await db.execute(select(User.id).where(User.username == username))
    target_id = target_result.scalar_one_or_none()

    if target_id is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    result = await db.execute(
        select(Follow).where(
            Follow.follower_id == current_user.id,
            Follow.following_id == target_id,
        )
    )
    follow = result.scalar_one_or_none()

    if follow is not None:
        await db.delete(follow)
        await db.commit()

    return {"message": "User unfollowed successfully"}
