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
  const [myRole, setMyRole] = useState<string | null>(null)
  const [members, setMembers] = useState<Array<{ user_id: string; username: string; role: string }>>([])
  const [membershipLoading, setMembershipLoading] = useState(false)
  const [actionError, setActionError] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const fetchCommunity = async () => {
      try {
        setError(null)
        const cRes = await api.get(`/communities/${name}`)
        if (cancelled) return
        setCommunity(cRes.data)
        const requests: Promise<unknown>[] = [
          api.get(`/posts/community/${cRes.data.id}?sort=${sort}`).then((response) => {
            if (!cancelled) setPosts(response.data)
          }),
        ]
        if (user) {
          requests.push(api.get(`/communities/${cRes.data.id}/membership`).then(async (response) => {
            if (!cancelled) {
              setJoined(Boolean(response.data.is_member))
              setMyRole(response.data.role ?? null)
            }
            if (!cancelled && response.data.role === 'admin') {
              const memberResponse = await api.get(`/communities/${cRes.data.id}/members`)
              if (!cancelled) setMembers(memberResponse.data)
            }
          }))
        } else {
          setJoined(false)
          setMyRole(null)
          setMembers([])
        }
        await Promise.all(requests)
      } catch {
        if (!cancelled) setError('Failed to load community.')
      }
    }
    void fetchCommunity()
    return () => { cancelled = true }
  }, [name, sort, user])

  const toggleJoin = async () => {
    if (!community || membershipLoading) return
    setMembershipLoading(true)
    setActionError('')
    try {
      if (joined) {
        await api.post(`/communities/${community.id}/leave`)
        setJoined(false)
        setMyRole(null)
        setMembers([])
        setCommunity((current) => current ? { ...current, member_count: Math.max(0, (current.member_count ?? 0) - 1) } : current)
      } else {
        await api.post(`/communities/${community.id}/join`)
        setJoined(true)
        setMyRole('member')
        setCommunity((current) => current ? { ...current, member_count: (current.member_count ?? 0) + 1 } : current)
      }
    } catch {
      setActionError('Could not update membership. Please try again.')
    } finally { setMembershipLoading(false) }
  }

  if (error) return <p className="text-red-500 text-sm">{error}</p>
  if (!community) return <p className="text-gray-500">Loading...</p>

  return (
    <div className="flex flex-col gap-6 md:flex-row">
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

      <aside className="w-full shrink-0 space-y-4 md:w-64">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="font-bold text-gray-900 mb-1">c/{community.name}</h2>
          <p className="mb-2 text-xs text-gray-500">{community.member_count ?? 0} members</p>
          {community.description && <p className="text-sm text-gray-600 mb-3">{community.description}</p>}
          {user && (
            <>
              <button
                onClick={toggleJoin}
                disabled={membershipLoading || myRole === 'admin'}
                className={`w-full py-2 rounded-lg text-sm font-medium mb-2 disabled:cursor-not-allowed disabled:opacity-60 ${joined ? 'border border-brand-600 text-brand-600 hover:bg-brand-50' : 'bg-brand-600 text-white hover:bg-brand-700'}`}
              >
                {membershipLoading ? 'Please wait…' : myRole === 'admin' ? 'Community admin' : joined ? 'Joined' : 'Join'}
              </button>
              {actionError && <p role="alert" className="mb-2 text-xs text-red-600">{actionError}</p>}
              <Link
                to={`/submit/${community.id}`}
                className="block text-center w-full py-2 rounded-lg text-sm font-medium border border-gray-200 hover:border-brand-400 text-gray-700"
              >
                Create post
              </Link>
            </>
          )}
        </div>
        {user && myRole === 'admin' && (
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <h3 className="mb-2 font-bold text-gray-900">Community moderation</h3>
            <p className="mb-3 text-xs text-gray-500">Promote trusted members to moderators.</p>
            <div className="space-y-3">
              {members.filter((member) => member.role !== 'admin').map((member) => (
                <div key={member.user_id} className="flex items-center justify-between gap-2">
                  <div className="min-w-0"><p className="truncate text-sm font-medium text-gray-800">u/{member.username}</p><p className="text-xs text-gray-500">{member.role}</p></div>
                  <button type="button" onClick={async () => { try { const nextRole = member.role === 'moderator' ? 'member' : 'moderator'; await api.patch(`/communities/${community.id}/members/${member.user_id}/role?role=${nextRole}`); setMembers((current) => current.map((item) => item.user_id === member.user_id ? { ...item, role: nextRole } : item)) } catch { setActionError('Could not update member role.') } }} className="shrink-0 rounded-lg border border-gray-200 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50">{member.role === 'moderator' ? 'Remove mod' : 'Make mod'}</button>
                </div>
              ))}
              {members.length <= 1 && <p className="text-xs text-gray-500">No other members yet.</p>}
            </div>
          </div>
        )}
      </aside>
    </div>
  )
}
