from httpx import AsyncClient


async def _register(client: AsyncClient, username: str) -> dict:
    response = await client.post('/auth/register', json={
        'username': username,
        'email': f'{username}@example.com',
        'password': 'password123',
    })
    assert response.status_code == 200, response.text
    return response.json()


async def _token(client: AsyncClient, username: str) -> str:
    response = await client.post('/auth/login', json={
        'email': f'{username}@example.com', 'password': 'password123'
    })
    assert response.status_code == 200, response.text
    return response.json()['access_token']


async def test_like_and_unlike_post_without_changing_votes(client: AsyncClient):
    await _register(client, 'liker')
    token = await _token(client, 'liker')
    headers = {'Authorization': f'Bearer {token}'}
    community = await client.post('/communities/', headers=headers, json={
        'name': 'likes_space', 'description': 'Like test'
    })
    assert community.status_code == 200, community.text
    post = await client.post(f"/posts/{community.json()['id']}", headers=headers, json={
        'title': 'Like me', 'content': 'Independent likes'
    })
    assert post.status_code == 200, post.text
    post_id = post.json()['id']

    liked = await client.post(f'/posts/{post_id}/like', headers=headers)
    assert liked.status_code == 200, liked.text
    assert liked.json() == {'liked_by_me': True, 'likes_count': 1}

    details = await client.get(f'/posts/{post_id}', headers=headers)
    assert details.status_code == 200, details.text
    assert details.json()['liked_by_me'] is True
    assert details.json()['likes_count'] == 1
    assert details.json()['upvotes'] == 0
    assert details.json()['downvotes'] == 0

    unliked = await client.post(f'/posts/{post_id}/like', headers=headers)
    assert unliked.status_code == 200, unliked.text
    assert unliked.json() == {'liked_by_me': False, 'likes_count': 0}


async def test_like_requires_authentication(client: AsyncClient):
    response = await client.post('/posts/00000000-0000-0000-0000-000000000000/like')
    assert response.status_code == 401
