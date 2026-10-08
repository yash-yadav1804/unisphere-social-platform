from httpx import AsyncClient


async def _register_and_login(client: AsyncClient, username: str, email: str) -> str:
    await client.post("/auth/register", json={
        "username": username,
        "email": email,
        "password": "password123",
    })
    res = await client.post("/auth/login", json={"email": email, "password": "password123"})
    return res.json()["access_token"]


async def test_conversations_empty(client: AsyncClient):
    token = await _register_and_login(client, "convuser1", "convuser1@example.com")
    res = await client.get(
        "/messages/conversations",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    assert res.json() == []


async def test_conversations_requires_auth(client: AsyncClient):
    res = await client.get("/messages/conversations")
    assert res.status_code == 401


async def test_message_history_empty(client: AsyncClient):
    token = await _register_and_login(client, "histuser1", "histuser1@example.com")
    other_res = await client.post("/auth/register", json={
        "username": "histuser2",
        "email": "histuser2@example.com",
        "password": "password123",
    })
    other_id = other_res.json()["id"]

    res = await client.get(
        f"/messages/history/{other_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    assert res.json() == []


async def test_message_history_requires_auth(client: AsyncClient):
    other_res = await client.post("/auth/register", json={
        "username": "authcheck",
        "email": "authcheck@example.com",
        "password": "password123",
    })
    other_id = other_res.json()["id"]

    res = await client.get(f"/messages/history/{other_id}")
    assert res.status_code == 401
