
import { useEffect, useRef, useCallback } from 'react'
import type { Message } from '../types'

type WebSocketMessage = {
  receiver_id: string
  content: string
}

export function useWebSocket(
  onMessage: (msg: Message) => void,
  onConnected?: () => void,
) {
  const ws = useRef<WebSocket | null>(null)
  const onMessageRef = useRef(onMessage)
  const onConnectedRef = useRef(onConnected)
  const reconnectTimer = useRef<number | null>(null)
  const reconnectAttempts = useRef(0)
  const queue = useRef<WebSocketMessage[]>([])
  const mounted = useRef(false)

  useEffect(() => {
    onMessageRef.current = onMessage
  }, [onMessage])

  useEffect(() => {
    onConnectedRef.current = onConnected
  }, [onConnected])

  const connect = useCallback(() => {
    if (!mounted.current) return

    const existing = ws.current

    if (
      existing &&
      (existing.readyState === WebSocket.CONNECTING ||
        existing.readyState === WebSocket.OPEN)
    ) {
      return
    }

    const token = localStorage.getItem('access_token')

    if (!token) return

    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8000'
    const socket = new WebSocket(
      `${wsUrl.replace(/\/$/, '')}/messages/ws/${token}`,
    )

    ws.current = socket

    socket.onopen = () => {
      if (ws.current !== socket || !mounted.current) {
        socket.close()
        return
      }

      reconnectAttempts.current = 0

      while (queue.current.length > 0 && socket.readyState === WebSocket.OPEN) {
        const message = queue.current[0]

        try {
          socket.send(JSON.stringify(message))
          queue.current.shift()
        } catch {
          break
        }
      }

      onConnectedRef.current?.()
    }

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as Message
        onMessageRef.current(message)
      } catch {
        console.error('Received an invalid WebSocket message.')
      }
    }

    socket.onerror = () => {
      // onclose handles reconnection.
    }

    socket.onclose = () => {
      if (ws.current !== socket || !mounted.current) return

      ws.current = null

      const delay = Math.min(
        1000 * 2 ** reconnectAttempts.current,
        15000,
      )

      reconnectAttempts.current += 1

      reconnectTimer.current = window.setTimeout(() => {
        reconnectTimer.current = null
        connect()
      }, delay)
    }
  }, [])

  useEffect(() => {
    mounted.current = true
    connect()

    return () => {
      mounted.current = false

      if (reconnectTimer.current !== null) {
        window.clearTimeout(reconnectTimer.current)
        reconnectTimer.current = null
      }

      const socket = ws.current
      ws.current = null

      if (socket) {
        socket.onclose = null
        socket.close()
      }
    }
  }, [connect])

  const sendMessage = useCallback(
    (receiver_id: string, content: string): boolean => {
      const message = {
        receiver_id,
        content: content.trim(),
      }

      if (!message.receiver_id || !message.content) {
        return false
      }

      const socket = ws.current

      if (socket?.readyState === WebSocket.OPEN) {
        try {
          socket.send(JSON.stringify(message))
          return true
        } catch {
          queue.current.push(message)
          return true
        }
      }

      if (socket?.readyState === WebSocket.CONNECTING) {
        queue.current.push(message)
        return true
      }

      return false
    },
    [],
  )

  return { sendMessage }
}
