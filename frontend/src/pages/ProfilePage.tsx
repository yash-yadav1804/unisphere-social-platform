import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import api from '../lib/api'
import { User, Post, Comment } from '../types'
import PostCard from '../components/ui/PostCard'

type Tab = 'posts' | 'comments'

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>()
  const [user, setUser] = useState<User | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [comments, setComments] = useState<Comment[]>([])
  const [tab, setTab] = useState<Tab>('posts')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetch = async () => {
      try {
        const [uRes, pRes, cRes] = await Promise.all([
          api.get(`/users/${username}`),
          api.get(`/users/${username}/posts`),
          api.get(`/users/${username}/comments`),
        ])
        setUser(uRes.data)
        setPosts(pRes.data)
        setComments(cRes.data)
      } catch {
        setError('Failed to load profile.')
      }
    }
    fetch()
  }, [username])

  if (error) return <p className="text-red-500 text-sm">{error}</p>
  if (!user) return <p className="text-gray-500">Loading...</p>

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 font-bold text-lg">
            {user.username[0].toUpperCase()}
          </div>
          <div>
            <h1 className="font-bold text-gray-900">u/{user.username}</h1>
            <p className="text-xs text-gray-500">Joined {new Date(user.created_at).toLocaleDateString()}</p>
          </div>
        </div>
        {user.bio && <p className="text-sm text-gray-600 mt-3">{user.bio}</p>}
      </div>

      <div className="flex gap-2 mb-4">
        {(['posts', 'comments'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium ${tab === t ? 'bg-brand-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-brand-400'}`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'posts' && (
        <div className="space-y-3">
          {posts.map((p) => <PostCard key={p.id} post={p} />)}
          {posts.length === 0 && <p className="text-gray-500 text-sm">No posts yet.</p>}
        </div>
      )}

      {tab === 'comments' && (
        <div className="space-y-3">
          {comments.map((c) => (
            <div key={c.id} className="bg-white rounded-lg border border-gray-200 p-3">
              <p className="text-sm text-gray-800">{c.content}</p>
              <Link to={`/post/${c.post_id}`} className="text-xs text-brand-600 hover:underline mt-1 block">View post</Link>
            </div>
          ))}
          {comments.length === 0 && <p className="text-gray-500 text-sm">No comments yet.</p>}
        </div>
      )}
    </div>
  )
}
