from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from app.routers import (
    auth,
    communities,
    posts,
    comments,
    messages,
    users,
    search,
    saved_posts,
    notifications,
)

app = FastAPI(title="Unisphere API", version="1.0.0")

UPLOAD_DIR = os.path.join(
    os.path.dirname(os.path.dirname(__file__)),
    "uploads",
)
os.makedirs(UPLOAD_DIR, exist_ok=True)

app.mount(
    "/uploads",
    StaticFiles(directory=UPLOAD_DIR),
    name="uploads",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://unisphere.pages.dev",
        "https://unisphere-zeta-five.vercel.app",
        "https://unisphere-epoxux0ck-yash-yadav1804s-projects.vercel.app",
        "https://unisphere-atle51xr5-yash-yadav1804s-projects.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(communities.router)
app.include_router(posts.router)
app.include_router(comments.router)
app.include_router(messages.router)
app.include_router(users.router)
app.include_router(search.router)
app.include_router(saved_posts.router)
app.include_router(notifications.router)


@app.get("/")
async def root():
    return {"message": "Unisphere API is running"}
