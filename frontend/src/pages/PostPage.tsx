import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import api from '../lib/api'
import { Post, Comment } from '../types'
import CommentTree from '../components/ui/CommentTree'
import { useAuthStore } from '../store/authStore'

export default function PostPage() {
  const { id } = useParams<{ id: string }>()
  const user = useAuthStore((s) => s.user)
  const [post, setPost] = useState<Post | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetch = async () => {
      try {
        const [pRes, cRes] = await Promise.all([
          api.get(`/posts/${id}`),
          api.get(`/comments/${id}`),
        ])
        setPost(pRes.data)
        setComments(cRes.data)
      } catch {
        setError('Failed to load post.')
      }
    }
    fetch()
  }, [id])

  const submitComment = async () => {
    if (!newComment.trim()) return
    const res = await api.post(`/comments/${id}`, { content: newComment })
    setComments((prev) => [{ ...res.data, replies: [] }, ...prev])
    setNewComment('')
  }

  const handleReplyAdded = (reply: Comment, parentId: string) => {
    const addReply = (list: Comment[]): Comment[] =>
      list.map((c) =>
        c.id === parentId
          ? { ...c, replies: [...(c.replies || []), { ...reply, replies: [] }] }
          : { ...c, replies: addReply(c.replies || []) }
      )
    setComments((prev) => addReply(prev))
  }

  if (error) return <p className="text-red-500 text-sm">{error}</p>
  if (!post) return <p className="text-gray-500">Loading...</p>

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        <div className="text-xs text-gray-500 mb-2">Posted by {post.author?.username}</div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">{post.title}</h1>
        {post.content && <p className="text-gray-700 text-sm leading-relaxed">{post.content}</p>}
        <div className="flex gap-4 mt-3 text-sm text-gray-500">
          <span>{post.upvotes - post.downvotes} points</span>
          <span>{comments.length} comments</span>
        </div>
      </div>

      {user && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment..."
            rows={3}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500 resize-none"
          />
          <button
            onClick={submitComment}
            className="mt-2 bg-brand-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-brand-700"
          >
            Comment
          </button>
        </div>
      )}

      <div>
        {comments.map((c) => (
          <CommentTree key={c.id} comment={c} postId={id!} onReplyAdded={handleReplyAdded} />
        ))}
      </div>
    </div>
  )
}
