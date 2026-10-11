
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Comment } from '../../types'
import { useAuthStore } from '../../store/authStore'
import api from '../../lib/api'

interface Props {
  comment: Comment
  postId: string
  depth?: number
  onReplyAdded: (reply: Comment, parentId: string) => void | Promise<void>
  canModerate?: boolean
}

export default function CommentTree({
  comment,
  postId,
  depth = 0,
  onReplyAdded,
  canModerate = false,
}: Props) {
  const user = useAuthStore((state) => state.user)

  const [replying, setReplying] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(comment.content)
  const [savingEdit, setSavingEdit] = useState(false)
  const [voting, setVoting] = useState(false)
  const [commentVotes, setCommentVotes] = useState(comment.upvotes)
  const [userVote, setUserVote] = useState(comment.user_vote ?? 0)
  const [error, setError] = useState('')

  // Prevent rapid duplicate submissions before React re-renders.
  const replyLock = useRef(false)

  // Reuse the same key when retrying the same reply.
  const pendingReplyRequest = useRef<{
    content: string
    key: string
  } | null>(null)

  const isOwner = user?.id === comment.author_id
  const canDelete = isOwner || canModerate

  useEffect(() => {
    setCommentVotes(comment.upvotes)
    setUserVote(comment.user_vote ?? 0)
  }, [comment.id, comment.upvotes, comment.user_vote])

  const voteComment = async () => {
    if (!user) { setError('Please log in to vote.'); return }
    if (voting) return
    setVoting(true)
    setError('')
    try {
      const response = await api.post('/posts/vote', { target_id: comment.id, target_type: 'comment', value: 1 })
      setCommentVotes(response.data.upvotes ?? commentVotes)
      setUserVote(response.data.user_vote)
    } catch { setError('Could not update comment vote. Please try again.') }
    finally { setVoting(false) }
  }

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

    let request = pendingReplyRequest.current

    if (!request || request.content !== content) {
      request = {
        content,
        key: crypto.randomUUID(),
      }
      pendingReplyRequest.current = request
    }

    try {
      const response = await api.post<Comment>(`/comments/${postId}`, {
        content,
        parent_id: comment.id,
        idempotency_key: request.key,
      })

      pendingReplyRequest.current = null
      setReplyText('')
      setReplying(false)

      await onReplyAdded(response.data, comment.id)
    } catch {
      setError('Could not confirm your reply. Please try again.')
    } finally {
      replyLock.current = false
      setSubmitting(false)
    }
  }

  const saveEdit = async () => {
    const content = editText.trim()
    if (!content || content.length > 5000 || savingEdit) return
    setSavingEdit(true)
    setError('')
    try {
      await api.patch(`/comments/${comment.id}`, { content })
      await onReplyAdded(comment, comment.id)
      setEditing(false)
    } catch { setError('Could not save comment changes. Please try again.') }
    finally { setSavingEdit(false) }
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
          <Link to={comment.author?.username ? `/u/${encodeURIComponent(comment.author.username)}` : '#'} aria-label={`${comment.author?.username ?? 'User'} profile`} className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-50 text-sm font-bold text-blue-700">{comment.author?.avatar_url ? <img src={comment.author.avatar_url} alt="" className="h-full w-full object-cover"/> : (comment.author?.username ?? 'U').charAt(0).toUpperCase()}</Link>

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

            {editing ? (
              <div className="mt-2 space-y-2">
                <textarea value={editText} onChange={(event) => setEditText(event.target.value)} maxLength={5000} rows={3} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" aria-label="Edit comment" />
                <div className="flex gap-2"><button type="button" disabled={!editText.trim() || savingEdit} onClick={() => void saveEdit()} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">{savingEdit ? 'Saving…' : 'Save'}</button><button type="button" onClick={() => { setEditing(false); setEditText(comment.content) }} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold">Cancel</button></div>
              </div>
            ) : (
              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{comment.content}</p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-4">
              <button type="button" onClick={() => void voteComment()} disabled={voting} aria-pressed={userVote === 1} className={`text-xs font-semibold disabled:opacity-50 ${userVote === 1 ? 'text-blue-700' : 'text-slate-500 hover:text-blue-700'}`}>▲ {commentVotes}</button>
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

              {isOwner && !editing && (
                <button type="button" onClick={() => { setEditText(comment.content); setEditing(true) }} className="text-xs font-semibold text-slate-500 transition hover:text-blue-700">Edit</button>
              )}

              {canDelete && !editing && (
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
              canModerate={canModerate}
            />
          ))}
        </div>
      )}
    </article>
  )
}
