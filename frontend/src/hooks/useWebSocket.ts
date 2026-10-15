
import { useCallback, useEffect, useRef } from 'react'
import type { Message } from '../types'

type ServerError = {
  type?: string
  detail?: string
}

type UseWebSocketOptions = {
  onMessage: (message: Message) => void
  onConnected?: () => void
  onError?: (message: string) => void
}

export function useWebSocket({
  onMessage,
  onConnected,
  onError,
}: UseWebSocketOptions) {
  const socketRef = useRef<WebSocket | null>(null)
  const onMessageRef = useRef(onMessage)
  const onConnectedRef = useRef(onConnected)
  const onErrorRef = useRef(onError)
  const reconnectTimerRef = useRef<number | null>(null)
  const reconnectAttemptRef = useRef(0)
  const mountedRef = useRef(false)

  useEffect(() => {
    onMessageRef.current = onMessage
    onConnectedRef.current = onConnected
    onErrorRef.current = onError
  }, [onMessage, onConnected, onError])

  const connect = useCallback(() => {
    if (!mountedRef.current) return

    const token = localStorage.getItem('access_token')

    if (!token) return

    const configuredUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8000'

    const wsBase = configuredUrl.replace(/\/+$/, '')

    const currentSocket = socketRef.current

    if (
      currentSocket &&
      (currentSocket.readyState === WebSocket.OPEN ||
        currentSocket.readyState === WebSocket.CONNECTING)
    ) {
      return
    }

    let socket: WebSocket

    try {
      const wsUrl = `${wsBase}/messages/ws/${encodeURIComponent(token)}`
      socket = new WebSocket(wsUrl)
    } catch {
      scheduleReconnect()
      return
    }

    socketRef.current = socket

    socket.onopen = () => {
      reconnectAttemptRef.current = 0
      onConnectedRef.current?.()
    }

    socket.onmessage = (event: MessageEvent<string>) => {
      try {
        const data: unknown = JSON.parse(event.data)

        if (!data || typeof data !== 'object') {
          return
        }

        const payload = data as Record<string, unknown>

        if (payload.type === 'error') {
          const serverError = data as ServerError

          onErrorRef.current?.(
            serverError.detail || 'Message could not be sent.',
          )
          return
        }

        if (
          typeof payload.id === 'string' &&
          typeof payload.sender_id === 'string' &&
          typeof payload.receiver_id === 'string' &&
          typeof payload.content === 'string' &&
          typeof payload.sent_at === 'string'
        ) {
          onMessageRef.current(data as Message)
        }
      } catch {
        onErrorRef.current?.('Received an invalid message from the server.')
      }
    }

    socket.onerror = () => {
      // Browsers do not expose detailed WebSocket errors.
      onErrorRef.current?.('Chat connection encountered an error.')
    }

    socket.onclose = () => {
      if (socketRef.current === socket) {
        socketRef.current = null
        scheduleReconnect()
      }
    }

    function scheduleReconnect() {
      if (
        !mountedRef.current ||
        reconnectTimerRef.current !== null
      ) {
        return
      }

      const delay = Math.min(
        1000 * 2 ** reconnectAttemptRef.current,
        15000,
      )

      reconnectAttemptRef.current += 1

      reconnectTimerRef.current = window.setTimeout(() => {
        reconnectTimerRef.current = null
        connect()
      }, delay)
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    connect()

    return () => {
      mountedRef.current = false

      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }

      const socket = socketRef.current
      socketRef.current = null

      if (socket) {
        socket.onopen = null
        socket.onmessage = null
        socket.onerror = null
        socket.onclose = null
        socket.close()
      }
    }
  }, [connect])

  const sendMessage = useCallback(
    (receiver_id: string, content: string): boolean => {
      const socket = socketRef.current

      if (!socket || socket.readyState !== WebSocket.OPEN) {
        return false
      }

      try {
        socket.send(JSON.stringify({ receiver_id, content }))
        return true
      } catch {
        onErrorRef.current?.('Message could not be sent. Please try again.')
        return false
      }
    },
    [],
  )

  return { sendMessage }
}
