import { useEffect, useState, useCallback } from 'react'
import { getReminders, getReminderStats, createReminder, updateReminder, deleteReminder, autoCreateReminders } from '../../api/reminders'
import { getPersons } from '../../api/persons'
import useThemeStore from '../../store/themeStore'
import toast from 'react-hot-toast'
import { fmtDate } from '../../utils/date'

const TYPE_OPTIONS = [
  { value: 'birthday',     label: "Tug'ilgan kun",         icon: '🎂', color: '#10b981' },
  { value: 'wedding',      label: "To'y / Nikoh",          icon: '💍', color: '#f43f5e' },
  { value: 'school_start', label: "O'qishga kirish",       icon: '🎒', color: '#6366f1' },
  { value: 'school_end',   label: "O'qishni tugatish",     icon: '🎓', color: '#8b5cf6' },
  { value: 'work_start',   label: "Ishga kirish",          icon: '💼', color: '#0ea5e9' },
  { value: 'work_end',     label: "Ishdan ketish",         icon: '🏠', color: '#64748b' },
  { value: 'military',     label: "Harbiy xizmat",         icon: '🎖️', color: '#d97706' },
  { value: 'hajj',         label: "Haj / Umra",            icon: '🕌', color: '#059669' },
  { value: 'award',        label: "Mukofot / Unvon",       icon: '🏆', color: '#f59e0b' },
  { value: 'move',         label: "Ko'chib o'tish",        icon: '🏡', color: '#ec4899' },
  { value: 'illness',      label: "Kasallik / Davolanish", icon: '🏥', color: '#ef4444' },
  { value: 'travel',       label: "Sayohat",               icon: '✈️', color: '#06b6d4' },
  { value: 'death',        label: "Vafot etgan kun",       icon: '🌿', color: '#6b7280' },
  { value: 'memorial',     label: "Xotira kuni",           icon: '🕯️', color: '#94a3b8' },
  { value: 'other',        label: "Boshqa",                icon: '📌', color: '#a855f7' },
]

const MONTHS = ['','Yanvar','Fevral','Mart','Aprel','May','Iyun','Iyul','Avgust','Sentabr','Oktabr','Noyabr','Dekabr']

const daysInfo = (d) => {
  if (d === 0) return { color: '#a16207', bg: 'rgba(250,204,21,0.18)', text: 'Bugun! 🎉' }
  if (d <= 7)  return { color: '#d97706', bg: 'rgba(245,158,11,0.15)', text: `${d} kun qoldi` }
  if (d <= 30) return { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  text: `${d} kun qoldi` }
  return { color: '#64748b', bg: 'rgba(100,116,139,0.1)', text: `${d} kun qoldi` }
}

