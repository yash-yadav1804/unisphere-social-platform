"""Add independent Twitter-style post likes."""
from alembic import op
import sqlalchemy as sa

revision = "e8a31f4b9c20"
down_revision = "d4e8f2a91c30"
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.create_table(
        "post_likes",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("post_id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["post_id"], ["posts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "post_id", name="uq_post_likes_user_post"),
    )
    op.create_index("ix_post_likes_post_id", "post_likes", ["post_id"])

def downgrade() -> None:
    op.drop_index("ix_post_likes_post_id", table_name="post_likes")
    op.drop_table("post_likes")
