import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import useAuthStore from '../../store/authStore'
import useThemeStore from '../../store/themeStore'
import { getStatistics, getBirthdays, getPersons, deletePerson } from '../../api/persons'
import toast from 'react-hot-toast'
import { fmtDate } from '../../utils/date'

/* ── Animated counter ── */
function AnimCount({ to, duration = 900 }) {
  const [val, setVal] = useState(0)
  const raf = useRef(null)
  useEffect(() => {
    if (!to) return
    const start = performance.now()
    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1)
      setVal(Math.round(p * to))
      if (p < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [to])
  return val
}

const todayDate = new Date()

function daysUntil(birthDateStr) {
  if (!birthDateStr) return null
  const bd  = new Date(birthDateStr + 'T00:00:00')
  let next  = new Date(todayDate.getFullYear(), bd.getMonth(), bd.getDate())
  if (next < todayDate) next = new Date(todayDate.getFullYear() + 1, bd.getMonth(), bd.getDate())
  return Math.round((next - todayDate) / 86400000)
}
function isToday(birthDateStr) {
  if (!birthDateStr) return false
  const bd = new Date(birthDateStr + 'T00:00:00')
  return bd.getDate() === todayDate.getDate() && bd.getMonth() === todayDate.getMonth()
}


export default function AdminDashboard() {
  const [stats, setStats]     = useState(null)
  const [birthdays, setBirthdays] = useState([])
  const [recent, setRecent]   = useState([])
  const navigate   = useNavigate()
  const { logout } = useAuthStore()
  const { isDark } = useThemeStore()

  useEffect(() => {
    getStatistics().then(r => setStats(r.data))
    getBirthdays().then(r => {
      const sorted = [...r.data].sort((a, b) => (daysUntil(a.birth_date) ?? 999) - (daysUntil(b.birth_date) ?? 999))
      setBirthdays(sorted)
    })
    getPersons().then(r => setRecent(r.data.slice(0, 8)))
  }, [])

  const handleDelete = async (id, name) => {
    if (!confirm(`"${name}"ni o'chirib tashlamoqchimisiz?`)) return
    await deletePerson(id)
    toast.success("O'chirildi")
    getPersons().then(r => setRecent(r.data.slice(0, 8)))
    getStatistics().then(r => setStats(r.data))
  }

  if (!stats) return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <div className="text-4xl mb-3 animate-bounce">🌳</div>
        <div className="text-gray-400 text-sm">Yuklanmoqda...</div>
      </div>
    </div>
  )

  const todayBirthdays    = birthdays.filter(p => isToday(p.birth_date))
  const upcomingBirthdays = birthdays.filter(p => !isToday(p.birth_date))
  const vafot = (stats.total || 0) - (stats.alive || 0)

  /* Oila salomatligi hisoblash */
  const healthScore = (() => {
    if (!recent.length) return 0
    let score = 0
    recent.forEach(p => {
      if (p.photo) score += 25
      if (p.birth_date) score += 35
      if (p.birth_place) score += 20
      if (p.father_id || p.mother_id) score += 20
    })
    return Math.round(score / recent.length)
  })()

  const card = isDark ? '#1e293b' : '#ffffff'
  const border = isDark ? '#334155' : '#f1f5f9'
  const textPrimary = isDark ? '#f1f5f9' : '#1e293b'
  const textMuted = isDark ? '#64748b' : '#94a3b8'
  const textSecondary = isDark ? '#94a3b8' : '#64748b'

  return (
    <div className="ad-wrap" style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 24 }}>
      <style>{`
        @keyframes adSlideIn { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:none} }
        @keyframes adPop { 0%{transform:scale(0.9);opacity:0} 70%{transform:scale(1.04)} 100%{transform:scale(1);opacity:1} }
        @keyframes adShimmer { from{background-position:-200% 0} to{background-position:200% 0} }
        @keyframes adRing { 0%,100%{transform:rotate(0)} 20%{transform:rotate(-12deg)} 40%{transform:rotate(12deg)} 60%{transform:rotate(-7deg)} 80%{transform:rotate(7deg)} }
        @keyframes adFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
        @keyframes adPulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        .ad-qa-btn:hover { transform:translateY(-3px) scale(1.04) !important; box-shadow: 0 10px 28px rgba(0,0,0,0.18) !important; }
        .ad-qa-btn { transition: transform 0.2s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.2s !important; }
      `}</style>

      {/* ── Header ── */}
      <div className="ad-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', animation: 'adSlideIn 0.4s ease both' }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: textPrimary, margin: 0, letterSpacing: '-0.02em' }}>
            Xush kelibsiz, Admin! 👋
          </h1>
          <p style={{ fontSize: 14, color: textMuted, marginTop: 4 }}>
            {fmtDate(todayDate.toISOString().slice(0,10))} · {todayBirthdays.length > 0
              ? <span style={{ color: '#f59e0b', fontWeight: 700 }}>🎉 Bugun {todayBirthdays.length} kishi tug'ilgan kuni!</span>
              : "Bugun tug'ilgan kun yo'q"}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => navigate('/admin/reminders')}>
            <div style={{
              width: 42, height: 42, borderRadius: 13, background: card,
              border: `1px solid ${border}`, display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: 20,
              animation: birthdays.length > 0 ? 'adRing 2.5s ease infinite' : 'none',
            }}>🔔</div>
            {birthdays.length > 0 && (
              <span style={{ position: 'absolute', top: -4, right: -4, width: 20, height: 20, borderRadius: '50%', background: '#ef4444', color: 'white', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{birthdays.length}</span>
            )}
          </div>
          <button onClick={() => { logout(); navigate('/login') }}
            className="ad-exit-btn"
            style={{ padding: '10px 18px', borderRadius: 12, border: 'none', cursor: 'pointer', background: '#fef2f2', color: '#dc2626', fontSize: 13, fontWeight: 700 }}>
            🚪 Chiqish
          </button>
        </div>
      </div>

      {/* ── Yangi kreativ bo'limlar ── */}
      <div className="ad-top-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, animation: 'adSlideIn 0.45s 0.08s ease both' }}>

        {/* 1. Tezkor amallar */}
        <div style={{
          background: card, borderRadius: 20, border: `1px solid ${border}`,
          padding: '20px 20px 18px', boxShadow: '0 2px 16px rgba(0,0,0,0.06)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg,#6366f1,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17 }}>⚡</div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 900, color: textPrimary }}>Tezkor amallar</div>
              <div style={{ fontSize: 12, color: textMuted }}>Bir bosishda o'ting</div>
            </div>
          </div>
          <div className="ad-qa-list" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { icon: '➕', label: "Yangi shaxs", sub: "qo'shish", grad: 'linear-gradient(135deg,#6366f1,#7c3aed)', path: '/admin/persons/add' },
              { icon: '🔗', label: "Ota-ona", sub: "bog'lash", grad: 'linear-gradient(135deg,#10b981,#059669)', path: '/admin/link' },
              { icon: '📊', label: "Statistika", sub: "ko'rish", grad: 'linear-gradient(135deg,#f59e0b,#d97706)', path: '/admin/stats' },
              { icon: '👥', label: "Foydalanuvchilar", sub: "boshqarish", grad: 'linear-gradient(135deg,#0ea5e9,#3b82f6)', path: '/admin/users' },
              { icon: '🔔', label: "Eslatmalar", sub: "ko'rish", grad: 'linear-gradient(135deg,#f43f5e,#e11d48)', path: '/admin/reminders' },
              { icon: '📋', label: "Audit log", sub: "tekshirish", grad: 'linear-gradient(135deg,#8b5cf6,#7c3aed)', path: '/admin/audit' },
            ].reduce((rows, item, i) => {
              if (i % 2 === 0) rows.push([item])
              else rows[rows.length - 1].push(item)
              return rows
            }, []).map((row, ri) => (
              <div key={ri} style={{ display: 'flex', gap: 8 }}>
                {row.map(({ icon, label, sub, grad, path }) => (
                  <button key={path} className="ad-qa-btn"
                    onClick={() => navigate(path)}
                    style={{
                      flex: 1, background: isDark ? '#0f172a' : '#f8fafc',
                      border: `1px solid ${border}`,
                      borderRadius: 12, padding: '10px 14px', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left',
                    }}>
                    <div style={{ width: 32, height: 32, borderRadius: 10, background: grad, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{icon}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: textPrimary, lineHeight: 1.2 }}>{label}</div>
                      <div style={{ fontSize: 12, color: textMuted }}>{sub}</div>
                    </div>
                    <span style={{ fontSize: 14, color: textMuted, flexShrink: 0 }}>›</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* 2. Oila salomatligi */}
        <div style={{
          background: card, borderRadius: 20, border: `1px solid ${border}`,
          padding: '20px 20px 18px', boxShadow: '0 2px 16px rgba(0,0,0,0.06)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg,#10b981,#059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, animation: 'adFloat 3s ease infinite' }}>🌳</div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 900, color: textPrimary }}>Shajara holati</div>
              <div style={{ fontSize: 12, color: textMuted }}>Ma'lumotlar to'liqligi</div>
            </div>
          </div>

          {/* Katta raqam */}
          <div style={{ textAlign: 'center', marginBottom: 18 }}>
            <span style={{
              display: 'inline-block',
              fontSize: 64, fontWeight: 900, lineHeight: 1,
              color: healthScore >= 70 ? '#10b981' : healthScore >= 40 ? '#f59e0b' : '#ef4444',
            }}>
              <AnimCount to={healthScore} />
            </span>
            <div style={{ fontSize: 13, color: textMuted, fontWeight: 600, marginTop: 2 }}>ball / 100</div>
            <div style={{ fontSize: 12, color: healthScore >= 70 ? '#10b981' : healthScore >= 40 ? '#f59e0b' : '#ef4444', fontWeight: 700, marginTop: 3 }}>
              {healthScore >= 70 ? '🟢 Ajoyib holat' : healthScore >= 40 ? '🟡 O\'rta holat' : '🔴 To\'ldirish kerak'}
            </div>
          </div>

          {/* Progress bar lar */}
          {[
            { label: "Suratlar", icon: '📷', pct: recent.length ? Math.round(recent.filter(p=>p.photo).length/recent.length*100) : 0, color: '#6366f1' },
            { label: "Tug'ilgan sana", icon: '📅', pct: recent.length ? Math.round(recent.filter(p=>p.birth_date).length/recent.length*100) : 0, color: '#10b981' },
            { label: "Ota-ona bog'liq", icon: '👨‍👩‍👧', pct: recent.length ? Math.round(recent.filter(p=>p.father_id||p.mother_id).length/recent.length*100) : 0, color: '#f59e0b' },
          ].map(({ label, icon, pct, color }) => (
            <div key={label} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 13, color: textSecondary, fontWeight: 600 }}>{icon} {label}</span>
                <span style={{ fontSize: 13, fontWeight: 800, color }}>{pct}%</span>
              </div>
              <div style={{ height: 6, borderRadius: 4, background: isDark ? '#1e293b' : '#f1f5f9', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 4, background: color, width: `${pct}%`, transition: 'width 1s ease' }} />
              </div>
            </div>
          ))}
        </div>

        {/* 3. Jins & holat statistikasi (mini, interaktiv) */}
        <div style={{
          background: card, borderRadius: 20, border: `1px solid ${border}`,
          padding: '20px 20px 18px', boxShadow: '0 2px 16px rgba(0,0,0,0.06)',
          display: 'flex', flexDirection: 'column', gap: 14,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg,#f59e0b,#d97706)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17 }}>📈</div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 900, color: textPrimary }}>Umumiy ko'rsatkichlar</div>
              <div style={{ fontSize: 12, color: textMuted }}>Statistikadan qisqa</div>
            </div>
          </div>

          {/* Jami + Yaqin — teng kenglikda yonma-yon */}
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { icon: '👨‍👩‍👧‍👦', label: "Jami a'zo", value: stats.total, grad: 'linear-gradient(135deg,#6366f1,#7c3aed)', glow: 'rgba(99,102,241,0.3)' },
              { icon: '🎂', label: 'Yaqin bayram', value: upcomingBirthdays.length, grad: 'linear-gradient(135deg,#f59e0b,#d97706)', glow: 'rgba(245,158,11,0.3)' },
            ].map(({ icon, label, value, grad, glow }) => (
              <div key={label} style={{
                flex: 1, background: grad, borderRadius: 12,
                padding: '12px 16px', color: 'white', boxShadow: `0 4px 14px ${glow}`,
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <span style={{ fontSize: 22, flexShrink: 0 }}>{icon}</span>
                <span style={{ flex: 1, fontSize: 12, fontWeight: 700, opacity: 0.9, lineHeight: 1.3 }}>{label}</span>
                <span style={{ fontSize: 28, fontWeight: 900, lineHeight: 1, flexShrink: 0 }}><AnimCount to={value || 0} /></span>
              </div>
            ))}
          </div>

          {/* Erkak/Ayol nisbati */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: textPrimary, marginBottom: 7 }}>
              👨 Erkaklar vs 👩 Ayollar
            </div>
            <div style={{ display: 'flex', height: 26, borderRadius: 8, overflow: 'hidden', gap: 2 }}>
              {stats.total > 0 && <>
                <div style={{ flex: stats.male, background: 'linear-gradient(135deg,#0ea5e9,#3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: 'white' }}>{stats.male}</div>
                <div style={{ flex: stats.female, background: 'linear-gradient(135deg,#ec4899,#db2777)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: 'white' }}>{stats.female}</div>
              </>}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
              <span style={{ fontSize: 12.5, color: '#0ea5e9', fontWeight: 700 }}>👨 {stats.total ? Math.round(stats.male/stats.total*100) : 0}%</span>
              <span style={{ fontSize: 12.5, color: '#ec4899', fontWeight: 700 }}>👩 {stats.total ? Math.round(stats.female/stats.total*100) : 0}%</span>
            </div>
          </div>

          {/* Tirik / Vafot — teng kenglikda yonma-yon */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: textPrimary, marginBottom: 7 }}>💚 Tirik / 🕯️ Vafot etgan</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, background: isDark ? '#0f172a' : '#f0fdf4', borderRadius: 11, padding: '10px 14px', border: '1px solid #bbf7d0' }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>💚</span>
                <span style={{ flex: 1, fontSize: 12, fontWeight: 700, color: '#10b981' }}>Tirik</span>
                <span style={{ fontSize: 22, fontWeight: 900, color: '#10b981', flexShrink: 0 }}><AnimCount to={stats.alive || 0} /></span>
                <span style={{ fontSize: 12, fontWeight: 800, color: '#10b981', flexShrink: 0 }}>{stats.total ? Math.round((stats.alive/stats.total)*100) : 0}%</span>
              </div>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, background: isDark ? '#0f172a' : '#f9fafb', borderRadius: 11, padding: '10px 14px', border: `1px solid ${border}` }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>🕯️</span>
                <span style={{ flex: 1, fontSize: 12, fontWeight: 700, color: textMuted }}>Vafot etgan</span>
                <span style={{ fontSize: 22, fontWeight: 900, color: textSecondary, flexShrink: 0 }}><AnimCount to={vafot} /></span>
                <span style={{ fontSize: 12, fontWeight: 800, color: textMuted, flexShrink: 0 }}>{stats.total ? Math.round((vafot/stats.total)*100) : 0}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── So'nggi qo'shilganlar (full width) ── */}
      <div style={{ background: card, borderRadius: 18, border: `1px solid ${border}`, overflow: 'hidden', boxShadow: '0 2px 16px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: `1px solid ${border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>🕐</span>
            <span style={{ fontWeight: 900, color: textPrimary, fontSize: 15 }}>So'nggi qo'shilganlar</span>
          </div>
          <button onClick={() => navigate('/admin/persons')}
            style={{ fontSize: 12, color: '#6366f1', fontWeight: 700, background: isDark?'#1e1b4b':'#eef2ff', border: 'none', cursor: 'pointer', padding: '4px 10px', borderRadius: 8 }}>
            Barchasi →
          </button>
        </div>
        {/* Desktop jadval */}
        <div className="ad-table-wrap" style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr><th>№</th><th>Shaxs</th><th>Jins</th><th>Holati</th><th>Amallar</th></tr>
            </thead>
            <tbody>
              {recent.map((p, i) => (
                <tr key={p.id}>
                  <td><span style={{ width:24,height:24,borderRadius:'50%',background:isDark?'#334155':'#f1f5f9',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:textSecondary }}>{i+1}</span></td>
                  <td>
                    <div style={{ display:'flex',alignItems:'center',gap:10 }}>
                      <div style={{ width:34,height:34,borderRadius:10,overflow:'hidden',flexShrink:0,background:p.gender==='male'?'#3b82f6':'#ec4899',display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontSize:14 }}>
                        {(p.photo_url||p.photo)?<img src={p.photo_url||p.photo} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/>:(p.gender==='male'?'👨':'👩')}
                      </div>
                      <span style={{ fontSize:14,fontWeight:700,color:textPrimary }}>{p.full_name}</span>
                    </div>
                  </td>
                  <td><span className={`badge ${p.gender==='male'?'badge-male':'badge-female'}`}>{p.gender==='male'?'👨 Erkak':'👩 Ayol'}</span></td>
                  <td>{p.death_date?<span className="badge badge-dead">🌿 Vafot etgan</span>:<span className="badge badge-alive">💚 Tirik</span>}</td>
                  <td>
                    <div style={{ display:'flex',gap:4 }}>
                      <button onClick={()=>navigate(`/admin/persons/${p.id}`)} style={{width:28,height:28,borderRadius:8,border:'none',background:'#eff6ff',color:'#2563eb',cursor:'pointer',fontSize:13}}>👁</button>
                      <button onClick={()=>navigate(`/admin/persons/${p.id}/edit`)} style={{width:28,height:28,borderRadius:8,border:'none',background:'#fffbeb',color:'#d97706',cursor:'pointer',fontSize:13}}>✏️</button>
                      <button onClick={()=>handleDelete(p.id,p.full_name)} style={{width:28,height:28,borderRadius:8,border:'none',background:'#fef2f2',color:'#dc2626',cursor:'pointer',fontSize:13}}>🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Mobile card list */}
        <div className="ad-card-list">
          {recent.map((p, i) => (
            <div key={p.id} style={{
              display:'flex', alignItems:'center', gap:10,
              padding:'10px 14px', borderBottom:`1px solid ${border}`,
            }}>
              <span style={{ fontSize:11,fontWeight:700,color:textMuted,width:18,flexShrink:0 }}>{i+1}</span>
              <div style={{ width:38,height:38,borderRadius:11,overflow:'hidden',flexShrink:0,
                background:p.gender==='male'?'#3b82f6':'#ec4899',
                display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontSize:16 }}>
                {(p.photo_url||p.photo)?<img src={p.photo_url||p.photo} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/>:(p.gender==='male'?'👨':'👩')}
              </div>
              <div style={{ flex:1,minWidth:0 }}>
                <div style={{ fontSize:13,fontWeight:800,color:textPrimary,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{p.full_name}</div>
                <div style={{ display:'flex',gap:5,marginTop:3,flexWrap:'wrap' }}>
                  <span className={`badge ${p.gender==='male'?'badge-male':'badge-female'}`} style={{fontSize:10}}>
                    {p.gender==='male'?'👨 Erkak':'👩 Ayol'}
                  </span>
                  {p.death_date
                    ?<span className="badge badge-dead" style={{fontSize:10}}>🌿 Vafot</span>
                    :<span className="badge badge-alive" style={{fontSize:10}}>💚 Tirik</span>
                  }
                </div>
              </div>
              <div style={{ display:'flex',gap:4,flexShrink:0 }}>
                <button onClick={()=>navigate(`/admin/persons/${p.id}`)} style={{width:30,height:30,borderRadius:9,border:'none',background:'#eff6ff',color:'#2563eb',cursor:'pointer',fontSize:14}}>👁</button>
                <button onClick={()=>navigate(`/admin/persons/${p.id}/edit`)} style={{width:30,height:30,borderRadius:9,border:'none',background:'#fffbeb',color:'#d97706',cursor:'pointer',fontSize:14}}>✏️</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Tug'ilgan kunlar — 2 col → 1 col mobile ── */}
      <div className="ad-bday-grid" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>

        {/* Bugun */}
        <div style={{ background:card, borderRadius:18, padding:'14px 16px', border:`1px solid ${border}` }}>
          <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10 }}>
            <div style={{ display:'flex',alignItems:'center',gap:7 }}>
              <span>🎂</span>
              <span style={{ fontWeight:900,color:textPrimary,fontSize:14 }}>Bugungi tug'ilganlar</span>
            </div>
            {todayBirthdays.length>0&&<span style={{background:'#fef3c7',color:'#d97706',padding:'2px 10px',borderRadius:20,fontSize:11,fontWeight:700}}>{todayBirthdays.length} ta</span>}
          </div>
          {todayBirthdays.length===0?(
            <div style={{textAlign:'center',padding:'12px 0',color:textMuted,fontSize:12}}>📅 Bugun yo'q</div>
          ):(
            <div style={{display:'flex',flexDirection:'column',gap:6}}>
              {todayBirthdays.map(p=>(
                <div key={p.id} onClick={()=>navigate(`/admin/persons/${p.id}`)}
                  style={{display:'flex',alignItems:'center',gap:8,padding:'8px 10px',borderRadius:12,cursor:'pointer',background:'linear-gradient(135deg,#fef3c7,#fef9c3)',border:'1px solid #fde68a'}}>
                  <div style={{width:32,height:32,borderRadius:'50%',overflow:'hidden',background:p.gender==='male'?'#3b82f6':'#ec4899',display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontSize:12,fontWeight:800,flexShrink:0}}>
                    {(p.photo_url||p.photo)?<img src={p.photo_url||p.photo} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/>:p.full_name?.[0]}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:700,color:'#92400e',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.full_name}</div>
                    <div style={{fontSize:11,color:'#b45309'}}>{p.age!=null?`${p.age+1} yosh 🎉`:"Bugun!"}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Yaqinlashayotgan */}
        <div style={{ background:card, borderRadius:18, padding:'14px 16px', border:`1px solid ${border}` }}>
          <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10 }}>
            <div style={{ display:'flex',alignItems:'center',gap:7 }}>
              <span>🗓️</span>
              <span style={{ fontWeight:900,color:textPrimary,fontSize:14 }}>Yaqin tug'ilgan kunlar</span>
            </div>
            {upcomingBirthdays.length>0&&<span className="badge badge-male">{upcomingBirthdays.length}</span>}
          </div>
          {upcomingBirthdays.length===0?(
            <div style={{textAlign:'center',padding:'12px 0',color:textMuted,fontSize:12}}>📆 Bu oyda yo'q</div>
          ):(
            <div style={{display:'flex',flexDirection:'column',gap:5,maxHeight:240,overflowY:'auto'}}>
              {upcomingBirthdays.slice(0,8).map(p=>{
                const days=daysUntil(p.birth_date)
                return(
                  <div key={p.id} onClick={()=>navigate(`/admin/persons/${p.id}`)}
                    style={{display:'flex',alignItems:'center',gap:8,padding:'7px 8px',borderRadius:10,cursor:'pointer',transition:'background 0.15s'}}
                    onMouseEnter={e=>e.currentTarget.style.background=isDark?'#334155':'#f8fafc'}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <div style={{width:28,height:28,borderRadius:'50%',overflow:'hidden',background:p.gender==='male'?'#6366f1':'#ec4899',display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontSize:11,fontWeight:800,flexShrink:0}}>
                      {(p.photo_url||p.photo)?<img src={p.photo_url||p.photo} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/>:p.full_name?.[0]}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:11,fontWeight:700,color:textPrimary,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.full_name}</div>
                      <div style={{fontSize:10,color:textMuted}}>{fmtDate(p.birth_date)}</div>
                    </div>
                    {days!=null&&(
                      <span style={{fontSize:11,fontWeight:800,padding:'3px 8px',borderRadius:20,flexShrink:0,background:days<=7?'#fef3c7':(isDark?'#1e1b4b':'#eef2ff'),color:days<=7?'#d97706':'#6366f1'}}>
                        {days===0?'Bugun!':`${days}k`}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
