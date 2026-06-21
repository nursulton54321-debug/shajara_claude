import { useEffect, useState } from 'react'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import { fmtDate } from '../../utils/date'
import useThemeStore from '../../store/themeStore'
import useAuthStore from '../../store/authStore'

/* ── Yangi foydalanuvchi qo'shish modal ── */
function AddUserModal({ onClose, onAdded, isDark }) {
  const [form, setForm] = useState({
    first_name: '', last_name: '', username: '', password: '', role: 'user'
  })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const bg   = isDark ? '#0f172a' : '#ffffff'
  const bg2  = isDark ? '#1e293b' : '#f8fafc'
  const brd  = isDark ? '#334155' : '#e2e8f0'
  const txt  = isDark ? '#f1f5f9' : '#1e293b'
  const muted= isDark ? '#94a3b8' : '#64748b'

  async function submit(e) {
    e.preventDefault()
    if (!form.username || !form.password) { setError("Username va parol majburiy"); return }
    setLoading(true); setError('')
    try {
      const res = await api.post('/auth/register/', form)
      // Rol admin bo'lsa alohida patch qilamiz (register read_only)
      if (form.role === 'admin' && res.data?.id) {
        await api.patch(`/auth/users/${res.data.id}/`, { role: 'admin' })
      }
      toast.success(`✅ ${form.username} qo'shildi`)
      onAdded()
      onClose()
    } catch (err) {
      const d = err?.response?.data
      setError(
        typeof d === 'string' ? d
        : d?.username?.[0] || d?.password?.[0] || d?.detail
        || "Xatolik yuz berdi"
      )
    } finally { setLoading(false) }
  }

  const inp = {
    width:'100%', padding:'10px 13px', borderRadius:11,
    border:`1.5px solid ${brd}`, background:bg2, color:txt,
    fontSize:13, fontWeight:500, outline:'none', boxSizing:'border-box',
  }

  return (
    <div onClick={e => e.target===e.currentTarget && onClose()} style={{
      position:'fixed', inset:0, zIndex:99999,
      background:'rgba(0,0,0,0.55)', backdropFilter:'blur(8px)',
      display:'flex', alignItems:'center', justifyContent:'center', padding:16,
    }}>
      <div style={{
        width:'100%', maxWidth:440, background:bg, borderRadius:22,
        border:`1.5px solid ${brd}`, padding:'28px 28px 24px',
        boxShadow: isDark
          ? '0 32px 80px rgba(0,0,0,0.65)'
          : '0 32px 80px rgba(0,0,0,0.14)',
        animation:'confirmSlideUp 0.25s cubic-bezier(0.34,1.4,0.64,1)',
      }}>
        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{
              width:40, height:40, borderRadius:12,
              background:'linear-gradient(135deg,#6366f1,#8b5cf6)',
              display:'flex', alignItems:'center', justifyContent:'center', fontSize:20,
              boxShadow:'0 4px 16px rgba(99,102,241,0.4)',
            }}>👤</div>
            <div>
              <div style={{ fontSize:17, fontWeight:900, color:txt }}>Yangi foydalanuvchi</div>
              <div style={{ fontSize:11.5, color:muted }}>Superadmin tomonidan qo'shiladi</div>
            </div>
          </div>
          <button onClick={onClose} style={{
            width:30, height:30, borderRadius:8, border:'none', cursor:'pointer',
            background: isDark?'#334155':'#f1f5f9', color:muted, fontSize:16,
          }}>×</button>
        </div>

        <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:11 }}>
          <div style={{ display:'flex', gap:10 }}>
            <input placeholder="Ism" value={form.first_name}
              onChange={e => set('first_name', e.target.value)} style={inp} />
            <input placeholder="Familiya" value={form.last_name}
              onChange={e => set('last_name', e.target.value)} style={inp} />
          </div>
          <input placeholder="Username *" value={form.username} required
            onChange={e => set('username', e.target.value)} style={inp} />
          <input placeholder="Parol *" type="password" value={form.password} required
            onChange={e => set('password', e.target.value)}
            autoComplete="new-password" style={inp} />

          {/* Rol tanlash */}
          <div style={{ display:'flex', gap:8 }}>
            {[
              { v:'user',  label:'👤 Foydalanuvchi', grad:'linear-gradient(135deg,#475569,#334155)', active:'linear-gradient(135deg,#6366f1,#4f46e5)' },
              { v:'admin', label:'🛡️ Admin',          grad:'linear-gradient(135deg,#475569,#334155)', active:'linear-gradient(135deg,#f59e0b,#d97706)' },
            ].map(({ v, label, grad, active }) => (
              <button key={v} type="button" onClick={() => set('role', v)}
                style={{
                  flex:1, padding:'10px 0', borderRadius:11, border:'none', cursor:'pointer',
                  background: form.role===v ? active : grad,
                  color:'white', fontSize:12.5, fontWeight:700,
                  boxShadow: form.role===v ? '0 4px 16px rgba(99,102,241,0.35)' : 'none',
                  transition:'all 0.18s',
                }}>
                {label}
              </button>
            ))}
          </div>

          {error && (
            <div style={{
              padding:'9px 13px', borderRadius:10, fontSize:12.5, fontWeight:600,
              background: isDark?'#450a0a':'#fef2f2',
              border:`1px solid ${isDark?'#7f1d1d':'#fecaca'}`,
              color: isDark?'#f87171':'#dc2626',
            }}>{error}</div>
          )}

          <div style={{ display:'flex', gap:8, marginTop:4 }}>
            <button type="button" onClick={onClose} style={{
              flex:1, padding:'11px', borderRadius:12, cursor:'pointer',
              border:`1.5px solid ${brd}`, background:'transparent', color:muted,
              fontSize:13, fontWeight:700,
            }}>Bekor qilish</button>
            <button type="submit" disabled={loading} style={{
              flex:2, padding:'11px', borderRadius:12, border:'none',
              cursor: loading?'wait':'pointer',
              background: loading
                ? (isDark?'#334155':'#e2e8f0')
                : 'linear-gradient(135deg,#6366f1,#8b5cf6)',
              color: loading ? muted : 'white',
              fontSize:13, fontWeight:800,
              boxShadow: loading ? 'none' : '0 4px 16px rgba(99,102,241,0.4)',
              transition:'all 0.18s',
            }}>
              {loading ? '⏳ Saqlanmoqda...' : "✓ Qo'shish"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════ */
export default function AdminUsers() {
  const [users, setUsers]     = useState([])
  const [showAdd, setShowAdd] = useState(false)
  const { isDark } = useThemeStore()
  const { user: me } = useAuthStore()

  const isSuperuser = me?.is_superuser

  const load = () => api.get('/auth/users/').then(r => setUsers(r.data))
  useEffect(() => { load() }, [])

  const toggleRole = async (u) => {
    const newRole = u.role === 'admin' ? 'user' : 'admin'
    if (!confirm(`"${u.username}"ni ${newRole === 'admin' ? 'Admin' : 'Foydalanuvchi'}ga o'tkazasizmi?`)) return
    await api.patch(`/auth/users/${u.id}/`, { role: newRole })
    toast.success("Rol o'zgartirildi")
    load()
  }

  const handleDelete = async (u) => {
    if (!confirm(`"${u.username}"ni o'chirish?`)) return
    await api.delete(`/auth/users/${u.id}/`)
    toast.success("O'chirildi")
    load()
  }

  const bg      = isDark ? '#1e293b' : '#ffffff'
  const bgSubtle= isDark ? '#0f172a' : '#f8fafc'
  const border  = isDark ? '#334155' : '#f1f5f9'
  const text1   = isDark ? '#f1f5f9' : '#1e293b'
  const text2   = isDark ? '#94a3b8' : '#64748b'
  const text3   = isDark ? '#64748b' : '#94a3b8'
  const hov     = isDark ? '#334155' : '#f8fafc'

  return (
    <div style={{ padding:24, color:text1 }}>
      {showAdd && (
        <AddUserModal
          isDark={isDark}
          onClose={() => setShowAdd(false)}
          onAdded={load}
        />
      )}

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:900, color:text1, margin:0 }}>👥 Foydalanuvchilar</h1>
          <div style={{ fontSize:12.5, color:text3, marginTop:3 }}>
            Jami: {users.length} ta foydalanuvchi
          </div>
        </div>

        {/* Faqat superuser qo'sha oladi */}
        {isSuperuser && (
          <button onClick={() => setShowAdd(true)} style={{
            display:'flex', alignItems:'center', gap:8,
            padding:'10px 18px', borderRadius:12, border:'none', cursor:'pointer',
            background:'linear-gradient(135deg,#6366f1,#8b5cf6)',
            color:'white', fontSize:13, fontWeight:800,
            boxShadow:'0 4px 18px rgba(99,102,241,0.45)',
            transition:'all 0.2s',
          }}
            onMouseEnter={e => { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 8px 24px rgba(99,102,241,0.55)' }}
            onMouseLeave={e => { e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow='0 4px 18px rgba(99,102,241,0.45)' }}>
            ＋ Yangi foydalanuvchi
          </button>
        )}
      </div>

      {/* Table */}
      <div style={{
        background:bg, borderRadius:16, border:`1px solid ${border}`,
        overflow:'hidden', boxShadow:'0 2px 16px rgba(0,0,0,0.06)',
      }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead>
            <tr style={{ background:bgSubtle }}>
              {['#','Foydalanuvchi','Email','Rol',"Qo'shilgan sana",'Amallar'].map(h => (
                <th key={h} style={{
                  textAlign:'left', padding:'12px 16px', fontWeight:700,
                  color:text2, borderBottom:`1px solid ${border}`, fontSize:12,
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((u, i) => (
              <tr key={u.id}
                style={{ borderTop: i>0 ? `1px solid ${border}` : 'none', transition:'background 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background=hov}
                onMouseLeave={e => e.currentTarget.style.background='transparent'}>

                {/* № */}
                <td style={{ padding:'12px 16px', color:text3, fontSize:12, width:40 }}>
                  {i + 1}
                </td>

                {/* Avatar + ism */}
                <td style={{ padding:'12px 16px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{
                      width:34, height:34, borderRadius:'50%', flexShrink:0,
                      background: u.role==='admin'
                        ? 'linear-gradient(135deg,#f59e0b,#d97706)'
                        : 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      color:'white', fontSize:13, fontWeight:800,
                    }}>
                      {u.first_name?.[0] || u.username?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div>
                      <div style={{ fontWeight:700, color:text1, fontSize:13 }}>
                        {u.first_name || u.last_name
                          ? `${u.first_name} ${u.last_name}`.trim()
                          : '—'}
                      </div>
                      <div style={{ fontSize:11, color:text3 }}>@{u.username}</div>
                    </div>
                  </div>
                </td>

                {/* Email */}
                <td style={{ padding:'12px 16px', color:text2 }}>{u.email || '—'}</td>

                {/* Rol */}
                <td style={{ padding:'12px 16px' }}>
                  <span style={{
                    fontSize:11, padding:'4px 11px', borderRadius:20, fontWeight:700,
                    background: u.role==='admin'
                      ? (isDark?'rgba(245,158,11,0.15)':'#fef3c7')
                      : (isDark?'#1e293b':'#f1f5f9'),
                    color: u.role==='admin'
                      ? (isDark?'#fbbf24':'#d97706')
                      : text2,
                    border: `1px solid ${u.role==='admin'
                      ? (isDark?'rgba(245,158,11,0.3)':'#fde68a')
                      : (isDark?'#334155':'#e2e8f0')}`,
                  }}>
                    {u.role==='admin' ? '🛡️ Admin' : '👤 Foydalanuvchi'}
                  </span>
                </td>

                {/* Sana */}
                <td style={{ padding:'12px 16px', color:text3, fontSize:12 }}>
                  {fmtDate(u.date_joined)}
                </td>

                {/* Amallar */}
                <td style={{ padding:'12px 16px' }}>
                  <div style={{ display:'flex', gap:6 }}>
                    <button onClick={() => toggleRole(u)} style={{
                      fontSize:12, padding:'6px 12px', borderRadius:9, border:'none', cursor:'pointer',
                      background: u.role==='admin'
                        ? (isDark?'rgba(99,102,241,0.15)':'#eef2ff')
                        : (isDark?'rgba(245,158,11,0.15)':'#fef3c7'),
                      color: u.role==='admin'
                        ? (isDark?'#a5b4fc':'#4f46e5')
                        : (isDark?'#fbbf24':'#d97706'),
                      fontWeight:600, transition:'all 0.15s',
                    }}
                      onMouseEnter={e => e.currentTarget.style.opacity='0.8'}
                      onMouseLeave={e => e.currentTarget.style.opacity='1'}>
                      {u.role==='admin' ? "↓ Userga" : "↑ Adminga"}
                    </button>
                    <button onClick={() => handleDelete(u)} style={{
                      fontSize:12, padding:'6px 12px', borderRadius:9, border:'none', cursor:'pointer',
                      background: isDark?'rgba(239,68,68,0.12)':'#fef2f2',
                      color: isDark?'#f87171':'#dc2626',
                      fontWeight:600, transition:'all 0.15s',
                    }}
                      onMouseEnter={e => e.currentTarget.style.opacity='0.8'}
                      onMouseLeave={e => e.currentTarget.style.opacity='1'}>
                      🗑
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {users.length === 0 && (
          <div style={{ textAlign:'center', padding:'40px', color:text3, fontSize:13 }}>
            Foydalanuvchilar yo'q
          </div>
        )}
      </div>

      {/* Stats cards */}
      {users.length > 0 && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginTop:16 }}>
          {[
            { label:'Jami', value:users.length, icon:'👥', color:'#6366f1', bg: isDark?'rgba(99,102,241,0.12)':'#eef2ff', brd: isDark?'rgba(99,102,241,0.25)':'#c7d2fe' },
            { label:'Adminlar', value:users.filter(u=>u.role==='admin').length, icon:'🛡️', color:'#f59e0b', bg: isDark?'rgba(245,158,11,0.12)':'#fef3c7', brd: isDark?'rgba(245,158,11,0.25)':'#fde68a' },
            { label:'Foydalanuvchilar', value:users.filter(u=>u.role==='user').length, icon:'👤', color:'#10b981', bg: isDark?'rgba(16,185,129,0.12)':'#d1fae5', brd: isDark?'rgba(16,185,129,0.25)':'#6ee7b7' },
          ].map(s => (
            <div key={s.label} style={{
              padding:'14px 18px', borderRadius:14,
              background:s.bg, border:`1px solid ${s.brd}`,
              display:'flex', alignItems:'center', gap:12,
            }}>
              <span style={{ fontSize:24 }}>{s.icon}</span>
              <div>
                <div style={{ fontSize:22, fontWeight:900, color:s.color, lineHeight:1 }}>{s.value}</div>
                <div style={{ fontSize:12, color:s.color, fontWeight:600, opacity:0.75, marginTop:2 }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
