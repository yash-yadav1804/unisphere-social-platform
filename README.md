<div align="center">

# Unisphere — Social Community Platform

**A full-stack social platform for communities, discussions, and direct messaging.**

[Live Demo](https://unisphere-zeta-five.vercel.app/login) ·
[Source Code](https://github.com/yash-yadav1804/unisphere-social-platform)

</div>

Unisphere is a social community web application where users can create posts, join communities, discuss ideas, follow other users, save posts, receive notifications, and exchange direct messages. The frontend is built with React and TypeScript, with a FastAPI backend and PostgreSQL database.

> **Live application:** https://unisphere-zeta-five.vercel.app/login  
> **Repository:** https://github.com/yash-yadav1804/unisphere-social-platform  
> **Backend API:** Not yet added — see [Finding the backend URL](#finding-the-backend-url).

## Table of Contents

- [Features](#features)
- [Technology Stack](#technology-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Configuration](#environment-configuration)
- [Run Locally](#run-locally)
- [API Documentation](#api-documentation)
- [Deployment](#deployment)
- [Testing and Verification](#testing-and-verification)
- [Security Notes](#security-notes)
- [Future Improvements](#future-improvements)
- [Author](#author)

## Features

### Authentication and User Profiles
- User registration and login.
- JWT-based authentication for protected API routes.
- User profile pages with username and bio.
- Profile avatar upload.
- Profile statistics, including post, follower, and following counts.

### Posts and Discussions
- Create and view community posts.
- Comment on posts and view discussion activity.
- Vote on posts.
- Browse post activity across the platform.

### Communities
- Browse available communities.
- Create communities.
- Join and leave communities.
- View community posts and participate in discussions.

### Social Features
- Follow and unfollow users.
- View follower and following information.
- Save posts for later.
- View notifications.

### Direct Messaging
- View conversations and message history.
- Send direct messages to other users.
- WebSocket-based real-time message delivery.
- Persist messages in PostgreSQL so history can be retrieved later.
- Frontend WebSocket reconnect handling.

> **Verification note:** The frontend and backend have been deployed, and the backend health/OpenAPI endpoint has previously returned HTTP 200. Some production interactions — including message delivery after reconnect, avatar uploads, follow behavior, and comments — have required debugging. Test the live workflows before describing every feature as fully production-verified.

## Technology Stack

| Layer | Technologies |
|---|---|
| Frontend | React, TypeScript, Vite |
| Styling and UI | Tailwind CSS |
| Routing | React Router |
| HTTP client | Axios |
| Backend API | Python, FastAPI |
| Database access | SQLAlchemy (async) |
| Database migrations | Alembic |
| Database | PostgreSQL |
| Authentication | JWT |
| Real-time communication | WebSockets |
| Frontend hosting | Vercel |
| Backend hosting | AWS EC2 |
| Reverse proxy / HTTPS | Nginx, Let's Encrypt (as configured) |
| Backend process management | systemd (as configured) |

## Architecture

```text
Browser
   |
   | HTTPS
   v
React + TypeScript frontend (Vercel)
   |
   | REST API / WebSocket
   v
Nginx reverse proxy (AWS EC2)
   |
   v
FastAPI application (Uvicorn)
   |
   v
PostgreSQL database
```

The frontend communicates with FastAPI through REST endpoints. Direct messages use a WebSocket connection, while message history is retrieved through the API and stored in PostgreSQL.

## Project Structure

```text
unisphere-social-platform/
├── frontend/
│   ├── src/
│   │   ├── components/     # Reusable UI and layout components
│   │   ├── hooks/          # Reusable hooks, including WebSocket handling
│   │   ├── lib/            # API client and shared utilities
│   │   ├── pages/          # Application pages
│   │   ├── store/          # Client-side state
│   │   └── types/          # TypeScript types
│   └── package.json
│
└── backend/
    ├── app/
    │   ├── core/           # Authentication and dependencies
    │   ├── models/         # SQLAlchemy models
    │   ├── routers/        # API endpoints
    │   ├── schemas/        # Request/response schemas
    │   └── db/             # Database session configuration
    ├── alembic/            # Database migrations
    └── pyproject.toml
```

*This structure is a guide based on the project layout; directory names may differ slightly by branch.*

## Getting Started

### Prerequisites

Install the following:
- Git
- Node.js and npm
- A Python version supported by the backend configuration
- PostgreSQL, or access to a PostgreSQL database

### 1. Clone the repository

```bash
git clone https://github.com/yash-yadav1804/unisphere-social-platform.git
cd unisphere-social-platform
```

### 2. Configure and start the backend

```bash
cd backend
```

Create a `.env` file using the environment variables expected by the backend configuration. Configure the database connection and JWT/signing secret at minimum. Never copy production secrets into a local file or commit them to Git.

If the project uses `uv`:

```bash
uv sync
uv run alembic upgrade head
uv run uvicorn app.main:app --reload
```

The API is typically available at `http://127.0.0.1:8000`.

### 3. Configure and start the frontend

Open a second terminal from the repository root:

```bash
cd frontend
npm install
```

Set the frontend API base URL using the variable read by `frontend/src/lib/api.ts`. Set `VITE_WS_URL` to the WebSocket URL used by `frontend/src/hooks/useWebSocket.ts`. Check those files for the exact variable names expected by the current branch.

For local development, the WebSocket URL may look like:

```env
VITE_WS_URL=ws://localhost:8000
```

Then start the frontend:

```bash
npm run dev
```

Create a production build with:

```bash
npm run build
```

## Environment Configuration

Environment variable names must match the current codebase. Check the API client, WebSocket hook, and backend settings before configuring them.

Typical settings include:

| Setting | Purpose |
|---|---|
| Database connection URL | Connects the backend to PostgreSQL |
| JWT/signing secret | Signs and validates authentication tokens |
| Frontend REST API base URL | Points the frontend to the deployed or local API |
| WebSocket URL | Connects the frontend to the real-time messaging endpoint |

For production, use HTTPS and `wss://` for WebSocket traffic. Never commit `.env` files, database credentials, JWT secrets, private keys, or access tokens.

## API Documentation

When running locally, FastAPI's interactive documentation is normally available at:

- Swagger UI: `http://127.0.0.1:8000/docs`
- OpenAPI schema: `http://127.0.0.1:8000/openapi.json`

### Finding the backend URL

The AWS EC2 console screenshot shows this instance public IPv4 address:

```text
35.154.17.237
```

This is the EC2 server address, **not confirmation that the public API is reachable at that IP**. The actual API URL depends on the Nginx configuration, TLS certificate, security-group rules, and application routing.

On the EC2 instance, inspect Nginx configuration:

```bash
sudo nginx -T 2>/dev/null | grep -E 'server_name|proxy_pass'
```

Check the relevant services (the backend service name may be different):

```bash
sudo systemctl status nginx
sudo systemctl list-units --type=service | grep -Ei 'uvicorn|fastapi|unisphere|backend'
```

Once confirmed, add the real backend base URL and API docs URL here. Do not publish an unverified IP-based HTTPS URL.

## Deployment

### Frontend — Vercel

The React/Vite frontend is hosted on Vercel.

**Live application:** [https://unisphere-zeta-five.vercel.app/login](https://unisphere-zeta-five.vercel.app/login)

### Backend — AWS EC2

The FastAPI backend is hosted on AWS EC2. The deployment notes for this project describe:
- Uvicorn serving the FastAPI application.
- Nginx acting as a reverse proxy.
- HTTPS/TLS configured with Let's Encrypt, if currently active.
- PostgreSQL storing application data.
- Alembic managing database schema migrations.

**Backend API URL:** Add the verified public API URL here.  
**Swagger UI:** Add the verified URL ending in `/docs` here.

### Deployment checklist

1. Configure production environment variables securely.
2. Back up the database before applying migrations.
3. Apply Alembic migrations.
4. Restart the backend service after deployment.
5. Verify the health endpoint or OpenAPI endpoint.
6. Test core user flows through the live frontend.
7. Confirm REST and WebSocket URLs use the correct HTTPS/WSS configuration.

## Testing and Verification

Before presenting the deployment as fully verified, test the following with separate test accounts where applicable:

- [ ] Register and log in.
- [ ] Load and update a profile.
- [ ] Upload an avatar within the configured size limit.
- [ ] Create and view posts.
- [ ] Add and view comments.
- [ ] Create a community and join/leave it.
- [ ] Follow and unfollow another user.
- [ ] Vote on posts.
- [ ] Save and unsave posts.
- [ ] Load notifications.
- [ ] Send messages between two different accounts.
- [ ] Confirm messages appear promptly on both clients.
- [ ] Refresh and confirm message history persists.
- [ ] Disconnect/reconnect and confirm history synchronizes.
- [ ] Run `npm run build` successfully.

A successful frontend build or HTTP 200 from an API documentation endpoint confirms only those checks; it does not prove that every end-to-end feature is working.

## Security Notes

- Never commit `.env` files, credentials, JWTs, private keys, or production database dumps.
- Keep uploaded user files out of version control.
- Validate inputs and authorize protected backend operations.
- Use HTTPS/WSS in production.
- Restrict database access to trusted hosts and services.
- Back up the database before production migrations.
- Avoid exposing internal error details or secrets in API responses and logs.

## Future Improvements

- Add message delivery acknowledgements and robust retry handling.
- Improve WebSocket connection management across multiple tabs and devices.
- Add automated end-to-end tests for core user journeys.
- Improve loading, empty, and error states across the application.
- Add production monitoring and structured logging.

## Author

**Yash Yadav**

- GitHub: [@yash-yadav1804](https://github.com/yash-yadav1804)
- Project repository: [unisphere-social-platform](https://github.com/yash-yadav1804/unisphere-social-platform)
