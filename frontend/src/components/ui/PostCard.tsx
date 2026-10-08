import { Link } from 'react-router-dom'
import { Post } from '../../types'
import api from '../../lib/api'
import { useAuthStore } from '../../store/authStore'

interface Props {
  post: Post
  onVote?: (postId: string, value: number) => void
}

export default function PostCard({ post, onVote }: Props) {
  const user = useAuthStore((s) => s.user)

  const vote = async (value: number) => {
    if (!user) return
    await api.post('/posts/vote', { target_id: post.id, target_type: 'post', value })
    onVote?.(post.id, value)
  }

  const score = post.upvotes - post.downvotes

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
      <div className="flex gap-3">
        <div className="flex flex-col items-center gap-1 shrink-0">
          <button onClick={() => vote(1)} className="text-gray-400 hover:text-brand-600 text-lg leading-none">▲</button>
          <span className="text-sm font-medium text-gray-700">{score}</span>
          <button onClick={() => vote(-1)} className="text-gray-400 hover:text-red-500 text-lg leading-none">▼</button>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs text-gray-500 mb-1">
            Posted by <Link to={`/u/${post.author?.username}`} className="hover:underline">{post.author?.username ?? 'unknown'}</Link>
          </div>
          <Link to={`/post/${post.id}`} className="font-medium text-gray-900 hover:text-brand-600 line-clamp-2">
            {post.title}
          </Link>
          {post.content && (
            <p className="text-sm text-gray-600 mt-1 line-clamp-2">{post.content}</p>
          )}
        </div>
      </div>
    </div>
  )
}
