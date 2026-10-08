# Unisphere

A full-stack social media platform built as my final year project that has communities, threaded posts, voting and real-time DMs.

## Tech stack

**Backend:** FastAPI, SQLAlchemy (async), Alembic, PostgreSQL, WebSockets, JWT auth

**Frontend:** React 18, TypeScript, Tailwind CSS, Zustand, React Router v6, Axios

**Deployment:** Render (backend + DB) · Cloudflare Pages (frontend)

## Features

- Register / login with JWT authentication
- Create and join communities
- Create posts, upvote/downvote
- Threaded nested comments with replies
- Real-time direct messaging via WebSockets
- User profiles with post and comment history
- Search posts and communities

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
