import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../lib/api'
import type { NotificationItem } from '../types'

export default function NotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.get<NotificationItem[]>('/notifications/')
      setItems(response.data)
    } catch { setError('Could not load notifications. Please try again.') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  const markRead = async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/read`)
      setItems((current) => current.map((item) => item.id === id ? { ...item, is_read: true } : item))
      window.dispatchEvent(new Event('notifications-updated'))
    } catch { setError('Could not update notification status.') }
  }

  const markAllRead = async () => {
    try {
      await api.post('/notifications/read-all')
      setItems((current) => current.map((item) => ({ ...item, is_read: true })))
      window.dispatchEvent(new Event('notifications-updated'))
    } catch { setError('Could not mark notifications as read.') }
  }

  return (
    <section className="mx-auto max-w-3xl space-y-4">
      <header className="flex items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold text-slate-900">Notifications</h1><p className="mt-1 text-sm text-slate-500">Updates about follows, comments and replies.</p></div>
        {items.some((item) => !item.is_read) && <button type="button" onClick={() => void markAllRead()} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Mark all read</button>}
      </header>
      {loading && <p className="text-sm text-slate-500">Loading notifications…</p>}
      {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
      {!loading && !error && items.length === 0 && <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">You're all caught up.</div>}
      <div className="space-y-2">
        {items.map((item) => {
          const content = <div className={`flex items-start justify-between gap-4 rounded-xl border p-4 ${item.is_read ? 'border-slate-200 bg-white' : 'border-blue-200 bg-blue-50/70'}`}><div><p className="text-sm font-medium text-slate-800">{item.message}</p><p className="mt-1 text-xs text-slate-500">{new Date(item.created_at).toLocaleString()}</p></div>{!item.is_read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-600" aria-label="Unread" />}</div>
          return <div key={item.id}>{item.post_id ? <Link to={`/post/${item.post_id}`} onClick={() => { if (!item.is_read) void markRead(item.id) }} className="block">{content}</Link> : item.actor_username ? <Link to={`/u/${item.actor_username}`} onClick={() => { if (!item.is_read) void markRead(item.id) }} className="block">{content}</Link> : <button type="button" className="block w-full text-left" onClick={() => { if (!item.is_read) void markRead(item.id) }}>{content}</button>}</div>
        })}
      </div>
    </section>
  )
}
