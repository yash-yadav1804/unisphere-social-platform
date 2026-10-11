import { useEffect, useRef, useCallback } from 'react'
import type { Message } from '../types'

export function useWebSocket(onMessage: (msg: Message) => void) {
  const ws = useRef<WebSocket | null>(null)
  const onMessageRef = useRef(onMessage)
  const reconnectTimer = useRef<number | null>(null)

  useEffect(() => {
    onMessageRef.current = onMessage
  }, [onMessage])

  const connect = useCallback(() => {
    const token = localStorage.getItem('access_token')
    if (!token) return

    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8000'
    const socket = new WebSocket(`${wsUrl}/messages/ws/${token}`)
    ws.current = socket

    socket.onmessage = (event) => {
      try {
        onMessageRef.current(JSON.parse(event.data) as Message)
      } catch {
        // Ignore malformed websocket payloads rather than breaking the connection.
      }
    }

    socket.onclose = () => {
      if (ws.current === socket) {
        reconnectTimer.current = window.setTimeout(connect, 3000)
      }
    }
  }, [])

  useEffect(() => {
    connect()
    return () => {
      if (reconnectTimer.current !== null) window.clearTimeout(reconnectTimer.current)
      ws.current?.close()
      ws.current = null
    }
  }, [connect])

  const sendMessage = useCallback((receiver_id: string, content: string) => {
    if (ws.current?.readyState !== WebSocket.OPEN) return false
    ws.current.send(JSON.stringify({ receiver_id, content }))
    return true
  }, [])

  return { sendMessage }
}
