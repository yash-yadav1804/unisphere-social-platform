
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Post } from '../../types'
import api from '../../lib/api'
import { useAuthStore } from '../../store/authStore'

interface Props {
  post: Post
  onVote?: (postId: string, value: number) => void
}

export default function PostCard({ post, onVote }: Props) {
  const user = useAuthStore((state) => state.user)
  const [voting, setVoting] = useState(false)
  const [error, setError] = useState('')

  const score = post.upvotes - post.downvotes

  const vote = async (value: number) => {
    if (!user) {
      setError('Please log in to vote.')
      return
    }

    if (voting) return

    setVoting(true)
    setError('')

    try {
      await api.post('/posts/vote', {
        target_id: post.id,
        target_type: 'post',
        value,
      })

      onVote?.(post.id, value)
    } catch {
      setError('Vote failed. Please try again.')
    } finally {
      setVoting(false)
    }
  }

  return (
    <article className="group overflow-hidden rounded-2xl border border-slate-200 bg-white transition-all duration-200 hover:border-slate-300 hover:shadow-md">
      <div className="flex">
        <div className="flex w-14 shrink-0 flex-col items-center gap-1 bg-slate-50/80 py-5">
          <button
            type="button"
            aria-label="Upvote post"
            title="Upvote"
            disabled={voting}
            onClick={() => void vote(1)}
            className="rounded-lg px-2 py-1 text-xl leading-none text-slate-500 transition hover:bg-blue-100 hover:text-blue-700 disabled:opacity-50"
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
            title="Downvote"
            disabled={voting}
            onClick={() => void vote(-1)}
            className="rounded-lg px-2 py-1 text-xl leading-none text-slate-500 transition hover:bg-rose-100 hover:text-rose-600 disabled:opacity-50"
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
