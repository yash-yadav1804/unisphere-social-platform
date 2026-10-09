
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import api from '../lib/api'
import { Post, Comment } from '../types'
import CommentTree from '../components/ui/CommentTree'
import { useAuthStore } from '../store/authStore'

function countComments(comments: Comment[]): number {
  return comments.reduce(
    (total, comment) =>
      total + 1 + countComments(comment.replies ?? []),
    0
  )
}

export default function PostPage() {
  const { id } = useParams<{ id: string }>()
  const user = useAuthStore((state) => state.user)

  const [post, setPost] = useState<Post | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [commentError, setCommentError] = useState('')

  // Synchronously prevents rapid repeated submissions.
  const submitLock = useRef(false)

  const fetchComments = useCallback(async () => {
    if (!id) return

    const response = await api.get<Comment[]>(`/comments/${id}`)
    setComments(response.data)
  }, [id])

  const fetchPost = useCallback(async () => {
    if (!id) {
      setError('Invalid post link.')
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')

    try {
      const [postResponse, commentsResponse] = await Promise.all([
        api.get<Post>(`/posts/${id}`),
        api.get<Comment[]>(`/comments/${id}`),
      ])

      setPost(postResponse.data)
      setComments(commentsResponse.data)
    } catch {
      setError('Unable to load this discussion. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void fetchPost()
  }, [fetchPost])

  const submitComment = async () => {
    const content = newComment.trim()

    if (!id || !content || submitLock.current) return

    if (content.length > 5000) {
      setCommentError('Comments must be 5,000 characters or fewer.')
      return
    }

    submitLock.current = true
    setSubmitting(true)
    setCommentError('')

    try {
      await api.post(`/comments/${id}`, { content })

      setNewComment('')
      await fetchComments()
    } catch {
      setCommentError('Could not post your comment. Please try again.')
    } finally {
      submitLock.current = false
      setSubmitting(false)
    }
  }

  const handleReplyAdded = async (
    _reply: Comment,
    _parentId: string
  ) => {
    try {
      await fetchComments()
    } catch {
      setCommentError(
        'Your reply may have been saved, but the comments could not refresh.'
      )
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="animate-pulse rounded-2xl border border-slate-200 bg-white p-6">
          <div className="mb-4 h-3 w-32 rounded bg-slate-200" />
          <div className="mb-3 h-7 w-3/4 rounded bg-slate-200" />
          <div className="h-4 w-full rounded bg-slate-100" />
          <div className="mt-2 h-4 w-2/3 rounded bg-slate-100" />
        </div>

        <div className="animate-pulse rounded-2xl border border-slate-200 bg-white p-6">
          <div className="h-4 w-40 rounded bg-slate-200" />
          <div className="mt-4 h-20 rounded bg-slate-100" />
        </div>
      </div>
    )
  }

  if (error || !post) {
    return (
      <div className="mx-auto max-w-3xl rounded-2xl border border-rose-100 bg-white p-8 text-center">
        <p className="text-sm text-rose-600">
          {error || 'This post could not be found.'}
        </p>

        <button
          type="button"
          onClick={() => void fetchPost()}
          className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
        >
          Try again
        </button>
      </div>
    )
  }

  const totalComments = countComments(comments)

  return (
    <main className="mx-auto max-w-3xl space-y-5">
      <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="p-5 sm:p-7">
          <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="rounded-full bg-blue-50 px-3 py-1 font-semibold text-blue-700">
              Discussion
            </span>

            <span aria-hidden="true">·</span>

            <span>
              Posted by{' '}
              {post.author?.username ? (
                <Link
                  to={`/u/${post.author.username}`}
                  className="font-semibold text-slate-700 hover:text-blue-700"
                >
                  {post.author.username}
                </Link>
              ) : (
                'Unknown user'
              )}
            </span>

            <span aria-hidden="true">·</span>

            <time dateTime={post.created_at}>
              {new Date(post.created_at).toLocaleDateString()}
            </time>
          </div>

          <h1 className="break-words text-2xl font-bold leading-tight tracking-tight text-slate-900 sm:text-3xl">
            {post.title}
          </h1>

          {post.content && (
            <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-7 text-slate-600 sm:text-base">
              {post.content}
            </p>
          )}

          {post.image_url && (
            <img
              src={post.image_url}
              alt="Post attachment"
              loading="lazy"
              className="mt-5 max-h-[480px] w-full rounded-xl border border-slate-100 object-contain"
            />
          )}

          <div className="mt-6 flex items-center gap-5 border-t border-slate-100 pt-4 text-sm text-slate-500">
            <span className="font-semibold text-slate-700">
              {post.upvotes - post.downvotes} points
            </span>

            <span>
              {totalComments}{' '}
              {totalComments === 1 ? 'comment' : 'comments'}
            </span>
          </div>
        </div>
      </article>

      <section
        aria-labelledby="comments-heading"
        className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7"
      >
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h2
              id="comments-heading"
              className="text-lg font-bold text-slate-900"
            >
              Discussion
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Share your thoughts and join the conversation.
            </p>
          </div>

          <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {totalComments}
          </span>
        </div>

        {user ? (
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void submitComment()
            }}
            className="mb-6"
          >
            <label
              htmlFor="new-comment"
              className="mb-2 block text-sm font-semibold text-slate-700"
            >
              Add a comment
            </label>

            <textarea
              id="new-comment"
              value={newComment}
              onChange={(event) => {
                setNewComment(event.target.value)
                if (commentError) setCommentError('')
              }}
              placeholder="What are your thoughts?"
              rows={4}
              maxLength={5000}
              disabled={submitting}
              className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50 disabled:opacity-60"
            />

            <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-slate-400">
                {newComment.length}/5000 characters
              </span>

              <button
                type="submit"
                disabled={!newComment.trim() || submitting}
                className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? 'Posting…' : 'Post comment'}
              </button>
            </div>

            {commentError && (
              <p role="alert" className="mt-3 text-sm text-rose-600">
                {commentError}
              </p>
            )}
          </form>
        ) : (
          <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-slate-600">
              Log in to share your thoughts or reply to a comment.
            </p>

            <Link
              to="/login"
              className="mt-3 inline-flex rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
            >
              Log in
            </Link>
          </div>
        )}

        <div className="space-y-4">
          {comments.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 px-5 py-10 text-center">
              <p className="font-semibold text-slate-700">
                No comments yet
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Be the first to start the conversation.
              </p>
            </div>
          ) : (
            comments.map((comment) => (
              <CommentTree
                key={comment.id}
                comment={comment}
                postId={post.id}
                onReplyAdded={handleReplyAdded}
              />
            ))
          )}
        </div>
      </section>
    </main>
  )
}