/* ── Modal ──────────────────────────────────────────────────── */
function ReminderModal({ onClose, onSave, persons, initial, isDark }) {
  const [form, setForm] = useState({
    person: '', type: 'birthday', date: '', note: '', is_active: true,
    ...initial,
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const bg     = isDark ? '#1e293b' : '#ffffff'
  const brd    = isDark ? '#334155' : '#e2e8f0'
  const txt1   = isDark ? '#f1f5f9' : '#1e293b'
  const txt2   = isDark ? '#94a3b8' : '#64748b'
  const inputBg= isDark ? '#0f172a' : '#f8fafc'

  return (
    <div style={{ position:'fixed', inset:0, zIndex:50, display:'flex', alignItems:'center',
      justifyContent:'center', padding:16, background:'rgba(0,0,0,0.55)', backdropFilter:'blur(6px)' }}>
      <div style={{ background:bg, borderRadius:20, width:'100%', maxWidth:440,
        boxShadow:'0 24px 60px rgba(0,0,0,0.35)', overflow:'hidden',
        animation:'scaleIn 0.22s cubic-bezier(0.34,1.56,0.64,1) both' }}>

        {/* Header */}
        <div style={{ background:'linear-gradient(135deg,#4f46e5,#7c3aed)',
          padding:'16px 20px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ color:'white', fontWeight:800, fontSize:15 }}>
              {initial ? '✏️ Eslatmani tahrirlash' : '➕ Yangi eslatma'}
            </div>
            <div style={{ color:'rgba(255,255,255,0.65)', fontSize:11, marginTop:2 }}>
              Muhim sanani belgilang
            </div>
          </div>
          <button onClick={onClose} style={{ width:32, height:32, borderRadius:'50%', border:'none',
            background:'rgba(255,255,255,0.15)', color:'white', cursor:'pointer', fontSize:16,
            display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
        </div>

        <form onSubmit={e => { e.preventDefault(); if(!form.person){toast.error('Shaxsni tanlang!');return} if(!form.date){toast.error('Sanani kiriting!');return} onSave(form) }}
          style={{ padding:20, display:'flex', flexDirection:'column', gap:14 }}>

          {/* Person */}
          <div>
            <label style={{ fontSize:10, fontWeight:700, color:txt2, textTransform:'uppercase',
              letterSpacing:'0.08em', display:'block', marginBottom:5 }}>👤 Shaxs</label>
            <select value={form.person} onChange={e => set('person', e.target.value)}
              style={{ width:'100%', padding:'9px 12px', borderRadius:10, border:`1.5px solid ${brd}`,
                background:inputBg, color:txt1, fontSize:13, outline:'none' }}>
              <option value="">-- Shaxsni tanlang --</option>
              {persons.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
            </select>
          </div>

          {/* Type */}
          <div>
            <label style={{ fontSize:10, fontWeight:700, color:txt2, textTransform:'uppercase',
              letterSpacing:'0.08em', display:'block', marginBottom:5 }}>🏷️ Eslatma turi</label>
            <select value={form.type} onChange={e => set('type', e.target.value)}
              style={{ width:'100%', padding:'9px 12px', borderRadius:10, border:`1.5px solid ${brd}`,
                background:inputBg, color:txt1, fontSize:13, outline:'none' }}>
              {TYPE_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
            </select>
          </div>

          {/* Date */}
          <div>
            <label style={{ fontSize:10, fontWeight:700, color:txt2, textTransform:'uppercase',
              letterSpacing:'0.08em', display:'block', marginBottom:5 }}>📅 Sana</label>
            <input type="date" value={form.date} onChange={e => set('date', e.target.value)}
              style={{ width:'100%', padding:'9px 12px', borderRadius:10, border:`1.5px solid ${brd}`,
                background:inputBg, color:txt1, fontSize:13, outline:'none', boxSizing:'border-box' }} />
          </div>

          {/* Note */}
          <div>
            <label style={{ fontSize:10, fontWeight:700, color:txt2, textTransform:'uppercase',
              letterSpacing:'0.08em', display:'block', marginBottom:5 }}>📝 Izoh (ixtiyoriy)</label>
            <textarea value={form.note} onChange={e => set('note', e.target.value)} rows={2}
              placeholder="Qo'shimcha ma'lumot..."
              style={{ width:'100%', padding:'9px 12px', borderRadius:10, border:`1.5px solid ${brd}`,
                background:inputBg, color:txt1, fontSize:13, outline:'none', resize:'none',
                fontFamily:'inherit', boxSizing:'border-box' }} />
          </div>

          {/* Active toggle */}
          <label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer' }}>
            <div onClick={() => set('is_active', !form.is_active)} style={{
              width:44, height:24, borderRadius:12, position:'relative', cursor:'pointer',
              background: form.is_active ? '#10b981' : (isDark ? '#334155' : '#e2e8f0'),
              transition:'background 0.2s',
            }}>
              <div style={{ position:'absolute', top:3, left: form.is_active ? 23 : 3,
                width:18, height:18, borderRadius:'50%', background:'white',
                transition:'left 0.2s', boxShadow:'0 1px 4px rgba(0,0,0,0.2)' }} />
            </div>
            <span style={{ fontSize:13, fontWeight:700, color:txt1 }}>
              {form.is_active ? '✅ Aktiv' : '❌ Nofaol'}
            </span>
          </label>

          {/* Actions */}
          <div style={{ display:'flex', gap:8, marginTop:4 }}>
            <button type="button" onClick={onClose} style={{
              flex:1, padding:'10px', borderRadius:12, border:`1.5px solid ${brd}`,
              background:'transparent', color:txt2, fontWeight:700, cursor:'pointer', fontSize:13 }}>
              Bekor qilish
            </button>
            <button type="submit" style={{
              flex:2, padding:'10px', borderRadius:12, border:'none',
              background:'linear-gradient(135deg,#4f46e5,#7c3aed)', color:'white',
              fontWeight:800, cursor:'pointer', fontSize:13,
              boxShadow:'0 4px 14px rgba(79,70,229,0.4)' }}>
              {initial ? '💾 Saqlash' : '➕ Qo\'shish'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ── Mobile reminder card ─────────────────────────────────── */
function ReminderCard({ r, i, isDark, onEdit, onDelete }) {
  const dc      = daysInfo(r.days_until ?? 999)
  const typeOpt = TYPE_OPTIONS.find(t => t.value === r.type)
  const bg      = isDark ? '#1e293b' : '#ffffff'
  const brd     = isDark ? '#334155' : '#f1f5f9'
  const txt1    = isDark ? '#f1f5f9' : '#1e293b'
  const txt2    = isDark ? '#94a3b8' : '#64748b'

  return (
    <div style={{ background:bg, borderRadius:16, border:`1px solid ${brd}`,
      boxShadow:'0 2px 12px rgba(0,0,0,0.06)', overflow:'hidden',
      animation:`fadeSlideUp 0.3s ease ${i * 40}ms both` }}>

      {/* Top accent line by type color */}
      <div style={{ height:3, background: typeOpt?.color || '#6366f1' }} />

      <div style={{ padding:'14px 14px 12px' }}>
        {/* Row 1: avatar + name + badge */}
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
          <div style={{ width:44, height:44, borderRadius:13, overflow:'hidden', flexShrink:0,
            display:'flex', alignItems:'center', justifyContent:'center',
            background: r.person_gender==='male'
              ? 'linear-gradient(135deg,#3b82f6,#6366f1)'
              : 'linear-gradient(135deg,#ec4899,#db2777)',
            color:'white', fontSize:16, fontWeight:800 }}>
            {r.person_photo
              ? <img src={r.person_photo} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" />
              : r.person_name?.[0]}
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:14, fontWeight:800, color:txt1, whiteSpace:'nowrap',
              overflow:'hidden', textOverflow:'ellipsis' }}>{r.person_name}</div>
            <div style={{ fontSize:11, color:txt2, marginTop:1 }}>#{i+1}</div>
          </div>
          <span style={{ padding:'4px 10px', borderRadius:20, fontSize:11, fontWeight:700,
            background: r.is_active ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.1)',
            color: r.is_active ? '#10b981' : '#ef4444' }}>
            {r.is_active ? '✅ Aktiv' : '❌ Nofaol'}
          </span>
        </div>

        {/* Row 2: type + date */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10 }}>
          <div style={{ padding:'8px 10px', borderRadius:10,
            background: isDark ? '#0f172a' : '#f8fafc', border:`1px solid ${brd}` }}>
            <div style={{ fontSize:9, color:txt2, fontWeight:700, textTransform:'uppercase',
              letterSpacing:'0.05em', marginBottom:3 }}>Turi</div>
            <div style={{ fontSize:13, fontWeight:800, color: typeOpt?.color || txt1 }}>
              {typeOpt?.icon} {r.type_display}
            </div>
          </div>
          <div style={{ padding:'8px 10px', borderRadius:10,
            background: isDark ? '#0f172a' : '#f8fafc', border:`1px solid ${brd}` }}>
            <div style={{ fontSize:9, color:txt2, fontWeight:700, textTransform:'uppercase',
              letterSpacing:'0.05em', marginBottom:3 }}>Sana</div>
            <div style={{ fontSize:12, fontWeight:800, color:txt1 }}>{fmtDate(r.date)}</div>
          </div>
        </div>

        {/* Days badge + note */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
          {r.days_until != null && (
            <span style={{ padding:'4px 10px', borderRadius:20, fontSize:11, fontWeight:700,
              background: dc.bg, color: dc.color }}>
              📅 {dc.text}
            </span>
          )}
          {r.note && (
            <span style={{ fontSize:11, color:txt2, flex:1,
              overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {r.note}
            </span>
          )}
          <div style={{ display:'flex', gap:6, flexShrink:0 }}>
            <button onClick={() => onEdit(r)} style={{ width:32, height:32, borderRadius:10, border:'none',
              background:'rgba(245,158,11,0.12)', color:'#d97706', cursor:'pointer',
              display:'flex', alignItems:'center', justifyContent:'center', fontSize:14 }}>✏️</button>
            <button onClick={() => onDelete(r.id)} style={{ width:32, height:32, borderRadius:10, border:'none',
              background:'rgba(239,68,68,0.1)', color:'#ef4444', cursor:'pointer',
              display:'flex', alignItems:'center', justifyContent:'center', fontSize:14 }}>🗑️</button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════ */
export default function AdminReminders() {
  const { isDark } = useThemeStore()
  const [reminders, setReminders] = useState([])
  const [stats, setStats]         = useState(null)
  const [persons, setPersons]     = useState([])
  const [loading, setLoading]     = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing]     = useState(null)
  const [showFilters, setShowFilters] = useState(false)

  const [filterType,   setFilterType]   = useState('')
  const [filterMonth,  setFilterMonth]  = useState('')
  const [filterYear,   setFilterYear]   = useState('')
  const [sort, setSort] = useState('nearest')

  const bg      = isDark ? '#0f172a' : '#f1f5f9'
  const cardBg  = isDark ? '#1e293b' : '#ffffff'
  const brd     = isDark ? '#334155' : '#f1f5f9'
  const txt1    = isDark ? '#f1f5f9' : '#1e293b'
  const txt2    = isDark ? '#94a3b8' : '#64748b'
  const inputBg = isDark ? '#0f172a' : '#f8fafc'

  const load = useCallback(async () => {
    setLoading(true)
    const params = { sort }
    if (filterType)  params.type  = filterType
    if (filterMonth) params.month = filterMonth
    if (filterYear)  params.year  = filterYear
    const [rRes, sRes] = await Promise.all([getReminders(params), getReminderStats()])
    setReminders(rRes.data)
    setStats(sRes.data)
    setLoading(false)
  }, [filterType, filterMonth, filterYear, sort])

  useEffect(() => { load() }, [load])
  useEffect(() => { getPersons().then(r => setPersons(r.data)) }, [])

  const handleSave = async (form) => {
    try {
      if (editing) {
        await updateReminder(editing.id, form); toast.success('✅ Yangilandi!')
      } else {
        await createReminder(form); toast.success('✅ Eslatma qo\'shildi!')
      }
      setShowModal(false); setEditing(null); load()
    } catch { toast.error('❌ Xato yuz berdi!') }
  }

  const handleDelete = async (id) => {
    if (!confirm('O\'chirib tashlamoqchimisiz?')) return
    await deleteReminder(id); toast.success('🗑️ O\'chirildi'); load()
  }

  const handleAuto = async () => {
    if (!confirm('Barcha shaxslarning tug\'ilgan va vafot sanalaridan avtomatik eslatma yaratilsinmi?')) return
    const res = await autoCreateReminders()
    toast.success(`✅ ${res.data.message}`); load()
  }

  const resetFilters = () => { setFilterType(''); setFilterMonth(''); setFilterYear(''); setSort('nearest') }

  const years = Array.from({ length: 80 }, (_, i) => new Date().getFullYear() - i)

  const statCards = [
    { label:'Jami eslatmalar',  value: stats?.total,             icon:'🔔', grad:'linear-gradient(135deg,#4f46e5,#6366f1)', glow:'rgba(79,70,229,0.4)' },
    { label:'Aktiv eslatmalar', value: stats?.active,            icon:'✅', grad:'linear-gradient(135deg,#059669,#10b981)', glow:'rgba(16,185,129,0.4)' },
    { label:'Kelgusi 30 kun',   value: stats?.next_30_days,      icon:'📅', grad:'linear-gradient(135deg,#d97706,#f59e0b)', glow:'rgba(245,158,11,0.4)' },
    { label:'Shu oy',           value: stats?.this_month,        icon:'🗓️', grad:'linear-gradient(135deg,#7c3aed,#8b5cf6)', glow:'rgba(139,92,246,0.4)' },
  ]

  return (
    <>
      <style>{`
        @keyframes scaleIn {
          from { opacity:0; transform: scale(0.9) }
          to   { opacity:1; transform: scale(1) }
        }
        @keyframes fadeSlideUp {
          from { opacity:0; transform: translateY(16px) }
          to   { opacity:1; transform: translateY(0) }
        }
        .rem-table-wrap { display: block; }
        .rem-cards-wrap { display: none; }
        @media (max-width: 640px) {
          .rem-wrap     { padding: 10px !important; gap: 10px !important; padding-bottom: 100px !important; }
          .rem-header   { flex-direction: column !important; align-items: flex-start !important; gap: 10px !important; }
          .rem-header-btns { width: 100% !important; }
          .rem-header-btns button { flex: 1 !important; font-size: 11px !important; padding: 9px 6px !important; }
          .rem-stat-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 8px !important; }
          .rem-stat-card { padding: 12px !important; border-radius: 14px !important; }
          .rem-stat-icon { width: 30px !important; height: 30px !important; font-size: 14px !important; border-radius: 9px !important; }
          .rem-stat-val  { font-size: 24px !important; }
          .rem-stat-lbl  { font-size: 9px !important; }
          .rem-filter-grid { grid-template-columns: 1fr 1fr !important; gap: 8px !important; }
          .rem-filter-actions { grid-column: 1 / -1 !important; }
          .rem-table-wrap { display: none !important; }
          .rem-cards-wrap { display: flex !important; flex-direction: column; gap: 10px; }
        }
      `}</style>

      <div className="rem-wrap" style={{ padding:20, display:'flex', flexDirection:'column', gap:18,
        background:bg, minHeight:'100%' }}>

        {/* ── Header ── */}
        <div className="rem-header" style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ width:40, height:40, borderRadius:12, flexShrink:0,
                background:'linear-gradient(135deg,#f59e0b,#d97706)',
                display:'flex', alignItems:'center', justifyContent:'center', fontSize:20,
                boxShadow:'0 4px 14px rgba(245,158,11,0.4)' }}>🔔</div>
              <div>
                <h1 style={{ fontSize:18, fontWeight:900, color:txt1, margin:0, lineHeight:1.2 }}>
                  Eslatmalar boshqaruvi
                </h1>
                <p style={{ fontSize:11, color:txt2, margin:0, marginTop:2 }}>Muhim sanalar va eslatmalar</p>
              </div>
            </div>
          </div>
          <div className="rem-header-btns" style={{ display:'flex', gap:8 }}>
            <button onClick={() => { setEditing(null); setShowModal(true) }} style={{
              padding:'10px 16px', borderRadius:12, border:'none', cursor:'pointer', fontWeight:800,
              fontSize:12, display:'flex', alignItems:'center', gap:6,
              background:'linear-gradient(135deg,#059669,#10b981)', color:'white',
              boxShadow:'0 4px 14px rgba(16,185,129,0.4)' }}>
              ➕ Yangi eslatma
            </button>
            <button onClick={handleAuto} style={{
              padding:'10px 16px', borderRadius:12, border:'none', cursor:'pointer', fontWeight:800,
              fontSize:12, display:'flex', alignItems:'center', gap:6,
              background:'linear-gradient(135deg,#4f46e5,#6366f1)', color:'white',
              boxShadow:'0 4px 14px rgba(79,70,229,0.4)' }}>
              🔄 Avtomatik yaratish
            </button>
          </div>
        </div>

        {/* ── Stat cards ── */}
        <div className="rem-stat-grid" style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
          {statCards.map(({ label, value, icon, grad, glow }) => (
            <div key={label} className="rem-stat-card" style={{
              background: grad, borderRadius:16, padding:'14px 16px',
              boxShadow: `0 6px 20px ${glow}`,
              display:'flex', alignItems:'center', gap:12, position:'relative', overflow:'hidden',
            }}>
              <div style={{ position:'absolute', top:-20, right:-20, width:70, height:70,
                borderRadius:'50%', background:'rgba(255,255,255,0.1)', pointerEvents:'none' }} />
              <div className="rem-stat-icon" style={{ width:40, height:40, borderRadius:12, flexShrink:0,
                background:'rgba(255,255,255,0.2)', backdropFilter:'blur(4px)',
                display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>{icon}</div>
              <div>
                <div className="rem-stat-val" style={{ fontSize:28, fontWeight:900, color:'white', lineHeight:1 }}>
                  {value ?? '—'}
                </div>
                <div className="rem-stat-lbl" style={{ fontSize:10, color:'rgba(255,255,255,0.75)',
                  fontWeight:700, marginTop:2 }}>{label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Filters ── */}
        <div style={{ background:cardBg, borderRadius:16, border:`1px solid ${brd}`,
          boxShadow:'0 2px 12px rgba(0,0,0,0.06)', overflow:'hidden' }}>
          <button onClick={() => setShowFilters(v => !v)}
            style={{ width:'100%', padding:'12px 16px', background:'transparent', border:'none',
              cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontSize:16 }}>🔽</span>
              <span style={{ fontSize:13, fontWeight:800, color:txt1 }}>Filtrlar</span>
              {(filterType || filterMonth || filterYear) && (
                <span style={{ padding:'2px 8px', borderRadius:20, fontSize:10, fontWeight:700,
                  background:'rgba(99,102,241,0.12)', color:'#6366f1' }}>Faol</span>
              )}
            </div>
            <span style={{ color:txt2, fontSize:18, transform: showFilters ? 'rotate(180deg)' : 'none',
              transition:'transform 0.2s' }}>⌄</span>
          </button>

          {showFilters && (
            <div style={{ padding:'0 16px 16px' }}>
              <div className="rem-filter-grid" style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
                {[
                  { label:'🏷️ Eslatma turi', value:filterType, setter:setFilterType,
                    options:[['','Barcha turlar'], ...TYPE_OPTIONS.map(t=>[t.value,`${t.icon} ${t.label}`])] },
                  { label:'📅 Oy', value:filterMonth, setter:setFilterMonth,
                    options:[['','Barcha oylar'], ...MONTHS.slice(1).map((m,i)=>[i+1,m])] },
                  { label:'📆 Yil', value:filterYear, setter:setFilterYear,
                    options:[['','Barcha yillar'], ...years.map(y=>[y,y])] },
                  { label:'📊 Saralash', value:sort, setter:setSort,
                    options:[['nearest',"Eng yaqin sana"],['date_asc',"Sana (o'sish)"],['date_desc',"Sana (kamayish)"],['name',"Ism bo'yicha"]] },
                ].map(({ label, value, setter, options }) => (
                  <div key={label}>
                    <label style={{ fontSize:10, color:txt2, fontWeight:700, display:'block', marginBottom:4 }}>{label}</label>
                    <select value={value} onChange={e => setter(e.target.value)}
                      style={{ width:'100%', padding:'8px 10px', borderRadius:10,
                        border:`1.5px solid ${brd}`, background:inputBg, color:txt1,
                        fontSize:12, outline:'none' }}>
                      {options.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                ))}

                <div className="rem-filter-actions" style={{ display:'flex', gap:8, alignItems:'flex-end' }}>
                  <button onClick={load} style={{ flex:1, padding:'9px', borderRadius:10, border:'none',
                    background:'linear-gradient(135deg,#4f46e5,#6366f1)', color:'white',
                    fontWeight:800, fontSize:12, cursor:'pointer',
                    display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}>
                    🔍 Filtrlash
                  </button>
                  <button onClick={resetFilters} style={{ padding:'9px 13px', borderRadius:10,
                    border:`1.5px solid ${brd}`, background:'transparent', color:txt2,
                    fontWeight:700, fontSize:12, cursor:'pointer' }}>
                    🔄
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── List header ── */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:16 }}>📋</span>
            <span style={{ fontSize:14, fontWeight:800, color:txt1 }}>Eslatmalar ro'yxati</span>
          </div>
          <span style={{ padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700,
            background: isDark ? '#334155' : '#f1f5f9', color:txt2 }}>
            Jami: {reminders.length} ta
          </span>
        </div>

        {/* ── Content ── */}
        {loading ? (
          <div style={{ textAlign:'center', padding:40 }}>
            <div style={{ fontSize:40, animation:'bounce 1s ease infinite', marginBottom:8 }}>🔔</div>
            <div style={{ fontSize:13, color:txt2 }}>Yuklanmoqda...</div>
          </div>
        ) : reminders.length === 0 ? (
          <div style={{ textAlign:'center', padding:48, background:cardBg, borderRadius:20,
            border:`1px solid ${brd}` }}>
            <div style={{ fontSize:48, marginBottom:12 }}>📭</div>
            <div style={{ fontSize:15, fontWeight:800, color:txt1, marginBottom:4 }}>Eslatmalar yo'q</div>
            <div style={{ fontSize:12, color:txt2 }}>Yangi eslatma qo'shing yoki filtrlarni o'zgartiring</div>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="rem-table-wrap" style={{ background:cardBg, borderRadius:16,
              border:`1px solid ${brd}`, overflow:'hidden',
              boxShadow:'0 2px 12px rgba(0,0,0,0.06)' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr style={{ background: isDark ? '#0f172a' : '#f8fafc',
                    borderBottom:`1px solid ${brd}` }}>
                    {['№','Rasm','Shaxs','Eslatma turi','Sana','Izoh','Holati','Amallar'].map(h => (
                      <th key={h} style={{ padding:'10px 12px', textAlign:'left', fontSize:10,
                        fontWeight:800, color:txt2, textTransform:'uppercase', letterSpacing:'0.06em',
                        whiteSpace:'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reminders.map((r, i) => {
                    const dc      = daysInfo(r.days_until ?? 999)
                    const typeOpt = TYPE_OPTIONS.find(t => t.value === r.type)
                    return (
                      <tr key={r.id} style={{ borderBottom:`1px solid ${brd}`,
                        transition:'background 0.15s' }}
                        onMouseEnter={e => e.currentTarget.style.background = isDark ? '#334155' : '#f8fafc'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <td style={{ padding:'10px 12px' }}>
                          <span style={{ width:24, height:24, borderRadius:'50%', fontSize:11,
                            fontWeight:800, color:txt2, background: isDark?'#334155':'#f1f5f9',
                            display:'flex', alignItems:'center', justifyContent:'center' }}>{i+1}</span>
                        </td>
                        <td style={{ padding:'10px 8px' }}>
                          <div style={{ width:36, height:36, borderRadius:10, overflow:'hidden',
                            display:'flex', alignItems:'center', justifyContent:'center',
                            color:'white', fontSize:14, fontWeight:800,
                            background: r.person_gender==='male'
                              ? 'linear-gradient(135deg,#3b82f6,#6366f1)'
                              : 'linear-gradient(135deg,#ec4899,#db2777)' }}>
                            {r.person_photo
                              ? <img src={r.person_photo} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" />
                              : r.person_name?.[0]}
                          </div>
                        </td>
                        <td style={{ padding:'10px 12px' }}>
                          <span style={{ fontSize:13, fontWeight:700, color:txt1 }}>{r.person_name}</span>
                        </td>
                        <td style={{ padding:'10px 12px' }}>
                          <span style={{ padding:'4px 10px', borderRadius:20, fontSize:11, fontWeight:700,
                            background: (typeOpt?.color || '#6366f1') + '18',
                            color: typeOpt?.color || '#6366f1' }}>
                            {typeOpt?.icon} {r.type_display}
                          </span>
                        </td>
                        <td style={{ padding:'10px 12px' }}>
                          <div style={{ fontSize:12, fontWeight:700, color:txt1 }}>{fmtDate(r.date)}</div>
                          {r.days_until != null && (
                            <div style={{ marginTop:3, padding:'2px 7px', borderRadius:10, fontSize:10,
                              fontWeight:700, display:'inline-block',
                              background:dc.bg, color:dc.color }}>📅 {dc.text}</div>
                          )}
                        </td>
                        <td style={{ padding:'10px 12px' }}>
                          <span style={{ fontSize:11, color:txt2, maxWidth:140,
                            overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', display:'block' }}>
                            {r.note || '—'}
                          </span>
                        </td>
                        <td style={{ padding:'10px 12px' }}>
                          <span style={{ padding:'4px 10px', borderRadius:20, fontSize:11, fontWeight:700,
                            background: r.is_active ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.1)',
                            color: r.is_active ? '#10b981' : '#ef4444' }}>
                            {r.is_active ? '✅ Aktiv' : '❌ Nofaol'}
                          </span>
                        </td>
                        <td style={{ padding:'10px 12px' }}>
                          <div style={{ display:'flex', gap:6 }}>
                            <button onClick={() => { setEditing(r); setShowModal(true) }}
                              style={{ width:30, height:30, borderRadius:8, border:'none',
                                background:'rgba(245,158,11,0.1)', color:'#d97706',
                                cursor:'pointer', fontSize:13,
                                display:'flex', alignItems:'center', justifyContent:'center' }}>✏️</button>
                            <button onClick={() => handleDelete(r.id)}
                              style={{ width:30, height:30, borderRadius:8, border:'none',
                                background:'rgba(239,68,68,0.1)', color:'#ef4444',
                                cursor:'pointer', fontSize:13,
                                display:'flex', alignItems:'center', justifyContent:'center' }}>🗑️</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="rem-cards-wrap">
              {reminders.map((r, i) => (
                <ReminderCard key={r.id} r={r} i={i} isDark={isDark}
                  onEdit={r => { setEditing(r); setShowModal(true) }}
                  onDelete={handleDelete} />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <ReminderModal
          isDark={isDark}
          onClose={() => { setShowModal(false); setEditing(null) }}
          onSave={handleSave}
          persons={persons}
          initial={editing ? {
            person: editing.person, type: editing.type,
            date: editing.date, note: editing.note, is_active: editing.is_active,
          } : null}
        />
      )}
    </>
  )
}
