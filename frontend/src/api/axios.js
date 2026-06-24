import axios from 'axios'

const api = axios.create({ baseURL: (import.meta.env.VITE_API_URL || '') + '/api' })

// ── sessionStorage → localStorage migration (bir martalik) ────
;(function migrateRefresh() {
  const old = sessionStorage.getItem('refresh')
  if (old && !localStorage.getItem('refresh')) {
    localStorage.setItem('refresh', old)
  }
  if (old) sessionStorage.removeItem('refresh')
})()

// ── Auth token ─────────────────────────────────────────────────
// api.defaults.headers.Authorization login paytida o'rnatiladi (authStore).
// Token faqat in-memory — localStorage da saqlanmaydi.
api.interceptors.request.use((config) => {
  if (config.headers.Authorization || api.defaults.headers.Authorization) return config
  return config
})

// ── 401 → token refresh (queue pattern) ──────────────────────
// Bir vaqtda bir nechta so'rov 401 olganda, barchasi navbatga qo'shiladi
// va refresh muvaffaqiyatli bo'lgandan keyin hammasi qayta yuboriladi.
let _refreshing = false
let _failedQueue = []

function _processQueue(error, token = null) {
  _failedQueue.forEach(({ resolve, reject, config }) => {
    if (error) {
      reject(error)
    } else {
      config.headers = config.headers || {}
      config.headers.Authorization = `Bearer ${token}`
      resolve(api(config))
    }
  })
  _failedQueue = []
}

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const status = error.response?.status
    const isRefreshEndpoint = error.config?.url?.includes('/auth/refresh/')

    if (status === 401 && !isRefreshEndpoint) {
      if (_refreshing) {
        // Refresh davom etmoqda — navbatga qo'shamiz
        return new Promise((resolve, reject) => {
          _failedQueue.push({ resolve, reject, config: error.config })
        })
      }

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

          // Navbatdagi barcha so'rovlarni qayta yubor
          _processQueue(null, newToken)
          _refreshing = false

          error.config.headers = error.config.headers || {}
          error.config.headers.Authorization = `Bearer ${newToken}`
          return api(error.config)
        } catch (refreshError) {
          _processQueue(refreshError, null)
          _refreshing = false
          localStorage.removeItem('refresh')
          sessionStorage.removeItem('refresh')
          localStorage.removeItem('auth')
          delete api.defaults.headers.Authorization
          window.dispatchEvent(new Event('auth-expired'))
        }
      }
    }

    // 5xx server xatolari uchun global toast
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
