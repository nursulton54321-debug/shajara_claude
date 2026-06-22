import { useEffect, useMemo, useState, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getPersons } from '../../api/persons'
import useAuthStore from '../../store/authStore'
import useThemeStore from '../../store/themeStore'
import AnimCount from '../../components/AnimCount'
import { SkeletonRow } from '../../components/Skeleton'
import ErrorCard from '../../components/ErrorCard'

// ── Saralash parametrlari ──────────────────────────────────────
const SORT_OPTIONS = [
  { value: 'name_asc',   label: 'A → Z (ism)',        icon: '🔤' },
  { value: 'name_desc',  label: 'Z → A (ism)',        icon: '🔤' },
  { value: 'birth_asc',  label: 'Yoshi katta avval',  icon: '👴' },
  { value: 'birth_desc', label: 'Yoshi kichik avval', icon: '👶' },
  { value: 'child_asc',  label: 'Farzand raqami ↑',   icon: '🔢' },
  { value: 'child_desc', label: 'Farzand raqami ↓',   icon: '🔢' },
  { value: 'added_desc', label: 'Yangi qo\'shilgan',  icon: '🆕' },
  { value: 'added_asc',  label: 'Eski qo\'shilgan',   icon: '📅' },
]

function sortPersons(list, sortKey) {
  const arr = [...list]
  switch (sortKey) {
    case 'name_asc':
      return arr.sort((a, b) => (a.full_name || '').localeCompare(b.full_name || '', 'uz'))
    case 'name_desc':
      return arr.sort((a, b) => (b.full_name || '').localeCompare(a.full_name || '', 'uz'))
    case 'birth_asc':
      return arr.sort((a, b) => {
        const ya = a.birth_date ? new Date(a.birth_date).getFullYear() : 9999
        const yb = b.birth_date ? new Date(b.birth_date).getFullYear() : 9999
        return ya - yb
      })
    case 'birth_desc':
      return arr.sort((a, b) => {
        const ya = a.birth_date ? new Date(a.birth_date).getFullYear() : 0
        const yb = b.birth_date ? new Date(b.birth_date).getFullYear() : 0
        return yb - ya
      })
    case 'child_asc':
      return arr.sort((a, b) => (a.child_number || 999) - (b.child_number || 999))
    case 'child_desc':
      return arr.sort((a, b) => (b.child_number || 0) - (a.child_number || 0))
    case 'added_desc':
      return arr.sort((a, b) => b.id - a.id)
    case 'added_asc':
      return arr.sort((a, b) => a.id - b.id)
    default:
      return arr
  }
}

