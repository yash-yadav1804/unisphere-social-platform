import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import api from '../lib/api'
import type { Post, Community, User } from '../types'
import PostCard from '../components/ui/PostCard'
import { useAuthStore } from '../store/authStore'

type SearchTab = 'posts' | 'communities' | 'people'

export default function SearchPage() {
  const [searchParams] = useSearchParams()
  const q = searchParams.get('q') || ''
  const [posts, setPosts] = useState<Post[]>([])
  const [communities, setCommunities] = useState<Community[]>([])
  const [people, setPeople] = useState<User[]>([])
  const [tab, setTab] = useState<SearchTab>('posts')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const currentUser = useAuthStore((state) => state.user)
  const [followStates, setFollowStates] = useState<Record<string, boolean>>({})
  const [followBusy, setFollowBusy] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    const requests = q.trim()
      ? Promise.all([
          api.get<Post[]>(`/search/posts?q=${encodeURIComponent(q)}`),
          api.get<Community[]>(`/search/communities?q=${encodeURIComponent(q)}`),
          api.get<User[]>(`/search/users?q=${encodeURIComponent(q)}`),
        ]).then(([pRes, cRes, uRes]) => ({ posts: pRes.data, communities: cRes.data, people: uRes.data }))
      : api.get<Community[]>('/communities/').then((cRes) => ({ posts: [] as Post[], communities: cRes.data, people: [] as User[] }))
    requests.then((data) => {
      if (cancelled) return
      setPosts(data.posts)
      setCommunities(data.communities)
      setPeople(data.people)
      if (currentUser) {
        Promise.all(data.people.filter(person => person.id !== currentUser.id).map(async person => {
          try { const status = await api.get<{is_following:boolean}>(`/users/${encodeURIComponent(person.username)}/follow-status`); return [person.id, status.data.is_following] as const }
          catch { return [person.id, false] as const }
        })).then(entries => { if (!cancelled) setFollowStates(Object.fromEntries(entries)) })
      }
      if (!q.trim()) setTab('communities')
    }).catch(() => {
      if (!cancelled) setError('Search could not be completed. Please try again.')
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [q, currentUser?.id])

  async function toggleFollow(person: User) {
    if (!currentUser || followBusy) return
    setFollowBusy(person.id)
    try {
      if (followStates[person.id]) await api.delete(`/users/${encodeURIComponent(person.username)}/follow`)
      else await api.post(`/users/${encodeURIComponent(person.username)}/follow`)
      setFollowStates(previous => ({ ...previous, [person.id]: !previous[person.id] }))
    } catch { setError('Could not update follow status. Please try again.') }
    finally { setFollowBusy(null) }
  }

  const tabs: SearchTab[] = ['posts', 'communities', 'people']
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-1 text-xl font-bold text-gray-900">{q ? `Results for “${q}”` : 'Search Unisphere'}</h1>
      <p className="mb-5 text-sm text-gray-500">Discover discussions, communities and people.</p>
      <div className="mb-5 flex flex-wrap gap-2">
        {tabs.map((item) => <button key={item} type="button" onClick={() => setTab(item)} aria-pressed={tab === item} className={`rounded-full px-4 py-2 text-sm font-medium transition ${tab === item ? 'bg-brand-600 text-white' : 'border border-gray-200 bg-white text-gray-600 hover:border-brand-400'}`}>{item === 'people' ? `People${people.length ? ` (${people.length})` : ''}` : `${item.charAt(0).toUpperCase()}${item.slice(1)}`}</button>)}
      </div>
      {loading && <p className="py-6 text-sm text-gray-500">Searching…</p>}
      {error && <p role="alert" className="rounded-xl border border-red-100 bg-white p-4 text-sm text-red-600">{error}</p>}
      {!loading && !error && tab === 'posts' && <div className="space-y-3">{posts.map((post) => <PostCard key={post.id} post={post} />)}{q && posts.length === 0 && <p className="rounded-xl border border-gray-200 bg-white p-5 text-sm text-gray-500">No posts found.</p>}</div>}
      {!loading && !error && tab === 'communities' && <div className="space-y-3">{communities.map((community) => <Link key={community.id} to={`/c/${encodeURIComponent(community.name)}`} className="block rounded-xl border border-gray-200 bg-white p-4 transition hover:border-brand-400"><div className="font-semibold text-gray-900">c/{community.name}</div>{community.description && <p className="mt-1 text-sm text-gray-600">{community.description}</p>}</Link>)}{communities.length === 0 && <p className="rounded-xl border border-gray-200 bg-white p-5 text-sm text-gray-500">No communities found.</p>}</div>}
      {!loading && !error && tab === 'people' && <div className="space-y-3">{people.map((person) => <div key={person.id} className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white p-4"><Link to={`/u/${encodeURIComponent(person.username)}`} className="flex min-w-0 items-center gap-3 hover:opacity-80"><div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-50 font-semibold text-blue-700">{person.avatar_url ? <img src={person.avatar_url} alt="" className="h-full w-full object-cover" /> : person.username.charAt(0).toUpperCase()}</div><div className="min-w-0"><p className="truncate font-semibold text-gray-900">{person.username}</p><p className="text-xs text-gray-500">View profile</p></div></Link><div className="flex shrink-0 gap-2">{currentUser && currentUser.id !== person.id && <button type="button" disabled={followBusy === person.id} onClick={() => void toggleFollow(person)} className={`rounded-lg px-3 py-2 text-sm font-semibold ${followStates[person.id] ? 'border border-gray-200 text-gray-700 hover:bg-gray-50' : 'bg-blue-600 text-white hover:bg-blue-700'} disabled:opacity-50`}>{followBusy === person.id ? '…' : followStates[person.id] ? 'Following' : 'Follow'}</button>}<Link to={`/messages/${person.id}`} className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700">Message</Link></div></div>)}{q && people.length === 0 && <p className="rounded-xl border border-gray-200 bg-white p-5 text-sm text-gray-500">No people found.</p>}</div>}
    </div>
  )
}
