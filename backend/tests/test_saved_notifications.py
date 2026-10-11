from uuid import UUID, uuid4

from httpx import AsyncClient


async def create_user(client: AsyncClient, username: str, email: str) -> dict:
    response = await client.post(
        "/auth/register",
        json={"username": username, "email": email, "password": "password123"},
    )
    assert response.status_code == 200, response.text
    return response.json()


async def token_for(client: AsyncClient, email: str) -> str:
    response = await client.post(
        "/auth/login", json={"email": email, "password": "password123"}
    )
    assert response.status_code == 200, response.text
    return response.json()["access_token"]


async def make_post(client: AsyncClient, username: str, email: str):
    await create_user(client, username, email)
    headers = {"Authorization": f"Bearer {await token_for(client, email)}"}
    suffix = uuid4().hex[:8]
    community = await client.post(
        "/communities/",
        headers=headers,
        json={"name": f"community_{suffix}", "description": "Testing"},
    )
    assert community.status_code == 200, community.text
    post = await client.post(
        f"/posts/{UUID(community.json()['id'])}",
        headers=headers,
        json={"title": "A saved discussion", "content": "Body", "image_url": None},
    )
    assert post.status_code == 200, post.text
    return headers, post.json()


async def test_save_list_and_unsave_post(client: AsyncClient):
    owner_headers, post = await make_post(client, "save_owner", "save_owner@example.com")
    await create_user(client, "save_reader", "save_reader@example.com")
    reader_headers = {"Authorization": f"Bearer {await token_for(client, 'save_reader@example.com')}"}

    saved = await client.put(f"/saved-posts/{post['id']}", headers=reader_headers)
    assert saved.status_code == 201, saved.text

    listing = await client.get("/saved-posts/", headers=reader_headers)
    assert listing.status_code == 200, listing.text
    assert len(listing.json()) == 1
    assert listing.json()[0]["id"] == post["id"]
    assert listing.json()[0]["is_saved"] is True

    removed = await client.delete(f"/saved-posts/{post['id']}", headers=reader_headers)
    assert removed.status_code == 200, removed.text
    listing = await client.get("/saved-posts/", headers=reader_headers)
    assert listing.json() == []


async def test_follow_creates_notification_and_can_mark_read(client: AsyncClient):
    await create_user(client, "notify_actor", "notify_actor@example.com")
    await create_user(client, "notify_target", "notify_target@example.com")
    actor_headers = {"Authorization": f"Bearer {await token_for(client, 'notify_actor@example.com')}"}
    target_headers = {"Authorization": f"Bearer {await token_for(client, 'notify_target@example.com')}"}

    response = await client.post("/users/notify_target/follow", headers=actor_headers)
    assert response.status_code == 200, response.text

    notifications = await client.get("/notifications/", headers=target_headers)
    assert notifications.status_code == 200, notifications.text
    assert len(notifications.json()) == 1
    assert notifications.json()[0]["notification_type"] == "follow"
    assert notifications.json()[0]["is_read"] is False

    mark = await client.patch(
        f"/notifications/{notifications.json()[0]['id']}/read", headers=target_headers
    )
    assert mark.status_code == 200, mark.text
    count = await client.get("/notifications/unread-count", headers=target_headers)
    assert count.status_code == 200
    assert count.json()["count"] == 0


async def test_comment_creates_notification_for_post_owner(client: AsyncClient):
    owner_headers, post = await make_post(client, "comment_owner", "comment_owner@example.com")
    await create_user(client, "comment_actor", "comment_actor@example.com")
    actor_headers = {"Authorization": f"Bearer {await token_for(client, 'comment_actor@example.com')}"}

    comment = await client.post(
        f"/comments/{post['id']}",
        headers=actor_headers,
        json={"content": "A useful comment", "idempotency_key": str(uuid4())},
    )
    assert comment.status_code == 201, comment.text

    notifications = await client.get("/notifications/", headers=owner_headers)
    assert notifications.status_code == 200, notifications.text
    assert len(notifications.json()) == 1
    assert notifications.json()[0]["notification_type"] == "comment"
    assert notifications.json()[0]["post_id"] == post["id"]