export default function PersonsListPage() {
  const [persons, setPersons]   = useState([])
  const [showSort, setShowSort] = useState(false)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const navigate      = useNavigate()
  const [params, setParams] = useSearchParams()
  const { isAdmin }   = useAuthStore()
  const { isDark }    = useThemeStore()

  // URL params dan holat olamiz — sahifalar orasida saqlanadi
  const search = params.get('q')      || ''
  const gender = params.get('gender') || ''
  const sort   = params.get('sort')   || 'name_asc'

  const setSearch = (v) => setParams(p => { const n = new URLSearchParams(p); v ? n.set('q', v) : n.delete('q'); return n }, { replace: true })
  const setGender = (v) => setParams(p => { const n = new URLSearchParams(p); v ? n.set('gender', v) : n.delete('gender'); return n }, { replace: true })
  const setSort   = (v) => setParams(p => { const n = new URLSearchParams(p); v !== 'name_asc' ? n.set('sort', v) : n.delete('sort'); return n }, { replace: true })

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getPersons({ search, gender })
      setPersons(res.data)
    } catch {
      setError("Shaxslar ro'yxatini yuklashda xato yuz berdi")
    } finally {
      setLoading(false)
    }
  }, [search, gender])

  useEffect(() => { load() }, [load])

  const sorted = useMemo(() => sortPersons(persons, sort), [persons, sort])

  const currentSort = SORT_OPTIONS.find(o => o.value === sort)

  const bg     = isDark ? '#0f172a' : '#f8fafc'
  const card   = isDark ? '#1e293b' : '#ffffff'
  const border = isDark ? '#334155' : '#f1f5f9'
  const text   = isDark ? '#f1f5f9' : '#1e293b'
  const muted  = isDark ? '#64748b' : '#94a3b8'
  const inputBg = isDark ? '#1e293b' : '#ffffff'

  return (
    <div className="persons-page" style={{ padding: '20px 16px', background: bg, minHeight: '100vh', paddingBottom: 80 }}>

      {/* ── Header ── */}
      <div className="persons-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 900, color: text, margin: 0, letterSpacing: '-0.3px' }}>
            👥 Shaxslar
          </h1>
          <div style={{ fontSize: 11, color: muted, marginTop: 2 }}>
            Jami: <AnimCount to={persons.length} /> ta shaxs
          </div>
        </div>
        <button
          onClick={() => navigate('/persons/add')}
          style={{
            background: 'linear-gradient(135deg,#3b82f6,#6366f1)',
            color: 'white', border: 'none', borderRadius: 12,
            padding: '9px 16px', fontSize: 12, fontWeight: 800,
            cursor: 'pointer', boxShadow: '0 4px 14px rgba(99,102,241,0.35)',
            display: 'flex', alignItems: 'center', gap: 5,
            whiteSpace: 'nowrap',
          }}>
          <span style={{ fontSize: 15 }}>＋</span> Qo'shish
        </button>
      </div>

      {/* ── Filter + Sort bar ── */}
      <div className="persons-filters" style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {/* Search */}
        <input
          type="text"
          placeholder="Ism, familiya..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex: 1, minWidth: 120,
            border: `1.5px solid ${border}`, borderRadius: 10,
            padding: '8px 12px', fontSize: 13, outline: 'none',
            background: inputBg, color: text,
          }}
        />

        {/* Gender filter */}
        <select
          value={gender}
          onChange={e => setGender(e.target.value)}
          style={{
            border: `1.5px solid ${border}`, borderRadius: 10,
            padding: '8px 10px', fontSize: 12, outline: 'none',
            background: inputBg, color: text, cursor: 'pointer',
          }}>
          <option value="">Barcha</option>
          <option value="male">👨 Erkak</option>
          <option value="female">👩 Ayol</option>
        </select>

        {/* Sort dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowSort(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              border: `1.5px solid ${showSort ? '#6366f1' : border}`, borderRadius: 10,
              padding: '8px 12px', fontSize: 12, fontWeight: 600,
              background: showSort ? (isDark ? '#1e1b4b' : '#eef2ff') : inputBg,
              color: showSort ? '#6366f1' : text, cursor: 'pointer', outline: 'none',
              whiteSpace: 'nowrap',
            }}>
            <span>{currentSort?.icon}</span>
            <span className="sort-label-text">{currentSort?.label}</span>
            <span style={{ fontSize: 9, opacity: 0.6 }}>{showSort ? '▲' : '▼'}</span>
          </button>

          {showSort && (
            <div style={{
              position: 'absolute', top: '110%', right: 0, zIndex: 100,
              background: card, border: `1.5px solid ${border}`,
              borderRadius: 14, padding: 6, minWidth: 210,
              boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
            }}>
              {SORT_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => { setSort(opt.value); setShowSort(false) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 9,
                    width: '100%', padding: '8px 12px', borderRadius: 9,
                    border: 'none', cursor: 'pointer', textAlign: 'left',
                    fontSize: 12, fontWeight: sort === opt.value ? 800 : 500,
                    background: sort === opt.value
                      ? (isDark ? '#1e1b4b' : '#eef2ff')
                      : 'transparent',
                    color: sort === opt.value ? '#6366f1' : text,
                  }}>
                  <span>{opt.icon}</span>
                  <span>{opt.label}</span>
                  {sort === opt.value && <span style={{ marginLeft: 'auto', fontSize: 14 }}>✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Results count ── */}
      {!loading && (
        <div style={{ fontSize: 11, color: muted, marginBottom: 8 }}>
          {sorted.length} ta natija
          {search && ` · "${search}"`}
          {' · '}<span style={{ fontWeight: 700, color: '#6366f1' }}>{currentSort?.label}</span>
        </div>
      )}

      {/* ── List ── */}
      {error ? (
        <ErrorCard message={error} onRetry={load} />
      ) : loading ? (
        <div style={{ background: card, borderRadius: 16, border: `1px solid ${border}`, overflow: 'hidden' }}>
          <SkeletonRow count={6} />
        </div>
      ) : sorted.length === 0 ? (
        <div style={{ textAlign: 'center', color: muted, padding: '60px 0' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Hech kim topilmadi</div>
        </div>
      ) : (
        <div style={{
          background: card, borderRadius: 16, overflow: 'hidden',
          border: `1px solid ${border}`,
          boxShadow: isDark ? '0 2px 16px rgba(0,0,0,0.3)' : '0 2px 16px rgba(0,0,0,0.06)',
        }}>
          {sorted.map((p, i) => {
            const male = p.gender === 'male'
            const birthYear = p.birth_date ? new Date(p.birth_date + 'T00:00:00').getFullYear() : null
            const deathYear = p.death_date ? new Date(p.death_date + 'T00:00:00').getFullYear() : null

            return (
              <div
                key={p.id}
                onClick={() => navigate(`/persons/${p.id}`)}
                className="persons-card-row"
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 14px', cursor: 'pointer',
                  borderTop: i !== 0 ? `1px solid ${border}` : 'none',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = isDark ? '#334155' : '#f8fafc'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>

                {/* Avatar */}
                <div style={{
                  width: 46, height: 46, borderRadius: 13, flexShrink: 0,
                  overflow: 'hidden',
                  background: male
                    ? 'linear-gradient(135deg,#3b82f6,#6366f1)'
                    : 'linear-gradient(135deg,#ec4899,#f43f5e)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontWeight: 800, fontSize: 17,
                  boxShadow: male
                    ? '0 3px 10px rgba(99,102,241,0.35)'
                    : '0 3px 10px rgba(236,72,153,0.35)',
                }}>
                  {p.photo_url
                    ? <img src={p.photo_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                    : (p.full_name?.[0] || '?')}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 14, color: text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.full_name}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
                    {/* Gender badge */}
                    <span style={{
                      padding: '1px 7px', borderRadius: 20, fontSize: 10, fontWeight: 700,
                      background: male ? (isDark ? '#1e3a8a' : '#eff6ff') : (isDark ? '#500724' : '#fdf2f8'),
                      color: male ? (isDark ? '#93c5fd' : '#1d4ed8') : (isDark ? '#f9a8d4' : '#be185d'),
                    }}>
                      {male ? '👨' : '👩'} {male ? 'Erkak' : 'Ayol'}
                    </span>
                    {/* Year range */}
                    <span style={{ fontSize: 11, color: muted }}>
                      {birthYear || '—'}{deathYear ? `–${deathYear}` : p.age != null ? ` · ${p.age}y` : ''}
                    </span>
                    {p.death_date && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: isDark ? '#94a3b8' : '#6b7280',
                        background: isDark ? '#1f2937' : '#f3f4f6', padding: '1px 7px', borderRadius: 20 }}>
                        Vafot
                      </span>
                    )}
                    {p.birth_place && (
                      <span className="persons-place" style={{ fontSize: 10, color: muted }}>
                        📍 {p.birth_place}
                      </span>
                    )}
                  </div>
                </div>

                {/* Edit button */}
                <button
                  onClick={e => { e.stopPropagation(); navigate(`/persons/${p.id}/edit`) }}
                  style={{
                    width: 34, height: 34, borderRadius: 10, border: 'none',
                    background: isDark ? '#292524' : '#fffbeb',
                    color: '#d97706', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, transition: 'transform 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                  title="Tahrirlash">
                  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Close sort dropdown on outside click */}
      {showSort && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 99 }}
          onClick={() => setShowSort(false)}
        />
      )}
    </div>
  )
}
