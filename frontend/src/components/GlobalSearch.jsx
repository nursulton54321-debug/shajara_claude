/**
 * 5.1 — Global qidiruv modal (Ctrl+K)
 * App darajasida mount qilinadi, istalgan joydan Ctrl+K bilan ochiladi
 */
import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getPersons } from '../api/persons'
import useThemeStore from '../store/themeStore'

// ── Highlight matching text ─────────────────────────────────────
function Highlight({ text, query }) {
  if (!query.trim()) return <span>{text}</span>
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return <span>{text}</span>
  return (
    <span>
      {text.slice(0, idx)}
      <mark style={{ background: '#fef08a', color: '#0f172a', borderRadius: 3, padding: '0 1px' }}>
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </span>
  )
}

// ── Quick actions shown when query is empty ─────────────────────
const QUICK_ACTIONS = [
  { icon: '➕', label: 'Yangi shaxs qo\'shish',  path: '/persons/add' },
  { icon: '🌳', label: 'Shajara daraxtini ko\'rish', path: '/tree' },
  { icon: '📊', label: 'Statistika',              path: '/statistics' },
  { icon: '👤', label: 'Mening profilim',          path: '/my-profile' },
  { icon: '🔔', label: 'Bildirishnomalar',         path: '/notifications' },
]

