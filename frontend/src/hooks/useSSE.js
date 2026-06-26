/**
 * useSSE — Server-Sent Events hookı.
 * /api/persons/events/ ga ulanib, real-time yangilanishlarni oladi.
 *
 * Qaytaradigan qiymatlar:
 *   connected: boolean
 *   lastEvent: { type, data } | null
 *
 * Foydalanish:
 *   const { connected, lastEvent } = useSSE()
 *   useEffect(() => { if (lastEvent?.type === 'person_updated') refetch() }, [lastEvent])
 */
import { useEffect, useRef, useState } from 'react'
import useAuthStore from '../store/authStore'

export default function useSSE() {
  const { user } = useAuthStore()
  const [connected, setConnected] = useState(false)
  const [lastEvent, setLastEvent] = useState(null)
  const esRef = useRef(null)
  const retryRef = useRef(null)

  useEffect(() => {
    if (!user) return

    const connect = () => {
      const token = sessionStorage.getItem('access') || ''
      const url = `/api/persons/events/${token ? `?t=${token}` : ''}`
      const es = new EventSource(url, { withCredentials: true })
      esRef.current = es

      es.addEventListener('connected', () => setConnected(true))

      es.onmessage = (e) => {
        try {
          setLastEvent({ type: 'message', data: JSON.parse(e.data) })
        } catch { /* ignore */ }
      }

      // Named events from backend
      ;['person_created', 'person_updated', 'person_deleted', 'family_updated'].forEach(evtType => {
        es.addEventListener(evtType, (e) => {
          try {
            setLastEvent({ type: evtType, data: JSON.parse(e.data) })
          } catch { /* ignore */ }
        })
      })

      es.onerror = () => {
        setConnected(false)
        es.close()
        // Reconnect after 5s
        retryRef.current = setTimeout(connect, 5000)
      }
    }

    connect()

    return () => {
      clearTimeout(retryRef.current)
      esRef.current?.close()
      setConnected(false)
    }
  }, [user])

  return { connected, lastEvent }
}
