
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

    const wsBase = (
      import.meta.env.VITE_WS_URL || 'ws://localhost:8000'
    ).replace(/\/+$/, '')

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
      socket = new WebSocket(
        `${wsBase}/messages/ws/${encodeURIComponent(token)}`,
      )
    } catch {
      scheduleReconnect()
      return
    }

    socketRef.current = socket

    socket.onopen = () => {
      reconnectAttemptRef.current = 0
      onConnectedRef.current?.()
    }

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as Message | ServerError

        if (
          typeof data === 'object' &&
          data !== null &&
          'type' in data &&
          data.type === 'error'
        ) {
          onErrorRef.current?.(
            (data as ServerError).detail || 'Message could not be sent.',
          )
          return
        }

        if (
          typeof data === 'object' &&
          data !== null &&
          'id' in data &&
          'sender_id' in data &&
          'receiver_id' in data &&
          'content' in data
        ) {
          onMessageRef.current(data as Message)
        }
      } catch {
        onErrorRef.current?.('Received an invalid message from the server.')
      }
    }

    socket.onerror = () => {
      // Browsers expose limited WebSocket error details.
      onErrorRef.current?.('Chat connection encountered an error.')
    }

    socket.onclose = () => {
      if (socketRef.current === socket) {
        socketRef.current = null
        scheduleReconnect()
      }
    }

    function scheduleReconnect() {
      if (!mountedRef.current || reconnectTimerRef.current !== null) return

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
