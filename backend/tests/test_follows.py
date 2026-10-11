from httpx import AsyncClient


async def create_user(
    client: AsyncClient,
    username: str,
    email: str,
) -> dict:
    response = await client.post(
        "/auth/register",
        json={
            "username": username,
            "email": email,
            "password": "password123",
        },
    )
    assert response.status_code == 200, response.text
    return response.json()


async def get_token(client: AsyncClient, email: str) -> str:
    response = await client.post(
        "/auth/login",
        json={
            "email": email,
            "password": "password123",
        },
    )
    assert response.status_code == 200, response.text
    return response.json()["access_token"]


async def test_follow_user_and_check_status(client: AsyncClient):
    await create_user(client, "follower1", "follower1@example.com")
    await create_user(client, "target1", "target1@example.com")
    token = await get_token(client, "follower1@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    response = await client.post("/users/target1/follow", headers=headers)
    assert response.status_code == 200, response.text

    status_response = await client.get(
        "/users/target1/follow-status",
        headers=headers,
    )
    assert status_response.status_code == 200
    assert status_response.json()["is_following"] is True


async def test_duplicate_follow_does_not_increase_count(
    client: AsyncClient,
):
    await create_user(client, "follower2", "follower2@example.com")
    await create_user(client, "target2", "target2@example.com")
    token = await get_token(client, "follower2@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    first = await client.post("/users/target2/follow", headers=headers)
    second = await client.post("/users/target2/follow", headers=headers)

    assert first.status_code == 200, first.text
    assert second.status_code == 200, second.text

    profile = await client.get("/users/target2")
    assert profile.status_code == 200, profile.text
    assert profile.json()["followers_count"] == 1


async def test_unfollow_user(client: AsyncClient):
    await create_user(client, "follower3", "follower3@example.com")
    await create_user(client, "target3", "target3@example.com")
    token = await get_token(client, "follower3@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    follow = await client.post("/users/target3/follow", headers=headers)
    assert follow.status_code == 200, follow.text

    unfollow = await client.delete("/users/target3/follow", headers=headers)
    assert unfollow.status_code == 200, unfollow.text

    status_response = await client.get(
        "/users/target3/follow-status",
        headers=headers,
    )
    assert status_response.status_code == 200
    assert status_response.json()["is_following"] is False

    profile = await client.get("/users/target3")
    assert profile.status_code == 200, profile.text
    assert profile.json()["followers_count"] == 0


async def test_cannot_follow_yourself(client: AsyncClient):
    await create_user(client, "selfuser", "selfuser@example.com")
    token = await get_token(client, "selfuser@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    response = await client.post("/users/selfuser/follow", headers=headers)
    assert response.status_code == 400


async def test_follow_nonexistent_user_returns_404(
    client: AsyncClient,
):
    await create_user(client, "follower4", "follower4@example.com")
    token = await get_token(client, "follower4@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    response = await client.post(
        "/users/username_does_not_exist/follow",
        headers=headers,
    )
    assert response.status_code == 404


async def test_follow_requires_authentication(client: AsyncClient):
    response = await client.post("/users/target_missing_auth/follow")
    assert response.status_code == 401

    status_response = await client.get("/users/target_missing_auth/follow-status")
    assert status_response.status_code == 401
