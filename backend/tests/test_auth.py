from httpx import AsyncClient


async def test_register_success(client: AsyncClient):
    res = await client.post("/auth/register", json={
        "username": "testuser",
        "email": "test@example.com",
        "password": "password123",
    })
    assert res.status_code == 200
    data = res.json()
    assert data["username"] == "testuser"
    assert data["email"] == "test@example.com"
    assert "id" in data
    assert "password_hash" not in data


async def test_register_duplicate_email(client: AsyncClient):
    payload = {"username": "user1", "email": "dupe@example.com", "password": "pass123"}
    await client.post("/auth/register", json=payload)

    res = await client.post("/auth/register", json={**payload, "username": "user2"})
    assert res.status_code == 400
    assert "Email already registered" in res.json()["detail"]


async def test_register_duplicate_username(client: AsyncClient):
    payload = {"username": "samename", "email": "first@example.com", "password": "pass123"}
    await client.post("/auth/register", json=payload)

    res = await client.post("/auth/register", json={**payload, "email": "second@example.com"})
    assert res.status_code == 400
    assert "Username already taken" in res.json()["detail"]


async def test_login_success(client: AsyncClient):
    await client.post("/auth/register", json={
        "username": "loginuser",
        "email": "login@example.com",
        "password": "mypassword",
    })
    res = await client.post("/auth/login", json={
        "email": "login@example.com",
        "password": "mypassword",
    })
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"


async def test_login_wrong_password(client: AsyncClient):
    await client.post("/auth/register", json={
        "username": "wrongpass",
        "email": "wrongpass@example.com",
        "password": "correctpassword",
    })
    res = await client.post("/auth/login", json={
        "email": "wrongpass@example.com",
        "password": "wrongpassword",
    })
    assert res.status_code == 401


async def test_login_nonexistent_user(client: AsyncClient):
    res = await client.post("/auth/login", json={
        "email": "nobody@example.com",
        "password": "anypassword",
    })
    assert res.status_code == 401


async def test_me_endpoint(client: AsyncClient):
    await client.post("/auth/register", json={
        "username": "meuser",
        "email": "me@example.com",
        "password": "password123",
    })
    login_res = await client.post("/auth/login", json={
        "email": "me@example.com",
        "password": "password123",
    })
    token = login_res.json()["access_token"]

    res = await client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    assert res.json()["username"] == "meuser"


async def test_me_requires_auth(client: AsyncClient):
    res = await client.get("/auth/me")
    assert res.status_code == 401
