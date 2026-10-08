import { useState } from 'react'
import { Comment } from '../../types'
import { useAuthStore } from '../../store/authStore'
import api from '../../lib/api'

interface Props {
  comment: Comment
  postId: string
  depth?: number
  onReplyAdded: (reply: Comment, parentId: string) => void
}

export default function CommentTree({ comment, postId, depth = 0, onReplyAdded }: Props) {
  const user = useAuthStore((s) => s.user)
  const [replying, setReplying] = useState(false)
  const [replyText, setReplyText] = useState('')

  const submitReply = async () => {
    if (!replyText.trim()) return
    const res = await api.post(`/comments/${postId}`, {
      content: replyText,
      parent_id: comment.id,
    })
    onReplyAdded(res.data, comment.id)
    setReplyText('')
    setReplying(false)
  }

  return (
    <div className={`${depth > 0 ? 'ml-4 border-l-2 border-gray-100 pl-3' : ''} mt-3`}>
      <div className="bg-white rounded-lg p-3 border border-gray-100">
        <div className="text-xs text-gray-500 mb-1">
          {comment.author?.username ?? 'unknown'} · {new Date(comment.created_at).toLocaleDateString()}
        </div>
        <p className="text-sm text-gray-800">{comment.content}</p>
        {user && (
          <button
            onClick={() => setReplying(!replying)}
            className="text-xs text-gray-400 hover:text-brand-600 mt-1"
          >
            Reply
          </button>
        )}
        {replying && (
          <div className="mt-2 flex gap-2">
            <input
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Write a reply..."
              className="flex-1 text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-brand-500"
            />
            <button onClick={submitReply} className="text-sm bg-brand-600 text-white px-3 py-1 rounded hover:bg-brand-700">
              Post
            </button>
          </div>
        )}
      </div>
      {comment.replies?.map((reply) => (
        <CommentTree
          key={reply.id}
          comment={reply}
          postId={postId}
          depth={depth + 1}
          onReplyAdded={onReplyAdded}
        />
      ))}
    </div>
  )
}
