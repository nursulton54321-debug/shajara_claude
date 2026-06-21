import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'

/**
 * API chaqiruvlar uchun universal hook.
 * Xatolarni avtomatik ushlab, foydalanuvchiga ko'rsatadi.
 *
 * @param {Function} apiFn   — chaqiriladigan api funksiya
 * @param {any[]}    deps    — qayta fetch qilish kerak bo'lganda o'zgaruvchilar
 * @param {Object}   options — { immediate: bool, silent: bool }
 */
export function useApiRequest(apiFn, deps = [], options = {}) {
  const { immediate = true, silent = false } = options
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(immediate)
  const [error, setError]     = useState(null)

  const execute = useCallback(async (...args) => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiFn(...args)
      setData(res.data)
      return res.data
    } catch (err) {
      const msg = err?.response?.data?.detail
        || err?.response?.data?.message
        || err?.message
        || 'Xato yuz berdi'
      setError(msg)
      if (!silent) toast.error(msg)
      return null
    } finally {
      setLoading(false)
    }
  }, deps)

  useEffect(() => {
    if (immediate) execute()
  }, deps)

  return { data, loading, error, refetch: execute }
}
