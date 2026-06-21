import { useEffect, useState } from 'react'
import { getInvites, createInvite, deleteInvite, getPersons } from '../../api/persons'
import toast from 'react-hot-toast'

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => toast.success('✅ Nusxa olindi!'))
}

export default function AdminInvites() {
  const [invites,  setInvites]  = useState([])
  const [persons,  setPersons]  = useState([])
  const [loading,  setLoading]  = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ person: '', note: '', expires_days: '' })

  const load = () => {
    setLoading(true)
    Promise.all([getInvites(), getPersons({ page_size: 1000 })])
      .then(([inv, prs]) => { setInvites(inv.data); setPersons(prs.data) })
      .catch(() => toast.error('Yuklab bo\'lmadi'))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const handleCreate = async () => {
    try {
      const res = await createInvite({
        person: form.person || null,
        note: form.note,
        expires_days: form.expires_days || null,
      })
      toast.success('✅ Invite yaratildi!')
      setForm({ person: '', note: '', expires_days: '' })
      setShowForm(false)
      load()
    } catch { toast.error('Xato') }
  }

  const handleDelete = async (id) => {
    if (!confirm('Inviteni o\'chirasizmi?')) return
    await deleteInvite(id)
    toast.success('🗑️ O\'chirildi')
    load()
  }

  const fmtDate = (d) => d ? new Date(d).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' }) : '—'

  return (
    <div className="p-6 space-y-5 page-enter" style={{ color: 'var(--text-primary)' }}>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">📨 Invitlar</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 2 }}>
            Oila a'zolarini tizimga taklif qilish — {invites.length} ta invite
          </p>
        </div>
        <button onClick={() => setShowForm(v => !v)}
          style={{
            background: showForm ? '#fee2e2' : 'linear-gradient(135deg,#4f46e5,#7c3aed)',
            color: showForm ? '#dc2626' : 'white',
            border: showForm ? '1px solid #fca5a5' : 'none',
            padding: '8px 18px', borderRadius: 10, cursor: 'pointer',
            fontWeight: 700, fontSize: 13,
          }}>
          {showForm ? '✕ Yopish' : '➕ Yangi invite'}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="admin-card p-5 space-y-4">
          <h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>Yangi invite yaratish</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                👤 Shaxs (ixtiyoriy)
              </label>
              <select value={form.person} onChange={e => setForm(f => ({ ...f, person: e.target.value }))}
                className="input-field" style={{ width: '100%', padding: '8px 10px', fontSize: 13 }}>
                <option value="">— Tanlang —</option>
                {persons.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.full_name}{p.birth_date ? ` (${new Date(p.birth_date).getFullYear()})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                📝 Izoh (kim uchun)
              </label>
              <input type="text" value={form.note}
                onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                className="input-field" placeholder="Akam uchun..."
                style={{ width: '100%', padding: '8px 10px', fontSize: 13 }} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                ⏰ Muddati (kun, ixtiyoriy)
              </label>
              <input type="number" min="1" max="365" value={form.expires_days}
                onChange={e => setForm(f => ({ ...f, expires_days: e.target.value }))}
                className="input-field" placeholder="7"
                style={{ width: '100%', padding: '8px 10px', fontSize: 13 }} />
            </div>
          </div>
          <button onClick={handleCreate}
            style={{
              background: 'linear-gradient(135deg,#10b981,#059669)',
              color: 'white', border: 'none', padding: '8px 20px',
              borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 13,
            }}>
            ✅ Invite yaratish
          </button>
        </div>
      )}

      {/* Info card */}
      <div className="admin-card p-4 flex items-start gap-3"
        style={{ background: 'linear-gradient(135deg,#eff6ff,#f0fdf4)', border: '1px solid #bfdbfe' }}>
        <div style={{ fontSize: 24 }}>💡</div>
        <div style={{ fontSize: 13, color: '#1e40af' }}>
          <strong>Qanday ishlaydi?</strong> Invite yarating → havolani nusxalab oling →
          oila a'zosiga yuboring → u shu havola orqali ro'yxatdan o'tadi va
          avtomatik ravishda uning profili tizimga bog'lanadi.
        </div>
      </div>

      {/* Table */}
      <div className="admin-card overflow-hidden">
        {loading ? (
          <div className="p-10 text-center" style={{ color: 'var(--text-secondary)' }}>⏳ Yuklanmoqda...</div>
        ) : invites.length === 0 ? (
          <div className="p-10 text-center" style={{ color: 'var(--text-secondary)' }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>📭</div>
            <div>Hali invite yaratilmagan</div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'rgba(99,102,241,0.07)' }}>
                {['Shaxs', 'Izoh', 'Holati', 'Muddati', 'Yaratilgan', 'Havola', ''].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600,
                    color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-subtle)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invites.map(inv => (
                <tr key={inv.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {inv.person_name || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Belgilanmagan</span>}
                    </div>
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>
                    {inv.note || '—'}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    {inv.used ? (
                      <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                        background: '#dcfce7', color: '#16a34a' }}>
                        ✅ Ishlatilgan ({inv.used_by_name})
                      </span>
                    ) : inv.is_expired ? (
                      <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                        background: '#fee2e2', color: '#dc2626' }}>
                        ⏰ Muddati o'tgan
                      </span>
                    ) : (
                      <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                        background: '#fef3c7', color: '#d97706' }}>
                        ⏳ Kutilmoqda
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', fontSize: 11 }}>
                    {inv.expires_at ? fmtDate(inv.expires_at) : '♾️ Cheksiz'}
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-muted)', fontSize: 11 }}>
                    {fmtDate(inv.created_at)}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <button onClick={() => copyToClipboard(inv.invite_url)}
                      style={{
                        background: '#f0fdf4', color: '#16a34a', border: '1px solid #86efac',
                        padding: '4px 10px', borderRadius: 7, fontSize: 11,
                        cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4,
                      }}>
                      📋 Nusxa
                    </button>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    {!inv.used && (
                      <button onClick={() => handleDelete(inv.id)}
                        style={{
                          background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5',
                          padding: '4px 10px', borderRadius: 7, fontSize: 11, cursor: 'pointer',
                        }}>
                        🗑️
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