async def test_post_owner_can_edit_and_delete_post_with_comments(client: AsyncClient):
    owner_headers, post = await make_post(client, "crud_owner", "crud_owner@example.com")
    edited = await client.patch(
        f"/posts/{post['id']}",
        headers=owner_headers,
        json={"title": "Updated discussion", "content": "Updated body", "image_url": None},
    )
    assert edited.status_code == 200, edited.text
    assert edited.json()["title"] == "Updated discussion"

    comment = await client.post(
        f"/comments/{post['id']}",
        headers=owner_headers,
        json={"content": "A comment to delete with the post", "idempotency_key": str(uuid4())},
    )
    assert comment.status_code == 201, comment.text

    deleted = await client.delete(f"/posts/{post['id']}", headers=owner_headers)
    assert deleted.status_code == 204, deleted.text
    missing = await client.get(f"/posts/{post['id']}", headers=owner_headers)
    assert missing.status_code == 404


async def test_only_author_can_edit_post(client: AsyncClient):
    _, post = await make_post(client, "edit_owner", "edit_owner@example.com")
    await create_user(client, "edit_other", "edit_other@example.com")
    other_headers = {"Authorization": f"Bearer {await token_for(client, 'edit_other@example.com')}"}
    response = await client.patch(
        f"/posts/{post['id']}",
        headers=other_headers,
        json={"title": "Unauthorized edit", "content": "No", "image_url": None},
    )
    assert response.status_code == 403


async def test_comment_owner_can_edit_comment(client: AsyncClient):
    headers, post = await make_post(client, "comment_edit", "comment_edit@example.com")
    comment = await client.post(
        f"/comments/{post['id']}",
        headers=headers,
        json={"content": "Before edit", "idempotency_key": str(uuid4())},
    )
    assert comment.status_code == 201, comment.text
    updated = await client.patch(
        f"/comments/{comment.json()['id']}",
        headers=headers,
        json={"content": "After edit"},
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["content"] == "After edit"


async def test_community_membership_persists_and_counts_members(client: AsyncClient):
    headers, _ = await make_post(client, "member_owner", "member_owner@example.com")
    communities = await client.get("/communities/")
    community = next(item for item in communities.json() if item["name"].startswith("community_"))
    # The creator is automatically an admin member.
    assert community["member_count"] >= 1
    status_before = await client.get(
        f"/communities/{community['id']}/membership", headers=headers
    )
    assert status_before.status_code == 200, status_before.text
    assert status_before.json()["is_member"] is True


async def test_community_admin_can_promote_moderator_and_moderator_can_remove_post(client: AsyncClient):
    admin_headers, post = await make_post(client, "mod_admin", "mod_admin@example.com")
    community_id = post["community_id"]
    await create_user(client, "mod_user", "mod_user@example.com")
    moderator_headers = {"Authorization": f"Bearer {await token_for(client, 'mod_user@example.com')}"}

    joined = await client.post(f"/communities/{community_id}/join", headers=moderator_headers)
    assert joined.status_code == 200, joined.text
    promoted = await client.patch(
        f"/communities/{community_id}/members/{(await client.get('/auth/me', headers=moderator_headers)).json()['id']}/role?role=moderator",
        headers=admin_headers,
    )
    assert promoted.status_code == 200, promoted.text

    removed = await client.delete(f"/posts/{post['id']}", headers=moderator_headers)
    assert removed.status_code == 204, removed.text


async def test_comment_upvote_toggles_and_updates_count(client: AsyncClient):
    headers, post = await make_post(client, "vote_comment", "vote_comment@example.com")
    comment = await client.post(
        f"/comments/{post['id']}",
        headers=headers,
        json={"content": "Vote on this", "idempotency_key": str(uuid4())},
    )
    comment_id = comment.json()["id"]

    first = await client.post(
        "/posts/vote",
        headers=headers,
        json={"target_id": comment_id, "target_type": "comment", "value": 1},
    )
    assert first.status_code == 200, first.text
    assert first.json()["upvotes"] == 1
    assert first.json()["user_vote"] == 1

    second = await client.post(
        "/posts/vote",
        headers=headers,
        json={"target_id": comment_id, "target_type": "comment", "value": 1},
    )
    assert second.status_code == 200, second.text
    assert second.json()["upvotes"] == 0
    assert second.json()["user_vote"] == 0


async def test_public_profile_does_not_expose_email(client: AsyncClient):
    await create_user(client, "privacy_profile", "private@example.com")
    response = await client.get("/users/privacy_profile")
    assert response.status_code == 200, response.text
    assert "email" not in response.json()