export default function GlobalSearch() {
  const [open,    setOpen]    = useState(false)
  const [query,   setQuery]   = useState('')
  const [persons, setPersons] = useState([])
  const [all,     setAll]     = useState([])   // cached full list
  const [active,  setActive]  = useState(0)
  const { isDark } = useThemeStore()
  const navigate   = useNavigate()
  const inputRef   = useRef(null)

  // ── Load all persons once ──────────────────────────────────────
  useEffect(() => {
    getPersons({ page_size: 5000 })
      .then(r => setAll(r.data || []))
      .catch(() => {})
  }, [])

  // ── Filter on query change ─────────────────────────────────────
  useEffect(() => {
    if (!query.trim()) { setPersons([]); setActive(0); return }
    const q = query.toLowerCase()
    const results = all.filter(p =>
      (p.full_name || '').toLowerCase().includes(q) ||
      (p.birth_place || '').toLowerCase().includes(q) ||
      (p.phone || '').includes(q)
    ).slice(0, 10)
    setPersons(results)
    setActive(0)
  }, [query, all])

  // ── Keyboard shortcut ─────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(v => !v)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  // ── Focus input when opened ────────────────────────────────────
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 60)
      setQuery('')
      setActive(0)
    }
  }, [open])

  // ── Navigate to person / action ───────────────────────────────
  const goTo = useCallback((path) => {
    setOpen(false)
    navigate(path)
  }, [navigate])

  const totalItems = query.trim() ? persons.length : QUICK_ACTIONS.length

  // ── Arrow key nav ──────────────────────────────────────────────
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, totalItems - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActive(a => Math.max(a - 1, 0)) }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (query.trim()) {
        if (persons[active]) goTo(`/persons/${persons[active].id}`)
      } else {
        if (QUICK_ACTIONS[active]) goTo(QUICK_ACTIONS[active].path)
      }
    }
  }

  if (!open) return (
    // Sticky trigger button (visible in sidebar)
    <div id="global-search-trigger" style={{ display: 'none' }} />
  )

  const overlay = {
    position: 'fixed', inset: 0, zIndex: 9999,
    background: 'rgba(0,0,0,0.55)',
    backdropFilter: 'blur(4px)',
    display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
    paddingTop: '12vh',
  }
  const modal = {
    width: '100%', maxWidth: 580,
    background: isDark ? '#1e293b' : 'white',
    borderRadius: 20,
    boxShadow: '0 32px 80px rgba(0,0,0,0.35)',
    border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
    overflow: 'hidden',
  }

  const calcAge = (b) => {
    if (!b) return null
    return Math.floor((Date.now() - new Date(b + 'T00:00:00')) / (365.25 * 86400000))
  }

  return (
    <div style={overlay} onClick={() => setOpen(false)}>
      <div style={modal} onClick={e => e.stopPropagation()}>

        {/* Search input */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 18px',
          borderBottom: `1px solid ${isDark ? '#334155' : '#f1f5f9'}`,
        }}>
          <span style={{ fontSize: 18, color: isDark ? '#94a3b8' : '#9ca3af', flexShrink: 0 }}>🔍</span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ism, joy, telefon bo'yicha qidiring..."
            style={{
              flex: 1, border: 'none', outline: 'none', fontSize: 16,
              background: 'transparent',
              color: isDark ? '#f1f5f9' : '#0f172a',
            }}
          />
          <kbd style={{
            padding: '3px 8px', borderRadius: 6, fontSize: 11,
            background: isDark ? '#334155' : '#f1f5f9',
            color: isDark ? '#94a3b8' : '#64748b',
            border: `1px solid ${isDark ? '#475569' : '#e2e8f0'}`,
            fontFamily: 'monospace',
          }}>Esc</kbd>
        </div>

        {/* Results */}
        <div style={{ maxHeight: 400, overflowY: 'auto' }}>
          {/* Empty query — show quick actions */}
          {!query.trim() && (
            <div>
              <div style={{ padding: '8px 18px 4px', fontSize: 11, fontWeight: 700,
                color: isDark ? '#64748b' : '#94a3b8', letterSpacing: '0.08em',
                textTransform: 'uppercase' }}>
                Tezkor harakatlar
              </div>
              {QUICK_ACTIONS.map((a, i) => (
                <div key={a.path}
                  onClick={() => goTo(a.path)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 18px', cursor: 'pointer',
                    background: active === i ? (isDark ? '#334155' : '#f1f5f9') : 'transparent',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={() => setActive(i)}>
                  <span style={{ fontSize: 18, width: 28, textAlign: 'center' }}>{a.icon}</span>
                  <span style={{ fontSize: 14, color: isDark ? '#f1f5f9' : '#0f172a', fontWeight: 500 }}>
                    {a.label}
                  </span>
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: isDark ? '#475569' : '#cbd5e1' }}>↵</span>
                </div>
              ))}
            </div>
          )}

          {/* Query results */}
          {query.trim() && persons.length > 0 && (
            <div>
              <div style={{ padding: '8px 18px 4px', fontSize: 11, fontWeight: 700,
                color: isDark ? '#64748b' : '#94a3b8', letterSpacing: '0.08em',
                textTransform: 'uppercase' }}>
                Shaxslar — {persons.length} ta natija
              </div>
              {persons.map((p, i) => {
                const isMale = p.gender === 'male'
                const accent = isMale ? '#6366f1' : '#ec4899'
                const age    = calcAge(p.birth_date)
                const isAct  = active === i
                return (
                  <div key={p.id}
                    onClick={() => goTo(`/persons/${p.id}`)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 18px', cursor: 'pointer',
                      background: isAct ? (isDark ? '#334155' : '#f1f5f9') : 'transparent',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={() => setActive(i)}>

                    {/* Avatar */}
                    <div style={{
                      width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                      overflow: 'hidden', border: `2px solid ${accent}`,
                      background: isMale ? '#eef2ff' : '#fff0f8',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                    }}>
                      {p.photo_url
                        ? <img src={p.photo_url} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" />
                        : <span>{isMale ? '👨' : '👩'}</span>}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700,
                        color: isDark ? '#f1f5f9' : '#0f172a' }}>
                        <Highlight text={p.full_name || ''} query={query} />
                      </div>
                      <div style={{ fontSize: 12, color: isDark ? '#94a3b8' : '#64748b', marginTop: 1 }}>
                        {isMale ? '👨 Erkak' : '👩 Ayol'}
                        {age != null && ` · ${age} yosh`}
                        {p.birth_place && (
                          <span style={{ marginLeft: 6 }}>
                            📍 <Highlight text={p.birth_place} query={query} />
                          </span>
                        )}
                        {p.death_date && <span style={{ marginLeft: 6, color: '#9ca3af' }}>🌿</span>}
                      </div>
                    </div>

                    <span style={{ fontSize: 12, color: isDark ? '#475569' : '#cbd5e1' }}>↵</span>
                  </div>
                )
              })}
            </div>
          )}

          {/* No results */}
          {query.trim() && persons.length === 0 && (
            <div style={{ padding: '32px 18px', textAlign: 'center',
              color: isDark ? '#64748b' : '#94a3b8' }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>🔍</div>
              <div style={{ fontSize: 14 }}>"{query}" bo'yicha hech narsa topilmadi</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>
                Ism, familiya, viloyat yoki telefon kiriting
              </div>
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div style={{
          padding: '8px 18px',
          borderTop: `1px solid ${isDark ? '#334155' : '#f1f5f9'}`,
          display: 'flex', gap: 16, fontSize: 11,
          color: isDark ? '#64748b' : '#94a3b8',
        }}>
          {[['↑↓', 'Ko\'chirish'], ['↵', 'Ochish'], ['Esc', 'Yopish'], ['Ctrl+K', 'Ochish/yopish']].map(([k, v]) => (
            <span key={k} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <kbd style={{ padding: '1px 6px', borderRadius: 4,
                background: isDark ? '#334155' : '#f1f5f9',
                border: `1px solid ${isDark ? '#475569' : '#e2e8f0'}`,
                fontFamily: 'monospace', fontSize: 10 }}>{k}</kbd>
              {v}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── useGlobalSearch — trigger from anywhere ────────────────────
export function useGlobalSearchTrigger() {
  const open = () => {
    const ev = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true })
    document.dispatchEvent(ev)
  }
  return open
}
