from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import auth, communities, posts, comments, messages, users, search

app = FastAPI(title="Unisphere API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "https://unisphere.pages.dev"],
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

@app.get("/")
async def root():
    return {"message": "Unisphere API is running"}
