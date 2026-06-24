import axios from 'axios'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import api from '../api/axios'

const useAuthStore = create(persist(
  (set, get) => ({
    user: null,
    token: null,

    login: async (username, password) => {
      const res = await api.post('/auth/login/', { username, password })
      const { access, refresh, user } = res.data
      set({ user, token: access })
      sessionStorage.setItem('refresh', refresh)
      api.defaults.headers.Authorization = `Bearer ${access}`
      return user
    },

    loginWithTokens: ({ access, refresh, user }) => {
      set({ user, token: access })
      sessionStorage.setItem('refresh', refresh)
      api.defaults.headers.Authorization = `Bearer ${access}`
    },

    logout: () => {
      set({ user: null, token: null })
      sessionStorage.removeItem('refresh')
      delete api.defaults.headers.Authorization
    },

    setUser: (user) => set({ user }),

    isAdmin: () => {
      const u = get().user
      return u?.role === 'admin' || u?.is_superuser === true
    },

    restoreToken: async () => {
      if (api.defaults.headers.Authorization) return
      const refresh = sessionStorage.getItem('refresh')
      if (!refresh || !get().user) return
      try {
        const res = await axios.post('/api/auth/refresh/', { refresh })
        const access = res.data.access
        set({ token: access })
        api.defaults.headers.Authorization = `Bearer ${access}`
      } catch {
        set({ user: null, token: null })
        sessionStorage.removeItem('refresh')
        delete api.defaults.headers.Authorization
      }
    },
  }),
  {
    name: 'auth',
    // token ham saqlanadi — sahifa yangilanishida auth header tiklanadi
    partialize: (s) => ({ user: s.user, token: s.token }),
    onRehydrateStorage: () => (state) => {
      if (state?.token) {
        // Saqlangan token bilan auth headerni tikla (expired bo'lsa interceptor refresh qiladi)
        api.defaults.headers.Authorization = `Bearer ${state.token}`
      }
    },
  }
))

export default useAuthStore
