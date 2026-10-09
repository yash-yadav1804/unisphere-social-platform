
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Post } from '../../types'
import api from '../../lib/api'
import { useAuthStore } from '../../store/authStore'

interface Props {
  post: Post
  onVote?: (postId: string, value: number) => void
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

  const score = upvotes - downvotes

  useEffect(() => {
    setUserVote(votePost.user_vote ?? 0)
    setUpvotes(post.upvotes)
    setDownvotes(post.downvotes)
  }, [post.id, post.upvotes, post.downvotes, votePost.user_vote])

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

      onVote?.(post.id, value)
    } catch {
      setError('Vote failed. Please try again.')
    } finally {
      setVoting(false)
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
          <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
            <span className="font-semibold text-blue-700">
              Unisphere Discussion
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Posted by{' '}
              <Link
                to={`/u/${post.author?.username}`}
                className="font-medium text-slate-700 hover:text-blue-700 hover:underline"
              >
                {post.author?.username ?? 'Unknown user'}
              </Link>
            </span>
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
