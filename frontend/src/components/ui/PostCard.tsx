
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Post } from '../../types'
import api from '../../lib/api'
import { useAuthStore } from '../../store/authStore'

interface Props {
  post: Post
  onVote?: (
  postId: string,
  result: {
    user_vote: number
    upvotes: number | null
    downvotes: number | null
  }
) => void
}

type VotePost = Post & {
  user_vote?: number
}

type VoteResponse = {
  action: 'created' | 'updated' | 'removed'
  user_vote: number
  upvotes: number | null
  downvotes: number | null
}

export default function PostCard({ post, onVote }: Props) {
  const user = useAuthStore((state) => state.user)
  const votePost = post as VotePost

  const [voting, setVoting] = useState(false)
  const [error, setError] = useState('')
  const [userVote, setUserVote] = useState(votePost.user_vote ?? 0)
  const [upvotes, setUpvotes] = useState(post.upvotes)
  const [downvotes, setDownvotes] = useState(post.downvotes)
  const [isSaved, setIsSaved] = useState(Boolean(post.is_saved))
  const [saving, setSaving] = useState(false)
  const [liked, setLiked] = useState(Boolean(post.liked_by_me))
  const [likesCount, setLikesCount] = useState(post.likes_count ?? 0)
  const [liking, setLiking] = useState(false)

  const score = upvotes - downvotes

  useEffect(() => {
    setUserVote(votePost.user_vote ?? 0)
    setUpvotes(post.upvotes)
    setDownvotes(post.downvotes)
    setIsSaved(Boolean(post.is_saved))
    setLiked(Boolean(post.liked_by_me))
    setLikesCount(post.likes_count ?? 0)
  }, [post.id, post.upvotes, post.downvotes, votePost.user_vote, post.is_saved])

  const vote = async (value: 1 | -1) => {
    if (!user) {
      setError('Please log in to vote.')
      return
    }

    if (voting) return

    setVoting(true)
    setError('')

    try {
      const response = await api.post<VoteResponse>('/posts/vote', {
        target_id: post.id,
        target_type: 'post',
        value,
      })

      const result = response.data

      setUserVote(result.user_vote)

      if (result.upvotes !== null && result.downvotes !== null) {
        setUpvotes(result.upvotes)
        setDownvotes(result.downvotes)
      }

      onVote?.(post.id, result)
    } catch {
      setError('Vote failed. Please try again.')
    } finally {
      setVoting(false)
    }
  }

  const toggleLike = async () => {
    if (!user) { setError('Please log in to like posts.'); return }
    if (liking) return
    setLiking(true)
    setError('')
    try {
      const response = await api.post<{ liked_by_me: boolean; likes_count: number }>(`/posts/${post.id}/like`)
      setLiked(response.data.liked_by_me)
      setLikesCount(response.data.likes_count)
    } catch {
      setError('Could not update like. Please try again.')
    } finally { setLiking(false) }
  }

  const toggleSave = async () => {
    if (!user) {
      setError('Please log in to save posts.')
      return
    }
    if (saving) return
    setSaving(true)
    setError('')
    try {
      if (isSaved) {
        await api.delete(`/saved-posts/${post.id}`)
        setIsSaved(false)
      } else {
        await api.put(`/saved-posts/${post.id}`)
        setIsSaved(true)
      }
    } catch {
      setError('Could not update saved posts. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const upvoteClass =
    userVote === 1
      ? 'bg-blue-100 text-blue-700'
      : 'text-slate-500 hover:bg-blue-100 hover:text-blue-700'

  const downvoteClass =
    userVote === -1
      ? 'bg-rose-100 text-rose-600'
      : 'text-slate-500 hover:bg-rose-100 hover:text-rose-600'

  return (
    <article className="group overflow-hidden rounded-2xl border border-slate-200 bg-white transition-all duration-200 hover:border-slate-300 hover:shadow-md">
      <div className="flex">
        <div className="flex w-14 shrink-0 flex-col items-center gap-1 bg-slate-50/80 py-5">
          <button
            type="button"
            aria-label="Upvote post"
            aria-pressed={userVote === 1}
            title={userVote === 1 ? 'Remove upvote' : 'Upvote'}
            disabled={voting}
            onClick={() => void vote(1)}
            className={`rounded-lg px-2 py-1 text-xl leading-none transition disabled:cursor-not-allowed disabled:opacity-50 ${upvoteClass}`}
          >
            ▲
          </button>

          <span
            className="text-sm font-bold tabular-nums text-slate-800"
            aria-label={`Score ${score}`}
          >
            {score}
          </span>

          <button
            type="button"
            aria-label="Downvote post"
            aria-pressed={userVote === -1}
            title={userVote === -1 ? 'Remove downvote' : 'Downvote'}
            disabled={voting}
            onClick={() => void vote(-1)}
            className={`rounded-lg px-2 py-1 text-xl leading-none transition disabled:cursor-not-allowed disabled:opacity-50 ${downvoteClass}`}
          >
            ▼
          </button>
        </div>

        <div className="min-w-0 flex-1 p-5">
          <div className="mb-3 flex items-center gap-2 text-xs text-slate-500">
            <Link to={post.author?.username ? `/u/${encodeURIComponent(post.author.username)}` : '#'} className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-50 font-bold text-blue-700">{post.author?.avatar_url ? <img src={post.author.avatar_url} alt="" className="h-full w-full object-cover"/> : (post.author?.username ?? 'U').charAt(0).toUpperCase()}</Link>
            <div className="min-w-0"><span className="font-semibold text-blue-700">Unisphere Discussion</span><span aria-hidden="true"> · </span><span>Posted by <Link to={`/u/${encodeURIComponent(post.author?.username ?? '')}`} className="font-medium text-slate-700 hover:text-blue-700 hover:underline">{post.author?.username ?? 'Unknown user'}</Link></span><span aria-hidden="true"> · </span><time dateTime={post.created_at}>{new Date(post.created_at).toLocaleDateString()}</time></div>
          </div>

          <Link
            to={`/post/${post.id}`}
            className="block text-lg font-bold leading-snug tracking-tight text-slate-900 transition hover:text-blue-700"
          >
            {post.title}
          </Link>

          {post.content && (
            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-600">
              {post.content}
            </p>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
            <Link
              to={`/post/${post.id}`}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-blue-50 hover:text-blue-700"
            >
              <span aria-hidden="true">▤</span>
              View discussion
            </Link>
            <button
              type="button"
              onClick={() => void toggleLike()}
              disabled={liking}
              aria-label={liked ? 'Unlike post' : 'Like post'}
              aria-pressed={liked}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition disabled:opacity-50 ${liked ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-600 hover:bg-rose-50 hover:text-rose-600'}`}
            >
              <span aria-hidden="true" className="text-base">{liked ? '♥' : '♡'}</span> {likesCount} {likesCount === 1 ? 'Like' : 'Likes'}
            </button>
            {user && (
              <button
                type="button"
                onClick={() => void toggleSave()}
                disabled={saving}
                aria-pressed={isSaved}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition disabled:opacity-50 ${isSaved ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600 hover:bg-amber-50 hover:text-amber-700'}`}
              >
                {saving ? 'Saving…' : isSaved ? '★ Saved' : '☆ Save'}
              </button>
            )}
          </div>

          {error && (
            <p role="alert" className="mt-3 text-sm text-rose-600">
              {error}
            </p>
          )}
        </div>
      </div>
    </article>
  )
}
