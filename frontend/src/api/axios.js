import axios from 'axios'

const api = axios.create({ baseURL: (import.meta.env.VITE_API_URL || '') + '/api' })

// ── localStorage → sessionStorage migration (bir martalik) ────
;(function migrateRefresh() {
  const old = localStorage.getItem('refresh')
  if (old && !sessionStorage.getItem('refresh')) {
    sessionStorage.setItem('refresh', old)
  }
  if (old) localStorage.removeItem('refresh')
})()

// ── Auth token ─────────────────────────────────────────────────
// api.defaults.headers.Authorization login paytida o'rnatiladi (authStore).
// Token faqat in-memory — localStorage da saqlanmaydi.
api.interceptors.request.use((config) => {
  // Authorization allaqachon o'rnatilgan bo'lsa — hech narsa qilma
  if (config.headers.Authorization || api.defaults.headers.Authorization) return config
  return config
})

// ── 401 → token refresh ───────────────────────────────────────
let _refreshing = false

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const status = error.response?.status
    const isRefreshEndpoint = error.config?.url?.includes('/auth/refresh/')

    if (status === 401 && !isRefreshEndpoint && !_refreshing) {
      const refresh = sessionStorage.getItem('refresh')
      if (refresh) {
        _refreshing = true
        try {
          const res = await api.post('/auth/refresh/', { refresh })
          const newToken = res.data.access

          // Zustand store ni yangilash (import qilmasdan localStorage orqali)
          const stored = JSON.parse(localStorage.getItem('auth') || '{}')
          if (stored.state) {
            stored.state.token = newToken
            localStorage.setItem('auth', JSON.stringify(stored))
          }
          api.defaults.headers.Authorization = `Bearer ${newToken}`
          error.config.headers.Authorization = `Bearer ${newToken}`
          _refreshing = false
          return api(error.config)
        } catch {
          // Refresh muvaffaqiyatsiz — auth tozalash, PIN gate ko'rsatish
          _refreshing = false
          sessionStorage.removeItem('refresh')
          localStorage.removeItem('auth')
          delete api.defaults.headers.Authorization
          // PinGate va boshqa komponentlar uchun event
          window.dispatchEvent(new Event('auth-expired'))
        }
      }
    }
    // 5xx server xatolari uchun global toast (4xx — komponentlar o'zi ko'rsatadi)
    const status2 = error.response?.status
    if (status2 >= 500) {
      import('react-hot-toast').then(({ default: toast }) => {
        toast.error('Server xatosi. Iltimos, keyinroq urinib ko\'ring.')
      })
    }

    return Promise.reject(error)
  }
)

// ── In-flight GET deduplication ───────────────────────────────
// Bir sahifada bir xil endpoint bir vaqtda 2-3 marta chaqirilsa,
// faqat 1 ta request yuboriladi. Response kelgandan keyin kesh tozalanadi.
const _inFlight = new Map()

const _rawGet = api.get.bind(api)
api.get = function cachedGet(url, config) {
  const key = url + '\x00' + JSON.stringify((config || {}).params || null)

  if (_inFlight.has(key)) return _inFlight.get(key)

  const req = _rawGet(url, config).finally(() => _inFlight.delete(key))
  _inFlight.set(key, req)
  return req
}

// Cache invalidation — yozish/o'chirish operatsiyalaridan keyin
export function invalidateCache() {
  _inFlight.clear()
}

export default api
