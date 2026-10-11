import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../lib/api'
import type { Community } from '../types'
import { useAuthStore } from '../store/authStore'

export default function CommunitiesPage() {
  const [communities, setCommunities] = useState<Community[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const user = useAuthStore((state) => state.user)
  const [joined, setJoined] = useState<Record<string, boolean>>({})
  const [joining, setJoining] = useState<string | null>(null)
  const [joinError, setJoinError] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    api.get<Community[]>('/communities/')
      .then(({ data }) => { if (active) setCommunities(Array.isArray(data) ? data : []) })
      .catch(() => { if (active) setError('Could not load communities. Check your connection and try again.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  async function joinCommunity(id: string) {
    if (!user) { setJoinError('Please log in to join a community.'); return }
    setJoining(id); setJoinError('')
    try {
      const response = await api.post(`/communities/${id}/join`)
      if (response.data?.is_member) setJoined((prev) => ({ ...prev, [id]: true }))
    } catch { setJoinError('Could not join this community. Please try again.') }
    finally { setJoining(null) }
  }

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return communities
    return communities.filter((community) =>
      community.name.toLowerCase().includes(needle) ||
      (community.description || '').toLowerCase().includes(needle)
    )
  }, [communities, query])

  return (
    <main className="mx-auto max-w-6xl">
      <header className="mb-7 rounded-3xl bg-gradient-to-r from-slate-950 via-blue-950 to-blue-700 px-6 py-8 text-white sm:px-9 sm:py-10">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-200">Find your people</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">Explore communities</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-100 sm:text-base">Discover spaces for your interests, ask questions, share what you know, and build meaningful conversations.</p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <label className="flex min-w-0 flex-1 items-center gap-3 rounded-xl bg-white px-4 py-3 text-slate-500 shadow-sm">
            <span aria-hidden="true">⌕</span>
            <input aria-label="Search communities" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name or topic…" className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400" />
          </label>
          <Link to="/create-community" className="inline-flex items-center justify-center rounded-xl bg-white px-5 py-3 text-sm font-bold text-blue-800 transition hover:bg-blue-50">＋ Create community</Link>
        </div>
      </header>

      {joinError && <p role="alert" className="mb-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{joinError}</p>}
      <div className="mb-4 flex items-end justify-between gap-3">
        <div><h2 className="text-xl font-extrabold text-slate-900">All communities</h2><p className="mt-1 text-sm text-slate-500">{loading ? 'Loading spaces…' : `${filtered.length} ${filtered.length === 1 ? 'community' : 'communities'} to explore`}</p></div>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Loading communities">{[1, 2, 3, 4, 5, 6].map((n) => <div key={n} className="h-44 animate-pulse rounded-2xl border border-slate-200 bg-white p-5"><div className="h-10 w-10 rounded-xl bg-slate-200"/><div className="mt-4 h-4 w-2/3 rounded bg-slate-200"/><div className="mt-3 h-3 w-full rounded bg-slate-100"/><div className="mt-2 h-3 w-4/5 rounded bg-slate-100"/></div>)}</div>
      ) : error ? (
        <div role="alert" className="rounded-2xl border border-rose-200 bg-white p-8 text-center"><p className="font-semibold text-slate-900">Unable to load communities</p><p className="mt-2 text-sm text-slate-500">{error}</p><button onClick={() => window.location.reload()} className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Try again</button></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-2xl text-blue-700">✦</div><h3 className="mt-4 text-lg font-bold text-slate-900">{query ? 'No matching communities' : 'Be the first to build a space'}</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">{query ? 'Try a different name or topic.' : 'Create a community around your interests and invite others to join the conversation.'}</p>{!query && <Link to="/create-community" className="mt-5 inline-flex rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700">Create the first community</Link>}</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{filtered.map((community) => <article key={community.id} className="group flex min-h-48 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"><div className="flex items-start gap-3"><div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-blue-50 text-lg font-extrabold text-blue-700">{community.banner_url ? <img src={community.banner_url} alt="" className="h-full w-full object-cover"/> : community.name.slice(0, 1).toUpperCase()}</div><div className="min-w-0 flex-1"><h3 className="truncate font-bold text-slate-900 group-hover:text-blue-700">c/{community.name}</h3><p className="mt-1 text-xs text-slate-500">{community.member_count ?? 0} members</p></div></div><p className="mt-4 line-clamp-3 flex-1 text-sm leading-6 text-slate-600">{community.description || 'A space to share ideas, ask questions, and connect with people who share your interests.'}</p><div className="mt-5 grid grid-cols-2 gap-2"><Link to={`/c/${encodeURIComponent(community.name)}`} className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700">View</Link><button type="button" onClick={() => void joinCommunity(community.id)} disabled={joining === community.id || joined[community.id]} className="rounded-xl bg-blue-600 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-default disabled:bg-blue-100 disabled:text-blue-700">{joining === community.id ? 'Joining…' : joined[community.id] ? 'Joined' : 'Join'}</button></div></article>)}</div>
      )}
    </main>
  )
}
