from httpx import AsyncClient


async def _register(client: AsyncClient, username: str, email: str) -> dict:
    response = await client.post(
        "/auth/register",
        json={"username": username, "email": email, "password": "password123"},
    )
    assert response.status_code == 200, response.text
    return response.json()


async def test_profile_can_be_loaded_by_username_and_user_id(client: AsyncClient):
    user = await _register(client, "ProfileTester", "profiletester@example.com")

    by_username = await client.get("/users/profiletester")
    by_id = await client.get(f"/users/{user['id']}")

    assert by_username.status_code == 200, by_username.text
    assert by_id.status_code == 200, by_id.text
    assert by_username.json()["id"] == by_id.json()["id"]
    assert "email" not in by_username.json()


async def test_search_users_finds_username_case_insensitively(client: AsyncClient):
    await _register(client, "AmanYadav", "aman.yadav@example.com")

    response = await client.get("/search/users", params={"q": "aman yAd"})

    assert response.status_code == 200, response.text
    assert any(user["username"] == "AmanYadav" for user in response.json())
    assert all("email" not in user for user in response.json())
