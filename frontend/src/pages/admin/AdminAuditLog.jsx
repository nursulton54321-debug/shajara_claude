import { useEffect, useState, useCallback } from 'react'
import api from '../../api/axios'
import logger from '../../utils/logger'

// ── Config ────────────────────────────────────────────────────────
const ACTION_META = {
  create: { label: "Qo'shildi",      color: '#10b981', bg: '#d1fae5', icon: '➕' },
  update: { label: 'Yangilandi',     color: '#3b82f6', bg: '#dbeafe', icon: '✏️' },
  delete: { label: "O'chirildi",     color: '#ef4444', bg: '#fee2e2', icon: '🗑️' },
  login:  { label: 'Kirdi',          color: '#8b5cf6', bg: '#ede9fe', icon: '🔐' },
  export: { label: 'Eksport',        color: '#f59e0b', bg: '#fef3c7', icon: '📤' },
  import: { label: 'Import',         color: '#0ea5e9', bg: '#e0f2fe', icon: '📥' },
}

const MODEL_ICONS = {
  Person:  '👤',
  Family:  '👨‍👩‍👧',
  Backup:  '📦',
  CSV:     '📊',
  default: '📝',
}

function ActionBadge({ action }) {
  const m = ACTION_META[action] || { label: action, color: '#6b7280', bg: '#f3f4f6', icon: '❓' }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600,
      color: m.color, background: m.bg,
    }}>
      {m.icon} {m.label}
    </span>
  )
}

