import { create } from 'zustand'
import type { User } from '../types'
import api from '../lib/api'

interface AuthState {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (username: string, email: string, password: string) => Promise<void>
  logout: () => void
  fetchMe: () => Promise<void>
  updateUser: (user: Partial<User>) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: false,

  login: async (email, password) => {
    const res = await api.post('/auth/login', { email, password })

    localStorage.setItem('access_token', res.data.access_token)
    localStorage.setItem('refresh_token', res.data.refresh_token)

    const me = await api.get<User>('/auth/me')
    set({ user: me.data })
  },

  register: async (username, email, password) => {
    await api.post('/auth/register', { username, email, password })
  },

  logout: () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    set({ user: null })
  },

  fetchMe: async () => {
    try {
      const res = await api.get<User>('/auth/me')
      set({ user: res.data })
    } catch {
      set({ user: null })
    }
  },

  updateUser: (updates) =>
    set((state) => ({
      user: state.user ? { ...state.user, ...updates } : null,
    })),
}))