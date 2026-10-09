from uuid import UUID, uuid4

from httpx import AsyncClient


async def create_authenticated_post(client: AsyncClient):
    """Create a user, authenticate, create a community and a post."""
    suffix = uuid4().hex[:8]

    register_res = await client.post(
        "/auth/register",
        json={
            "username": f"user_{suffix}",
            "email": f"{suffix}@example.com",
            "password": "password123",
        },
    )
    assert register_res.status_code == 200, register_res.text

    login_res = await client.post(
        "/auth/login",
        json={
            "email": f"{suffix}@example.com",
            "password": "password123",
        },
    )
    assert login_res.status_code == 200, login_res.text

    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    community_res = await client.post(
        "/communities/",
        headers=headers,
        json={
            "name": f"Community {suffix}",
            "description": "Comment testing community",
        },
    )
    assert community_res.status_code == 200, community_res.text
    community_id = UUID(community_res.json()["id"])

    post_res = await client.post(
        f"/posts/{community_id}",
        headers=headers,
        json={
            "title": "Comment testing post",
            "content": "Post created for automated tests",
            "image_url": None,
        },
    )
    assert post_res.status_code == 200, post_res.text

    return headers, post_res.json()["id"]


async def test_create_comment_success(client: AsyncClient):
    headers, post_id = await create_authenticated_post(client)
    key = str(uuid4())

    res = await client.post(
        f"/comments/{post_id}",
        headers=headers,
        json={
            "content": "This is a test comment",
            "idempotency_key": key,
        },
    )

    assert res.status_code == 201, res.text
    data = res.json()
    assert data["content"] == "This is a test comment"
    assert data["post_id"] == post_id
    assert "id" in data
    assert data["author"] is not None


async def test_same_idempotency_key_does_not_duplicate_comment(
    client: AsyncClient,
):
    headers, post_id = await create_authenticated_post(client)
    key = str(uuid4())
    payload = {
        "content": "Do not create this twice",
        "idempotency_key": key,
    }

    first = await client.post(f"/comments/{post_id}", headers=headers, json=payload)
    second = await client.post(f"/comments/{post_id}", headers=headers, json=payload)

    assert first.status_code == 201, first.text
    assert second.status_code == 201, second.text
    assert first.json()["id"] == second.json()["id"]

    list_res = await client.get(f"/comments/{post_id}")
    assert list_res.status_code == 200, list_res.text

    matching = [
        comment
        for comment in list_res.json()
        if comment["content"] == payload["content"]
    ]
    assert len(matching) == 1


async def test_reusing_idempotency_key_with_different_content_returns_409(
    client: AsyncClient,
):
    headers, post_id = await create_authenticated_post(client)
    key = str(uuid4())

    first = await client.post(
        f"/comments/{post_id}",
        headers=headers,
        json={
            "content": "Original comment",
            "idempotency_key": key,
        },
    )
    assert first.status_code == 201, first.text

    second = await client.post(
        f"/comments/{post_id}",
        headers=headers,
        json={
            "content": "Different comment",
            "idempotency_key": key,
        },
    )

    assert second.status_code == 409, second.text


async def test_empty_comment_is_rejected(client: AsyncClient):
    headers, post_id = await create_authenticated_post(client)

    res = await client.post(
        f"/comments/{post_id}",
        headers=headers,
        json={
            "content": "   ",
            "idempotency_key": str(uuid4()),
        },
    )

    assert res.status_code == 422, res.text


async def test_comment_for_nonexistent_post_returns_404(
    client: AsyncClient,
):
    headers, _ = await create_authenticated_post(client)

    res = await client.post(
        f"/comments/{uuid4()}",
        headers=headers,
        json={
            "content": "Comment on a missing post",
            "idempotency_key": str(uuid4()),
        },
    )

    assert res.status_code == 404, res.text


async def test_create_comment_requires_authentication(
    client: AsyncClient,
):
    res = await client.post(
        f"/comments/{uuid4()}",
        json={
            "content": "Unauthenticated comment",
            "idempotency_key": str(uuid4()),
        },
    )

    assert res.status_code == 401, res.text
