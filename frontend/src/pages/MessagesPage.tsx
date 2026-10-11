import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import api from '../lib/api'
import { Message, User } from '../types'
import { useAuthStore } from '../store/authStore'
import { useWebSocket } from '../hooks/useWebSocket'

export default function MessagesPage() {
  const { userId } = useParams<{ userId?: string }>()
  const navigate = useNavigate()
  const currentUser = useAuthStore((s) => s.user)
  const [messages, setMessages] = useState<Message[]>([])
  const [conversations, setConversations] = useState<Message[]>([])
  const [usernames, setUsernames] = useState<Record<string, string>>({})
  const [activeUser, setActiveUser] = useState<User | null>(null)
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const { sendMessage } = useWebSocket((msg) => {
    if (
      activeUser &&
      (msg.sender_id === activeUser.id || msg.receiver_id === activeUser.id)
    ) {
      setMessages((prev) => [...prev, msg])
    }
  })

  useEffect(() => {
    api.get('/messages/conversations')
      .then((res) => {
        setConversations(res.data)
        const otherIds = [...new Set<string>(
          res.data.map((m: Message) =>
            m.sender_id === currentUser?.id ? m.receiver_id : m.sender_id
          )
        )]
        Promise.all(otherIds.map((id) => api.get(`/users/${id}`)))
          .then((results) => {
            const map: Record<string, string> = {}
            results.forEach((r) => { map[r.data.id] = r.data.username })
            setUsernames(map)
          })
          .catch(() => {})
      })
      .catch(() => setError('Failed to load conversations.'))
  }, [currentUser?.id])

  useEffect(() => {
    if (!userId) {
      setActiveUser(null)
      setMessages([])
      return
    }
    setActiveUser(null)
    setMessages([])
    setError(null)
    setLoadingHistory(true)
    Promise.all([
      api.get(`/users/${userId}`),
      api.get(`/messages/history/${userId}`)
    ])
      .then(([userRes, msgRes]) => {
        setActiveUser(userRes.data)
        setMessages(msgRes.data)
      })
      .catch(() => setError('Failed to load messages.'))
      .finally(() => setLoadingHistory(false))
  }, [userId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = () => {
    if (!input.trim() || !activeUser) return
    setSending(true)
    const sent = sendMessage(activeUser.id, input.trim())
    if (!sent) {
      setError('Connecting to chat… Please wait a moment and try sending again.')
      setSending(false)
      return
    }
    setError(null)
    setInput('')
    setSending(false)
  }

  const uniqueUsers = Array.from(
    new Map(conversations.map((m) => {
      const otherId = m.sender_id === currentUser?.id ? m.receiver_id : m.sender_id
      return [otherId, m]
    })).values()
  )

  return (
    <div className="flex h-[calc(100vh-80px)] gap-0 bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="w-64 border-r border-gray-200 overflow-y-auto shrink-0">
        <div className="p-3 border-b border-gray-100">
          <h2 className="font-semibold text-sm text-gray-900">Messages</h2>
        </div>
        {error && !userId && <p className="text-xs text-red-500 p-4">{error}</p>}
        {uniqueUsers.length === 0 && !error && (
          <p className="text-xs text-gray-400 p-4">No conversations yet.</p>
        )}
        {uniqueUsers.map((m) => {
          const otherId = m.sender_id === currentUser?.id ? m.receiver_id : m.sender_id
          return (
            <button
              key={otherId}
              onClick={() => navigate(`/messages/${otherId}`)}
              className={`w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-50 text-sm ${activeUser?.id === otherId ? 'bg-brand-50' : ''}`}
            >
              <span className="flex items-center gap-2 font-medium text-gray-800"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-700">{(usernames[otherId] ?? '?').charAt(0).toUpperCase()}</span>{usernames[otherId] ?? otherId.slice(0, 8) + '...'}</span>
              <p className="text-xs text-gray-500 truncate">{m.content}</p>
            </button>
          )
        })}
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        {!activeUser ? (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
            {error ?? 'Select a conversation'}
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-3"><div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-blue-50 font-bold text-blue-700">{activeUser.avatar_url ? <img src={activeUser.avatar_url} alt="" className="h-full w-full object-cover"/> : activeUser.username.charAt(0).toUpperCase()}</div><div className="min-w-0"><Link to={`/u/${encodeURIComponent(activeUser.username)}`} className="font-semibold text-gray-900 hover:text-blue-700">{activeUser.username}</Link><p className="text-xs text-gray-500">Direct message</p></div></div>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
              {error && <p className="text-xs text-red-500 text-center">{error}</p>}
              {loadingHistory && <p className="py-3 text-center text-xs text-gray-400">Loading message history…</p>}
              {!loadingHistory && messages.length === 0 && <p className="py-8 text-center text-sm text-gray-400">No messages yet. Say hello 👋</p>}
              {messages.map((msg) => {
                const isMine = msg.sender_id === currentUser?.id
                return (
                  <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm sm:max-w-md ${isMine ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-800'}`}>
                      <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                      <p className={`mt-1 text-right text-[10px] ${isMine ? 'text-blue-100' : 'text-gray-400'}`}>{new Date(msg.sent_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>
                )
              })}
              <div ref={bottomRef} />
            </div>
            <div className="px-4 py-3 border-t border-gray-100 flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Type a message..."
                className="flex-1 border border-gray-200 rounded-full px-4 py-2 text-sm focus:outline-none focus:border-brand-500"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || sending}
                className="bg-brand-600 text-white px-4 py-2 rounded-full text-sm hover:bg-brand-700 disabled:opacity-50"
              >
                {sending ? 'Sending…' : 'Send'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
