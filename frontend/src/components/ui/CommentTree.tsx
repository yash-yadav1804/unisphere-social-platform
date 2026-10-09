
import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Comment } from '../../types'
import { useAuthStore } from '../../store/authStore'
import api from '../../lib/api'

interface Props {
  comment: Comment
  postId: string
  depth?: number
  onReplyAdded: (reply: Comment, parentId: string) => void | Promise<void>
}

export default function CommentTree({
  comment,
  postId,
  depth = 0,
  onReplyAdded,
}: Props) {
  const user = useAuthStore((state) => state.user)

  const [replying, setReplying] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  // Prevents rapid repeated reply submissions before React re-renders.
  const replyLock = useRef(false)

  const isOwner = user?.id === comment.author_id

  const submitReply = async () => {
    const content = replyText.trim()

    if (!content || replyLock.current) return

    if (content.length > 5000) {
      setError('Replies must be 5,000 characters or fewer.')
      return
    }

    replyLock.current = true
    setSubmitting(true)
    setError('')

    try {
      const response = await api.post<Comment>(`/comments/${postId}`, {
        content,
        parent_id: comment.id,
      })

      setReplyText('')
      setReplying(false)
      await onReplyAdded(response.data, comment.id)
    } catch {
      setError('Could not post your reply. Please try again.')
    } finally {
      replyLock.current = false
      setSubmitting(false)
    }
  }

  const deleteComment = async () => {
    const confirmed = window.confirm(
      'Delete this comment and all its replies? This action cannot be undone.'
    )

    if (!confirmed || deleting) return

    setDeleting(true)
    setError('')

    try {
      await api.delete(`/comments/${comment.id}`)
      await onReplyAdded(comment, comment.id)
    } catch {
      setError('Could not delete this comment. Please try again.')
      setDeleting(false)
    }
  }

  const createdAt = new Date(comment.created_at)
  const validDate = !Number.isNaN(createdAt.getTime())

  return (
    <article className="min-w-0">
      <div
        className={`min-w-0 rounded-xl border border-slate-200 bg-white p-4 ${
          depth > 0 ? 'border-l-2 border-l-blue-200' : ''
        }`}
      >
        <div className="flex min-w-0 items-start gap-3">
          <div
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-bold text-blue-700"
          >
            {(comment.author?.username ?? 'U').charAt(0).toUpperCase()}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
              {comment.author?.username ? (
                <Link
                  to={`/u/${comment.author.username}`}
                  className="font-semibold text-slate-800 hover:text-blue-700"
                >
                  {comment.author.username}
                </Link>
              ) : (
                <span className="font-semibold text-slate-800">
                  Unknown user
                </span>
              )}

              <span aria-hidden="true">·</span>

              <time dateTime={comment.created_at}>
                {validDate
                  ? createdAt.toLocaleDateString()
                  : 'Date unavailable'}
              </time>
            </div>

            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">
              {comment.content}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-4">
              {user && (
                <button
                  type="button"
                  aria-expanded={replying}
                  onClick={() => {
                    setReplying((current) => !current)
                    setError('')
                  }}
                  className="text-xs font-semibold text-slate-500 transition hover:text-blue-700"
                >
                  {replying ? 'Cancel reply' : 'Reply'}
                </button>
              )}

              {isOwner && (
                <button
                  type="button"
                  onClick={() => void deleteComment()}
                  disabled={deleting}
                  className="text-xs font-semibold text-rose-600 transition hover:text-rose-700 disabled:opacity-50"
                >
                  {deleting ? 'Deleting…' : 'Delete'}
                </button>
              )}
            </div>

            {replying && user && (
              <form
                onSubmit={(event) => {
                  event.preventDefault()
                  void submitReply()
                }}
                className="mt-3"
              >
                <label
                  htmlFor={`reply-${comment.id}`}
                  className="mb-2 block text-xs font-semibold text-slate-600"
                >
                  Write a reply
                </label>

                <textarea
                  id={`reply-${comment.id}`}
                  value={replyText}
                  onChange={(event) => {
                    setReplyText(event.target.value)
                    if (error) setError('')
                  }}
                  placeholder="Add to the conversation…"
                  rows={2}
                  maxLength={5000}
                  disabled={submitting}
                  className="w-full resize-y rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-50 disabled:opacity-60"
                />

                <div className="mt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={!replyText.trim() || submitting}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submitting ? 'Posting…' : 'Post reply'}
                  </button>
                </div>
              </form>
            )}

            {error && (
              <p role="alert" className="mt-2 text-xs text-rose-600">
                {error}
              </p>
            )}
          </div>
        </div>
      </div>

      {comment.replies?.length > 0 && (
        <div className="ml-4 mt-3 space-y-3 border-l border-slate-200 pl-3 sm:ml-6 sm:pl-4">
          {comment.replies.map((reply) => (
            <CommentTree
              key={reply.id}
              comment={reply}
              postId={postId}
              depth={depth + 1}
              onReplyAdded={onReplyAdded}
            />
          ))}
        </div>
      )}
    </article>
  )
}
