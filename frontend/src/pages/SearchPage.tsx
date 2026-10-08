import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import api from '../lib/api'
import { Post, Community } from '../types'
import PostCard from '../components/ui/PostCard'

export default function SearchPage() {
  const [searchParams] = useSearchParams()
  const q = searchParams.get('q') || ''
  const [posts, setPosts] = useState<Post[]>([])
  const [communities, setCommunities] = useState<Community[]>([])
  const [tab, setTab] = useState<'posts' | 'communities'>('posts')

  useEffect(() => {
    if (!q) return
    Promise.all([
      api.get(`/search/posts?q=${encodeURIComponent(q)}`),
      api.get(`/search/communities?q=${encodeURIComponent(q)}`),
    ]).then(([pRes, cRes]) => {
      setPosts(pRes.data)
      setCommunities(cRes.data)
    })
  }, [q])

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-lg font-bold text-gray-900 mb-4">
        {q ? `Results for "${q}"` : 'Search'}
      </h1>

      <div className="flex gap-2 mb-4">
        {(['posts', 'communities'] as const).map((t) => (
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
          {posts.length === 0 && q && <p className="text-gray-500 text-sm">No posts found.</p>}
        </div>
      )}

      {tab === 'communities' && (
        <div className="space-y-3">
          {communities.map((c) => (
            <Link key={c.id} to={`/c/${c.name}`} className="block bg-white rounded-xl border border-gray-200 p-4 hover:border-brand-400 transition-colors">
              <div className="font-semibold text-gray-900">c/{c.name}</div>
              {c.description && <p className="text-sm text-gray-600 mt-1">{c.description}</p>}
            </Link>
          ))}
          {communities.length === 0 && q && <p className="text-gray-500 text-sm">No communities found.</p>}
        </div>
      )}
    </div>
  )
}
