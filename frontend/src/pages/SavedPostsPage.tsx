import { useEffect, useState } from 'react'
import api from '../lib/api'
import type { Post } from '../types'
import PostCard from '../components/ui/PostCard'

export default function SavedPostsPage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    api.get<Post[]>('/saved-posts/')
      .then((response) => { if (!cancelled) setPosts(response.data) })
      .catch(() => { if (!cancelled) setError('Could not load saved posts. Please try again.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  return (
    <section className="mx-auto max-w-3xl space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Saved posts</h1>
        <p className="mt-1 text-sm text-slate-500">Your bookmarked discussions in one place.</p>
      </header>
      {loading && <p className="text-sm text-slate-500">Loading saved posts…</p>}
      {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
      {!loading && !error && posts.length === 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <p className="font-semibold text-slate-800">No saved posts yet</p>
          <p className="mt-1 text-sm text-slate-500">Use the Save button on a discussion to keep it here.</p>
        </div>
      )}
      <div className="space-y-3">{posts.map((post) => <PostCard key={post.id} post={post} />)}</div>
    </section>
  )
}
