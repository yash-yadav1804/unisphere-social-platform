import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../lib/api'
import { Post, Community } from '../types'
import PostCard from '../components/ui/PostCard'

export default function HomePage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [communities, setCommunities] = useState<Community[]>([])
  const [sort, setSort] = useState<'new' | 'top'>('new')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const [feedRes, commRes] = await Promise.all([
          api.get(`/posts/feed?sort=${sort}`),
          api.get('/communities/'),
        ])
        setPosts(feedRes.data)
        setCommunities(commRes.data.slice(0, 8))
      } catch {
        setPosts([])
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [sort])

  return (
    <div className="flex gap-6">
      <div className="flex-1 min-w-0">
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setSort('new')}
            className={`px-4 py-1.5 rounded-full text-sm font-medium ${sort === 'new' ? 'bg-brand-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-brand-400'}`}
          >
            New
          </button>
          <button
            onClick={() => setSort('top')}
            className={`px-4 py-1.5 rounded-full text-sm font-medium ${sort === 'top' ? 'bg-brand-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-brand-400'}`}
          >
            Top
          </button>
        </div>

        {loading ? (
          <p className="text-gray-500 text-sm">Loading...</p>
        ) : posts.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <p className="text-gray-600 mb-3">Join some communities to see posts here.</p>
            <Link to="/search?q=" className="text-brand-600 hover:underline text-sm">Browse communities</Link>
          </div>
        ) : (
          <div className="space-y-3">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} onVote={(id, val) => {
                setPosts((prev) => prev.map((p) =>
                  p.id === id
                    ? { ...p, upvotes: val === 1 ? p.upvotes + 1 : p.upvotes, downvotes: val === -1 ? p.downvotes + 1 : p.downvotes }
                    : p
                ))
              }} />
            ))}
          </div>
        )}
      </div>

      <aside className="w-64 shrink-0 hidden md:block">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-900 mb-3 text-sm">Top communities</h3>
          <ul className="space-y-2">
            {communities.map((c) => (
              <li key={c.id}>
                <Link to={`/c/${c.name}`} className="text-sm text-brand-600 hover:underline">c/{c.name}</Link>
              </li>
            ))}
          </ul>
          <Link to="/create-community" className="block mt-4 text-center bg-brand-600 text-white text-sm py-2 rounded-lg hover:bg-brand-700">
            Create community
          </Link>
        </div>
      </aside>
    </div>
  )
}
