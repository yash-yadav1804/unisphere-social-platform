
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import api from '../lib/api'
import type { Message, User } from '../types'
import { useAuthStore } from '../store/authStore'
import { useWebSocket } from '../hooks/useWebSocket'

function Avatar({
  username,
  avatarUrl,
  size = 'normal',
}: {
  username: string
  avatarUrl?: string | null
  size?: 'small' | 'normal'
}) {
  const [imageFailed, setImageFailed] = useState(false)

  useEffect(() => {
    setImageFailed(false)
  }, [avatarUrl])

  const sizeClass = size === 'small' ? 'h-9 w-9' : 'h-10 w-10'

  return (
    <div
      className={`${sizeClass} flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-50 font-bold text-blue-700`}
    >
      {avatarUrl && !imageFailed ? (
        <img
          src={avatarUrl}
          alt={`${username} avatar`}
          className="h-full w-full object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        username.charAt(0).toUpperCase()
      )}
    </div>
  )
}

export default function MessagesPage() {
  const { userId } = useParams<{ userId?: string }>()
  const navigate = useNavigate()
  const currentUser = useAuthStore((state) => state.user)

  const [messages, setMessages] = useState<Message[]>([])
  const [conversations, setConversations] = useState<Message[]>([])
  const [users, setUsers] = useState<Record<string, User>>({})
  const [activeUser, setActiveUser] = useState<User | null>(null)
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [sending, setSending] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)
  const activeUserRef = useRef<User | null>(null)
  const currentUserIdRef = useRef<string | undefined>(currentUser?.id)

  useEffect(() => {
    activeUserRef.current = activeUser
  }, [activeUser])

  useEffect(() => {
    currentUserIdRef.current = currentUser?.id
  }, [currentUser?.id])

  const addMessageOnce = useCallback((message: Message) => {
    setMessages((previous) => {
      if (previous.some((item) => item.id === message.id)) {
        return previous
      }

      return [...previous, message].sort(
        (a, b) =>
          new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime(),
      )
    })

    setConversations((previous) => {
      const withoutMessage = previous.filter(
        (item) => item.id !== message.id,
      )
      return [message, ...withoutMessage]
    })
  }, [])

  const refreshHistory = useCallback(async () => {
    const selectedUser = activeUserRef.current
    const currentId = currentUserIdRef.current

    if (!selectedUser || !currentId) return

    try {
      const response = await api.get<Message[]>(
        `/messages/history/${encodeURIComponent(selectedUser.id)}`,
      )

      // Do not overwrite history if the user switched conversations
      // while the request was running.
      if (activeUserRef.current?.id !== selectedUser.id) return

      setMessages(response.data)
    } catch {
      // Keep the existing messages visible if refresh temporarily fails.
    }
  }, [])

  const handleSocketError = useCallback((message: string) => {
    setError(message)
  }, [])

  const handleSocketMessage = useCallback(
    (message: Message) => {
      const selectedUser = activeUserRef.current
      const currentId = currentUserIdRef.current

      if (!selectedUser || !currentId) return

      const belongsToSelectedConversation =
        (message.sender_id === currentId &&
          message.receiver_id === selectedUser.id) ||
        (message.sender_id === selectedUser.id &&
          message.receiver_id === currentId)

      if (belongsToSelectedConversation) {
        addMessageOnce(message)
        setError(null)
      }

      // Refreshing the conversation list also updates the latest message.
      setConversations((previous) => {
        const withoutMessage = previous.filter(
          (item) => item.id !== message.id,
        )
        return [message, ...withoutMessage]
      })
    },
    [addMessageOnce],
  )

  const { sendMessage } = useWebSocket({
    onMessage: handleSocketMessage,
    onConnected: refreshHistory,
    onError: handleSocketError,
  })

  useEffect(() => {
    let cancelled = false

    async function loadConversations() {
      try {
        const response = await api.get<Message[]>('/messages/conversations')
        if (cancelled) return

        setConversations(response.data)

        const currentId = currentUser?.id
        const otherIds = [
          ...new Set(
            response.data.map((message) =>
              message.sender_id === currentId
                ? message.receiver_id
                : message.sender_id,
            ),
          ),
        ]

        const results = await Promise.allSettled(
          otherIds.map((id) => api.get<User>(`/users/${id}`)),
        )

        if (cancelled) return

        setUsers((previous) => {
          const next = { ...previous }

          results.forEach((result) => {
            if (result.status === 'fulfilled') {
              next[result.value.data.id] = result.value.data
            }
          })

          return next
        })
      } catch {
        if (!cancelled) {
          setError('Failed to load conversations.')
        }
      }
    }

    void loadConversations()

    return () => {
      cancelled = true
    }
  }, [currentUser?.id])

  useEffect(() => {
    let cancelled = false

    if (!userId) {
      setActiveUser(null)
      activeUserRef.current = null
      setMessages([])
      setError(null)
      setLoadingHistory(false)
      return
    }

    setActiveUser(null)
    activeUserRef.current = null
    setMessages([])
    setError(null)
    setLoadingHistory(true)

    async function loadSelectedConversation() {
      try {
        const [userResponse, messageResponse] = await Promise.all([
          api.get<User>(`/users/${encodeURIComponent(userId!)}`),
          api.get<Message[]>(
            `/messages/history/${encodeURIComponent(userId!)}`,
          ),
        ])

        if (cancelled) return

        const selectedUser = userResponse.data

        if (selectedUser.id === currentUser?.id) {
          setError('You cannot open a conversation with yourself.')
          return
        }

        activeUserRef.current = selectedUser
        setActiveUser(selectedUser)
        setUsers((previous) => ({
          ...previous,
          [selectedUser.id]: selectedUser,
        }))
        setMessages(messageResponse.data)
      } catch {
        if (!cancelled) {
          setError('Failed to load messages. Please try again.')
        }
      } finally {
        if (!cancelled) setLoadingHistory(false)
      }
    }

    void loadSelectedConversation()

    return () => {
      cancelled = true
    }
  }, [userId, currentUser?.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = useCallback(() => {
    const content = input.trim()
    const selectedUser = activeUserRef.current

    if (!content || !selectedUser || sending) return

    setSending(true)
    setError(null)

    const sent = sendMessage(selectedUser.id, content)

    if (!sent) {
      setError('Chat is reconnecting. Please wait and try again.')
      setSending(false)
      return
    }

    setInput('')
    setSending(false)
  }, [input, sending, sendMessage])

  const uniqueUsers = Array.from(
    new Map(
      conversations.map((message) => {
        const otherId =
          message.sender_id === currentUser?.id
            ? message.receiver_id
            : message.sender_id

        return [otherId, message] as const
      }),
    ).entries(),
  )

  return (
    <div className="flex h-[calc(100vh-80px)] min-h-[400px] overflow-hidden rounded-xl border border-gray-200 bg-white">
      <aside className="w-64 shrink-0 overflow-y-auto border-r border-gray-200">
        <div className="border-b border-gray-100 p-3">
          <h2 className="text-sm font-semibold text-gray-900">Messages</h2>
        </div>

        {error && !userId && (
          <p role="alert" className="p-4 text-xs text-red-500">
            {error}
          </p>
        )}

        {uniqueUsers.length === 0 && !error && (
          <p className="p-4 text-xs text-gray-400">No conversations yet.</p>
        )}

        {uniqueUsers.map(([otherId, message]) => {
          const person = users[otherId]
          const username = person?.username ?? otherId.slice(0, 8)

          return (
            <button
              key={otherId}
              type="button"
              onClick={() => navigate(`/messages/${otherId}`)}
              className={`w-full border-b border-gray-50 px-4 py-3 text-left text-sm hover:bg-gray-50 ${
                activeUser?.id === otherId ? 'bg-brand-50' : ''
              }`}
            >
              <span className="flex items-center gap-2 font-medium text-gray-800">
                <Avatar
                  username={username}
                  avatarUrl={person?.avatar_url}
                  size="small"
                />
                <span className="truncate">{username}</span>
              </span>
              <p className="truncate pl-11 text-xs text-gray-500">
                {message.content}
              </p>
            </button>
          )
        })}
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        {!activeUser ? (
          <div className="flex flex-1 items-center justify-center p-4 text-center text-sm text-gray-400">
            {loadingHistory
              ? 'Loading conversation…'
              : error || 'Select a conversation'}
          </div>
        ) : (
          <>
            <header className="flex items-center gap-3 border-b border-gray-100 px-4 py-3">
              <Avatar
                username={activeUser.username}
                avatarUrl={activeUser.avatar_url}
              />
              <div className="min-w-0">
                <Link
                  to={`/u/${encodeURIComponent(activeUser.username)}`}
                  className="font-semibold text-gray-900 hover:text-blue-700"
                >
                  {activeUser.username}
                </Link>
                <p className="text-xs text-gray-500">Direct message</p>
              </div>
            </header>

            <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
              {error && (
                <p role="alert" className="text-center text-xs text-red-500">
                  {error}
                </p>
              )}

              {loadingHistory && (
                <p className="py-3 text-center text-xs text-gray-400">
                  Loading message history…
                </p>
              )}

              {!loadingHistory && messages.length === 0 && (
                <p className="py-8 text-center text-sm text-gray-400">
                  No messages yet. Say hello 👋
                </p>
              )}

              {messages.map((message) => {
                const isMine = message.sender_id === currentUser?.id

                return (
                  <div
                    key={message.id}
                    className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm sm:max-w-md ${
                        isMine
                          ? 'bg-brand-600 text-white'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">
                        {message.content}
                      </p>
                      <p
                        className={`mt-1 text-right text-[10px] ${
                          isMine ? 'text-blue-100' : 'text-gray-400'
                        }`}
                      >
                        {new Date(message.sent_at).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                )
              })}

              <div ref={bottomRef} />
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault()
                handleSend()
              }}
              className="flex gap-2 border-t border-gray-100 px-4 py-3"
            >
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Type a message..."
                maxLength={5000}
                className="min-w-0 flex-1 rounded-full border border-gray-200 px-4 py-2 text-sm focus:border-brand-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!input.trim() || sending}
                className="rounded-full bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {sending ? 'Sending…' : 'Send'}
              </button>
            </form>
          </>
        )}
      </main>
    </div>
  )
}
