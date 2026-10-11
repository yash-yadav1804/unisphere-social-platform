# Unisphere

A full-stack social media platform built as my final year project that has communities, threaded posts, voting and real-time DMs.

## Tech stack

**Backend:** FastAPI, SQLAlchemy (async), Alembic, PostgreSQL, WebSockets, JWT auth

**Frontend:** React 18, TypeScript, Tailwind CSS, Zustand, React Router v6, Axios

**Deployment:** Existing AWS EC2 backend + existing Vercel frontend. This project does not provision or switch deployment infrastructure.

## Features

- Register / login with JWT authentication
- Create and join communities
- Create posts, upvote/downvote
- Threaded nested comments with replies
- Real-time direct messaging via WebSockets
- User profiles with post and comment history
- Search posts and communities
- Follow / unfollow users with follower counts
- Save / unsave posts and browse a personal saved-posts page
- Notifications for new followers, comments and replies, including unread counts and read status
- Edit and delete your own posts and comments with server-side authorization
- Community admin tools for promoting members to moderators; moderators can manage posts and comments
- Community member counts and persisted join / leave status
- New and top feed sorting; nested threaded comments

## Existing production deployment

The deployed environment is intentionally unchanged:

- Frontend: `https://unisphere-zeta-five.vercel.app` (Vercel)
- Backend/API: `https://35.154.17.237` (existing EC2 instance)
- API docs: `https://35.154.17.237/docs`
- WebSocket base URL: `wss://35.154.17.237`

Keep these existing Vercel environment variables when deploying: `VITE_API_URL=https://35.154.17.237` and `VITE_WS_URL=wss://35.154.17.237`. Do not create a new deployment or database for these changes. Apply Alembic migrations on the existing backend before restarting its existing systemd service.

## Getting Started

### Prerequisites
- Python 3.11+
- Node.js 18+
- PostgreSQL running locally

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env           
alembic upgrade head
uvicorn app.main:app --reload
```

API runs at `http://localhost:8000`  
Swagger docs at `http://localhost:8000/docs`

### Frontend

```bash
cd frontend
npm install
cp .env.example .env 
npm run dev
```

App runs at `http://localhost:5173`

## Environment variables

### Backend `.env`
| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (use `+asyncpg` driver) |
| `SECRET_KEY` | Random secret for JWT signing |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Access token lifetime (default: 30) |
| `REFRESH_TOKEN_EXPIRE_DAYS` | Refresh token lifetime (default: 7) |

### Frontend `.env`
| Variable | Description |
|---|---|
| `VITE_API_URL` | Backend base URL |
| `VITE_WS_URL` | WebSocket base URL (use `ws://` or `wss://`) |

## Project structure

```
unisphere/
├── backend/
│   ├── app/
│   │   ├── core/        # config, security, deps
│   │   ├── db/          # session, base
│   │   ├── models/      # SQLAlchemy models
│   │   ├── routers/     # all API routes
│   │   ├── schemas/     # Pydantic schemas
│   │   └── main.py
│   ├── alembic/
│   ├── requirements.txt
│   ├── tests/               # API and behavior tests
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── lib/
│   │   ├── pages/
│   │   ├── store/
│   │   └── types/
│   ├── package.json
│   └── .env.example
└── README.md
```
