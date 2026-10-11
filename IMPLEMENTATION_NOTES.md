# Unisphere feature bundle — implementation notes

## Included changes

- Added a separate post Like/Unlike action backed by a `post_likes` table. Existing upvote/downvote voting remains independent.
- Added profile editing for username and bio, profile-photo upload (JPG/PNG/WEBP, up to 5 MB), and static serving for uploaded avatars.
- Added follower/following list endpoints and clickable lists on profiles.
- Added follow/unfollow actions to people search results.
- Improved chat presentation with profile links, avatars, timestamps, history-loading and send states.
- Added a dedicated `/communities` page, wired Browse all communities to it, and added Join actions.
- Added avatar display to posts, comments, profile, chat and navigation.
- Added tests for like/unlike behavior and for preserving the separate vote counts.

## Apply database migration

From `backend/` with the correct virtual environment and `DATABASE_URL` configured:

```bash
alembic upgrade head
```

The new migration is `e8a31f4b9c20_add_post_likes.py` and follows the existing saved-post/notification migration.

## Avatar storage note

Uploaded avatar files are stored under `backend/uploads/` and served at `/uploads/...`. For durable production storage across redeployments or multiple backend instances, configure persistent disk or move avatar storage to object storage. This MVP implementation uses the server filesystem.

## Validation status

- Python source syntax compilation passed.
- Modified TSX files passed TypeScript transpilation/syntax checks.
- Full backend pytest suite could not run in this environment because `aiosqlite` is not installed and package network access is unavailable.
- Full frontend production build could not run because npm dependencies could not be installed in this environment. Run `npm ci` and `npm run build` locally before deploying.
