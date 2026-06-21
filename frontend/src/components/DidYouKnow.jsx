/**
 * 5.2 — "Siz bilarmidingiz?" widget
 * DashboardPage yoki istalgan joyga qo'yiladi
 */
import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getDidYouKnow } from '../api/persons'
import useThemeStore from '../store/themeStore'

export default function DidYouKnow({ className = '' }) {
  const [fact,    setFact]    = useState(null)
  const [loading, setLoading] = useState(false)
  const [flipped, setFlipped] = useState(false)
  const { isDark } = useThemeStore()
  const navigate   = useNavigate()

  const load = useCallback(async () => {
    setLoading(true)
    setFlipped(true)
    try {
      const res = await getDidYouKnow()
      setTimeout(() => { setFact(res.data); setFlipped(false) }, 200)
    } catch {
      setFlipped(false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (!fact) return null

  return (
    <div className={className} style={{
      background: isDark
        ? 'linear-gradient(135deg,#1e1b4b,#1e293b)'
        : 'linear-gradient(135deg,#eff6ff,#f0fdf4)',
      border: `1px solid ${isDark ? '#312e81' : '#bfdbfe'}`,
      borderRadius: 18, padding: '16px 18px',
      transition: 'all 0.3s',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        {/* Icon */}
        <div style={{
          fontSize: 28, flexShrink: 0, lineHeight: 1,
          opacity: flipped ? 0 : 1,
          transform: flipped ? 'scale(0.8) rotate(-10deg)' : 'scale(1) rotate(0)',
          transition: 'all 0.2s',
        }}>
          {fact.icon}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 10, fontWeight: 800, letterSpacing: '0.1em',
            textTransform: 'uppercase', marginBottom: 5,
            color: isDark ? '#818cf8' : '#3b82f6',
          }}>
            💡 Siz bilarmidingiz?
          </div>
          <p style={{
            fontSize: 13, fontWeight: 500, lineHeight: 1.55,
            color: isDark ? '#e2e8f0' : '#1e293b',
            margin: 0,
            opacity: flipped ? 0 : 1,
            transform: flipped ? 'translateY(6px)' : 'translateY(0)',
            transition: 'all 0.2s',
          }}>
            {fact.fact}
          </p>

          {/* Person link */}
          {fact.person_id && (
            <button
              onClick={() => navigate(`/persons/${fact.person_id}`)}
              style={{
                marginTop: 8, fontSize: 11, fontWeight: 700,
                color: isDark ? '#818cf8' : '#4f46e5',
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                display: 'flex', alignItems: 'center', gap: 3,
              }}>
              👤 Profilni ko'rish →
            </button>
          )}
        </div>

        {/* Refresh */}
        <button
          onClick={load}
          disabled={loading}
          title="Yangi fakt"
          style={{
            flexShrink: 0, width: 30, height: 30, borderRadius: 8,
            background: isDark ? '#312e81' : '#dbeafe',
            border: 'none', cursor: loading ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, transition: 'all 0.2s',
            opacity: loading ? 0.5 : 1,
            transform: loading ? 'rotate(360deg)' : 'none',
          }}>
          🔄
        </button>
      </div>
    </div>
  )
}
