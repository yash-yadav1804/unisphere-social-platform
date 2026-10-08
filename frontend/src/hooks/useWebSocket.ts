import { useEffect, useRef, useCallback } from 'react'
import { Message } from '../types'

export function useWebSocket(onMessage: (msg: Message) => void) {
  const ws = useRef<WebSocket | null>(null)

  const connect = useCallback(() => {
    const token = localStorage.getItem('access_token')
    if (!token) return

    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8000'
    ws.current = new WebSocket(`${wsUrl}/messages/ws/${token}`)

    ws.current.onmessage = (event) => {
      const msg: Message = JSON.parse(event.data)
      onMessage(msg)
    }

    ws.current.onclose = () => {
      setTimeout(connect, 3000)
    }
  }, [onMessage])

  useEffect(() => {
    connect()
    return () => ws.current?.close()
  }, [connect])

  const sendMessage = useCallback((receiver_id: string, content: string) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ receiver_id, content }))
    }
  }, [])

  return { sendMessage }
}