function ChangesModal({ log, onClose }) {
  if (!log) return null
  const changes = log.changes || {}
  const keys = Object.keys(changes)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onClick={onClose}>
      <div className="admin-card p-6 w-full max-w-lg mx-4"
        style={{ maxHeight: '80vh', overflow: 'auto' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>
            🔍 O'zgarishlar — <span style={{ color: '#6366f1' }}>{log.object_repr || '—'}</span>
          </h3>
          <button onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#6b7280' }}>
            ✕
          </button>
        </div>
        {keys.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Ma'lumot yo'q</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ textAlign:'left', padding:'6px 8px', borderBottom:'1px solid var(--border-subtle)', color:'var(--text-secondary)', fontWeight:600 }}>Maydon</th>
                <th style={{ textAlign:'left', padding:'6px 8px', borderBottom:'1px solid var(--border-subtle)', color:'#ef4444', fontWeight:600 }}>Eski</th>
                <th style={{ textAlign:'left', padding:'6px 8px', borderBottom:'1px solid var(--border-subtle)', color:'#10b981', fontWeight:600 }}>Yangi</th>
              </tr>
            </thead>
            <tbody>
              {keys.map(k => (
                <tr key={k} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding:'6px 8px', color:'var(--text-secondary)', fontFamily:'monospace' }}>{k}</td>
                  <td style={{ padding:'6px 8px', color:'#ef4444' }}>{String(changes[k][0] ?? '—')}</td>
                  <td style={{ padding:'6px 8px', color:'#10b981' }}>{String(changes[k][1] ?? '—')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────
export default function AdminAuditLog() {
  const [logs,    setLogs]    = useState([])
  const [total,   setTotal]   = useState(0)
  const [pages,   setPages]   = useState(1)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(null)  // for changes modal

  const [filters, setFilters] = useState({
    action:    '',
    model:     '',
    search:    '',
    date_from: '',
    date_to:   '',
    page:      1,
    page_size: 50,
  })

  const load = useCallback(async (f) => {
    setLoading(true)
    try {
      const params = {}
      if (f.action)    params.action    = f.action
      if (f.model)     params.model     = f.model
      if (f.search)    params.search    = f.search
      if (f.date_from) params.date_from = f.date_from
      if (f.date_to)   params.date_to   = f.date_to
      params.page      = f.page
      params.page_size = f.page_size

      const res = await api.get('/persons/audit/', { params })
      setLogs(res.data.results)
      setTotal(res.data.count)
      setPages(res.data.pages)
    } catch (e) {
      logger.error('Audit log yuklash xatosi:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(filters) }, [filters, load])

  const setFilter = (key, val) => setFilters(p => ({ ...p, [key]: val, page: 1 }))
  const setPage   = (p)        => setFilters(prev => ({ ...prev, page: p }))

  const formatDate = (ts) => {
    if (!ts) return '—'
    const d = new Date(ts)
    return d.toLocaleString('ru-RU', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  return (
    <div className="p-6 space-y-5 page-enter" style={{ color: 'var(--text-primary)' }}>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">🕵️ Audit Log</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 2 }}>
            Kim, qachon, nima o'zgartirgan — jami {total} ta yozuv
          </p>
        </div>
        <div style={{
          background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
          color: 'white', padding: '6px 16px', borderRadius: 10,
          fontSize: 13, fontWeight: 700,
        }}>
          {total} ta harakat
        </div>
      </div>

      {/* Filters */}
      <div className="admin-card p-4 flex flex-wrap gap-3 items-end">
        {/* Search */}
        <div className="flex-1" style={{ minWidth: 180 }}>
          <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Qidirish</label>
          <input
            type="text"
            placeholder="Ism, foydalanuvchi..."
            value={filters.search}
            onChange={e => setFilter('search', e.target.value)}
            className="input-field"
            style={{ width: '100%', padding: '7px 10px', fontSize: 13 }}
          />
        </div>

        {/* Action */}
        <div>
          <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Harakat</label>
          <select value={filters.action} onChange={e => setFilter('action', e.target.value)}
            className="input-field" style={{ padding: '7px 10px', fontSize: 13 }}>
            <option value="">Barchasi</option>
            {Object.entries(ACTION_META).map(([k, v]) => (
              <option key={k} value={k}>{v.icon} {v.label}</option>
            ))}
          </select>
        </div>

        {/* Model */}
        <div>
          <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Model</label>
          <select value={filters.model} onChange={e => setFilter('model', e.target.value)}
            className="input-field" style={{ padding: '7px 10px', fontSize: 13 }}>
            <option value="">Barchasi</option>
            <option value="Person">👤 Shaxs</option>
            <option value="Family">👨‍👩‍👧 Oila</option>
            <option value="Backup">📦 Backup</option>
          </select>
        </div>

        {/* Date from */}
        <div>
          <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Dan</label>
          <input type="date" value={filters.date_from}
            onChange={e => setFilter('date_from', e.target.value)}
            className="input-field" style={{ padding: '7px 10px', fontSize: 13 }} />
        </div>

        {/* Date to */}
        <div>
          <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Gacha</label>
          <input type="date" value={filters.date_to}
            onChange={e => setFilter('date_to', e.target.value)}
            className="input-field" style={{ padding: '7px 10px', fontSize: 13 }} />
        </div>

        {/* Clear */}
        <button onClick={() => setFilters({ action:'', model:'', search:'', date_from:'', date_to:'', page:1, page_size:50 })}
          style={{ padding:'7px 14px', borderRadius:8, fontSize:13, background:'var(--card-bg)', border:'1px solid var(--border-subtle)', color:'var(--text-secondary)', cursor:'pointer' }}>
          ✕ Tozalash
        </button>
      </div>

      {/* Table */}
      <div className="admin-card overflow-hidden">
        {loading ? (
          <div className="p-10 text-center" style={{ color: 'var(--text-secondary)' }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>⏳</div>
            <div>Yuklanmoqda...</div>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-10 text-center" style={{ color: 'var(--text-secondary)' }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>📭</div>
            <div>Yozuvlar topilmadi</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--table-header, rgba(99,102,241,0.07))' }}>
                  {['#', 'Vaqt', 'Foydalanuvchi', 'Harakat', 'Model', 'Obyekt', 'IP', ''].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border-subtle)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((log, i) => {
                  const modelIcon = MODEL_ICONS[log.model_name] || MODEL_ICONS.default
                  const hasChanges = log.changes && Object.keys(log.changes).length > 0
                  return (
                    <tr key={log.id}
                      style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--hover-bg, rgba(99,102,241,0.04))'}
                      onMouseLeave={e => e.currentTarget.style.background = ''}>

                      <td style={{ padding: '10px 12px', color: 'var(--text-muted)', fontSize: 11 }}>
                        {(filters.page - 1) * filters.page_size + i + 1}
                      </td>

                      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                        {formatDate(log.timestamp)}
                      </td>

                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{log.user_name}</div>
                        {log.user && (
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>ID: {log.user}</div>
                        )}
                      </td>

                      <td style={{ padding: '10px 12px' }}>
                        <ActionBadge action={log.action} />
                      </td>

                      <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>
                        {modelIcon} {log.model_name || '—'}
                        {log.object_id && (
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}> #{log.object_id}</span>
                        )}
                      </td>

                      <td style={{ padding: '10px 12px', maxWidth: 180 }}>
                        <div style={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {log.object_repr || '—'}
                        </div>
                      </td>

                      <td style={{ padding: '10px 12px', color: 'var(--text-muted)', fontSize: 11, whiteSpace: 'nowrap' }}>
                        {log.ip_address || '—'}
                      </td>

                      <td style={{ padding: '10px 12px' }}>
                        {hasChanges && (
                          <button onClick={() => setSelected(log)}
                            style={{
                              background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
                              color: 'white', border: 'none', borderRadius: 7,
                              padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 600,
                            }}>
                            🔍 Ko'rish
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Sahifa {filters.page} / {pages}  (jami {total})
            </div>
            <div className="flex gap-2">
              <button disabled={filters.page <= 1} onClick={() => setPage(filters.page - 1)}
                style={{ padding:'5px 12px', borderRadius:7, fontSize:13, cursor: filters.page<=1?'default':'pointer',
                  background:'var(--card-bg)', border:'1px solid var(--border-subtle)',
                  color: filters.page<=1 ? 'var(--text-muted)' : 'var(--text-primary)', opacity: filters.page<=1?0.5:1 }}>
                ‹ Oldingi
              </button>
              {Array.from({ length: Math.min(7, pages) }, (_, i) => {
                const p = filters.page <= 4
                  ? i + 1
                  : filters.page >= pages - 3
                    ? pages - 6 + i
                    : filters.page - 3 + i
                if (p < 1 || p > pages) return null
                return (
                  <button key={p} onClick={() => setPage(p)}
                    style={{ padding:'5px 10px', borderRadius:7, fontSize:13, cursor:'pointer', fontWeight: p===filters.page?700:400,
                      background: p===filters.page ? 'linear-gradient(135deg,#4f46e5,#7c3aed)' : 'var(--card-bg)',
                      border: '1px solid var(--border-subtle)',
                      color: p===filters.page ? 'white' : 'var(--text-primary)' }}>
                    {p}
                  </button>
                )
              })}
              <button disabled={filters.page >= pages} onClick={() => setPage(filters.page + 1)}
                style={{ padding:'5px 12px', borderRadius:7, fontSize:13, cursor: filters.page>=pages?'default':'pointer',
                  background:'var(--card-bg)', border:'1px solid var(--border-subtle)',
                  color: filters.page>=pages ? 'var(--text-muted)' : 'var(--text-primary)', opacity: filters.page>=pages?0.5:1 }}>
                Keyingi ›
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Changes modal */}
      <ChangesModal log={selected} onClose={() => setSelected(null)} />
    </div>
  )
}
