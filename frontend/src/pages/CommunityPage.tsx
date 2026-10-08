import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import api from '../lib/api'
import { Community, Post } from '../types'
import PostCard from '../components/ui/PostCard'
import { useAuthStore } from '../store/authStore'

export default function CommunityPage() {
  const { name } = useParams<{ name: string }>()
  const user = useAuthStore((s) => s.user)
  const [community, setCommunity] = useState<Community | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [sort, setSort] = useState<'new' | 'top'>('new')
  const [joined, setJoined] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetch = async () => {
      try {
        const [cRes, pRes] = await Promise.all([
          api.get(`/communities/${name}`),
          api.get(`/posts/community/${name}?sort=${sort}`),
        ])
        setCommunity(cRes.data)
        setPosts(pRes.data)
      } catch {
        setError('Failed to load community.')
      }
    }
    fetch()
  }, [name, sort])

  const toggleJoin = async () => {
    if (!community) return
    if (joined) {
      await api.post(`/communities/${community.id}/leave`)
    } else {
      await api.post(`/communities/${community.id}/join`)
    }
    setJoined(!joined)
  }

  if (error) return <p className="text-red-500 text-sm">{error}</p>
  if (!community) return <p className="text-gray-500">Loading...</p>

  return (
    <div className="flex gap-6">
      <div className="flex-1 min-w-0">
        <div className="flex gap-2 mb-4">
          {['new', 'top'].map((s) => (
            <button
              key={s}
              onClick={() => setSort(s as 'new' | 'top')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium ${sort === s ? 'bg-brand-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-brand-400'}`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <div className="space-y-3">
          {posts.map((post) => <PostCard key={post.id} post={post} />)}
          {posts.length === 0 && <p className="text-gray-500 text-sm">No posts yet. Be the first!</p>}
        </div>
      </div>

      <aside className="w-64 shrink-0 hidden md:block space-y-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="font-bold text-gray-900 mb-1">c/{community.name}</h2>
          {community.description && <p className="text-sm text-gray-600 mb-3">{community.description}</p>}
          {user && (
            <>
              <button
                onClick={toggleJoin}
                className={`w-full py-2 rounded-lg text-sm font-medium mb-2 ${joined ? 'border border-brand-600 text-brand-600 hover:bg-brand-50' : 'bg-brand-600 text-white hover:bg-brand-700'}`}
              >
                {joined ? 'Joined' : 'Join'}
              </button>
              <Link
                to={`/submit/${community.id}`}
                className="block text-center w-full py-2 rounded-lg text-sm font-medium border border-gray-200 hover:border-brand-400 text-gray-700"
              >
                Create post
              </Link>
            </>
          )}
        </div>
      </aside>
    </div>
  )
}
