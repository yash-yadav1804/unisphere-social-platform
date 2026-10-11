"""Add user follow relationships."""

from alembic import op
import sqlalchemy as sa

revision = "c7d91a4e2f60"
down_revision = "b532e8b700c1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "follows",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("follower_id", sa.Uuid(), nullable=False),
        sa.Column("following_id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["follower_id"],
            ["users.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["following_id"],
            ["users.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "follower_id",
            "following_id",
            name="uq_follows_follower_following",
        ),
        sa.CheckConstraint(
            "follower_id <> following_id",
            name="ck_follows_no_self_follow",
        ),
    )


def downgrade() -> None:
    op.drop_table("follows")
