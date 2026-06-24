import { useEffect, useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { getPersons, deletePerson } from '../../api/persons'
import toast from 'react-hot-toast'
import { fmtDate } from '../../utils/date'
import AnimCount from '../../components/AnimCount'
import useThemeStore from '../../store/themeStore'

// ── Saralash ─────────────────────────────────────────────────
function sortPersons(list, key, dir) {
  const arr = [...list]
  const asc = dir === 'asc'
  arr.sort((a, b) => {
    let va, vb
    switch (key) {
      case 'name':
        va = a.full_name || ''; vb = b.full_name || ''
        return asc ? va.localeCompare(vb,'uz') : vb.localeCompare(va,'uz')
      case 'age':
        va = a.birth_date ? new Date(a.birth_date).getFullYear() : (asc?9999:0)
        vb = b.birth_date ? new Date(b.birth_date).getFullYear() : (asc?9999:0)
        return asc ? va-vb : vb-va
      case 'birth':
        va = a.birth_date||(asc?'z':''); vb = b.birth_date||(asc?'z':'')
        return asc ? va.localeCompare(vb) : vb.localeCompare(va)
      case 'death':
        va = a.death_date||(asc?'z':''); vb = b.death_date||(asc?'z':'')
        return asc ? va.localeCompare(vb) : vb.localeCompare(va)
      case 'child':
        va = a.child_number||(asc?999:0); vb = b.child_number||(asc?999:0)
        return asc ? va-vb : vb-va
      default: return 0
    }
  })
  return arr
}

function Th({ label, sortKey, current, dir, onSort, style }) {
  const active = current === sortKey
  return (
    <th style={{ cursor:'pointer', userSelect:'none', whiteSpace:'nowrap', ...style }}
      onClick={() => onSort(sortKey)}>
      <span style={{ display:'inline-flex', alignItems:'center', gap:4 }}>
        {label}
        <span style={{ fontSize:10, opacity:active?1:0.3, color:active?'#6366f1':'inherit' }}>
          {active ? (dir==='asc'?'▲':'▼') : '⇅'}
        </span>
      </span>
    </th>
  )
}

// ── Delete confirm modal ─────────────────────────────────────
function DeleteModal({ person, onClose, onConfirm }) {
  const [loading, setLoading] = useState(false)
  if (!person) return null
  const handleConfirm = async () => { setLoading(true); await onConfirm(); setLoading(false) }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background:'rgba(15,23,42,0.6)', backdropFilter:'blur(6px)' }}
      onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
        style={{ animation:'scaleIn .2s ease both' }}>
        <div className="p-6 text-center">
          <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center text-4xl mx-auto mb-4">🗑️</div>
          <h2 className="text-lg font-bold text-gray-800 mb-2">O'chirishni tasdiqlang</h2>
          <p className="text-sm text-gray-500 mb-1">
            Quyidagi shaxs ma'lumotlari bazadan <strong>butunlay o'chiriladi</strong>:
          </p>
          <div className="bg-red-50 rounded-xl px-4 py-3 my-4 text-left">
            <div className="font-bold text-red-700">{person.full_name}</div>
            {person.birth_date && (
              <div className="text-xs text-red-400 mt-0.5">
                {fmtDate(person.birth_date)}{person.age?` · ${person.age} yosh`:''}
              </div>
            )}
          </div>
          <p className="text-xs text-gray-400">Bu amalni qaytarib bo'lmaydi!</p>
        </div>
        <div className="flex gap-2 px-5 pb-5">
          <button onClick={onClose} className="btn btn-ghost flex-1 justify-center">Bekor qilish</button>
          <button onClick={handleConfirm} disabled={loading}
            className="btn flex-1 justify-center font-bold"
            style={{ background:'#ef4444', color:'white', boxShadow:'0 4px 12px rgba(239,68,68,0.3)' }}>
            {loading ? '⏳...' : "🗑️ Ha, o'chirish"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────
export default function AdminPersons() {
  const [persons, setPersons]           = useState([])
  const [search, setSearch]             = useState('')
  const [gender, setGender]             = useState('')
  const [loading, setLoading]           = useState(true)
  const [deletePerson_, setDeletePerson] = useState(null)
  const [sortKey, setSortKey]           = useState('name')
  const [sortDir, setSortDir]           = useState('asc')
  const navigate = useNavigate()
  const { isDark } = useThemeStore()

  const textPrimary   = isDark ? '#f1f5f9' : '#1e293b'
  const textMuted     = isDark ? '#64748b'  : '#94a3b8'
  const textSecondary = isDark ? '#94a3b8'  : '#64748b'
  const cardBg        = isDark ? '#1e293b'  : '#ffffff'
  const border        = isDark ? '#334155'  : '#f1f5f9'
  const inputBg       = isDark ? '#0f172a'  : '#ffffff'
  const filterBg      = isDark ? '#1e293b'  : '#ffffff'

  const handleSort = (key) => {
    if (sortKey===key) setSortDir(d => d==='asc'?'desc':'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getPersons({ search, gender })
      setPersons(res.data)
    } catch {
      toast.error("❌ Ma'lumotlarni yuklashda xato")
    } finally { setLoading(false) }
  }, [search, gender])

  useEffect(() => { load() }, [load])

  const sorted = useMemo(() => sortPersons(persons, sortKey, sortDir), [persons, sortKey, sortDir])

  const handleDeleteConfirm = async () => {
    if (!deletePerson_) return
    try {
      await deletePerson(deletePerson_.id)
      toast.success(`✅ "${deletePerson_.full_name}" o'chirildi`)
      setDeletePerson(null); load()
    } catch { toast.error("❌ O'chirishda xato") }
  }

  return (
    <div className="adp-wrap" style={{ padding:20, color:textPrimary }}>
      <style>{`
        /* Desktop: table ko'rinadi, card yashiriladi */
        .adp-table-wrap { display: block; }
        .adp-card-list  { display: none;  }
        @media (max-width: 640px) {
          .adp-wrap { padding: 12px 10px !important; }
          .adp-header { flex-wrap: wrap; gap: 10px; }
          .adp-header h1 { font-size: 17px; }
          .adp-filters { flex-direction: column; gap: 8px; }
          .adp-gender-btns button { padding: 6px 8px !important; font-size: 11px !important; }
          /* Jadval yashiriladi, card list ko'rsatiladi */
          .adp-table-wrap { display: none !important; }
          .adp-card-list  { display: block !important; }
        }
      `}</style>

      {/* ── Header ── */}
      <div className="adp-header" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
        <div>
          <h1 style={{ fontSize:20, fontWeight:900, margin:0 }}>👥 Barcha shaxslar</h1>
          <p style={{ fontSize:12, color:textMuted, margin:'3px 0 0' }}>
            <AnimCount to={persons.length} /> ta shaxs topildi
          </p>
        </div>
        <button onClick={() => navigate('/admin/persons/add')}
          style={{
            display:'flex', alignItems:'center', gap:6,
            padding:'9px 16px', borderRadius:12, border:'none', cursor:'pointer',
            background:'linear-gradient(135deg,#10b981,#059669)',
            color:'white', fontSize:13, fontWeight:800,
            boxShadow:'0 4px 14px rgba(16,185,129,0.4)',
            whiteSpace:'nowrap',
          }}>
          ➕ Yangi shaxs
        </button>
      </div>

      {/* ── Filters ── */}
      <div className="adp-filters" style={{ display:'flex', gap:10, marginBottom:14 }}>
        {/* Search */}
        <div style={{ position:'relative', flex:1 }}>
          <svg style={{ position:'absolute', left:11, top:'50%', transform:'translateY(-50%)', opacity:.5 }}
            width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <input type="text"
            placeholder="Ism, familiya yoki otasining ismi..."
            value={search} onChange={e => setSearch(e.target.value)}
            style={{
              width:'100%', padding:'9px 32px 9px 34px', borderRadius:11,
              border:`1.5px solid ${border}`, fontSize:13, outline:'none',
              background:inputBg, color:textPrimary, boxSizing:'border-box',
            }}/>
          {search && (
            <button onClick={() => setSearch('')}
              style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)',
                background:'none', border:'none', cursor:'pointer', color:textMuted, fontSize:13 }}>
              ✕
            </button>
          )}
        </div>
        {/* Gender filter */}
        <div className="adp-gender-btns" style={{
          display:'flex', alignItems:'center', gap:3,
          background:filterBg, borderRadius:12, padding:4,
          border:`1.5px solid ${border}`, flexShrink:0,
        }}>
          {[['','👥 Barcha'],['male','👨 Erkak'],['female','👩 Ayol']].map(([val,lbl])=>(
            <button key={val} onClick={()=>setGender(val)}
              style={{
                padding:'6px 11px', borderRadius:9, border:'none', cursor:'pointer',
                fontSize:12, fontWeight:700,
                background: gender===val ? 'linear-gradient(135deg,#3b82f6,#6366f1)' : 'transparent',
                color: gender===val ? 'white' : textSecondary,
                transition:'all 0.15s',
              }}>
              {lbl}
            </button>
          ))}
        </div>
      </div>

      {/* ── Table/Card wrapper ── */}
      <div style={{ background:cardBg, borderRadius:16, border:`1px solid ${border}`, overflow:'hidden' }}>
        {loading ? (
          <div style={{ textAlign:'center', padding:'48px 0', color:textMuted }}>
            <div style={{ fontSize:36, marginBottom:10, animation:'bounce 1s infinite' }}>🌳</div>
            <div style={{ fontSize:13 }}>Yuklanmoqda...</div>
          </div>
        ) : sorted.length===0 ? (
          <div style={{ textAlign:'center', padding:'48px 0', color:textMuted }}>
            <div style={{ fontSize:36, marginBottom:10 }}>🔍</div>
            <div style={{ fontSize:14, fontWeight:700 }}>Hech kim topilmadi</div>
            <div style={{ fontSize:12, marginTop:4 }}>Qidiruv shartlarini o'zgartiring</div>
          </div>
        ) : (
          <>
            {/* ── Desktop: jadval ── */}
            <div className="adp-table-wrap" style={{ overflowX:'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width:44 }}>№</th>
                    <Th label="Shaxs"        sortKey="name"  current={sortKey} dir={sortDir} onSort={handleSort}/>
                    <th>Jins</th>
                    <Th label="Yoshi"        sortKey="age"   current={sortKey} dir={sortDir} onSort={handleSort}/>
                    <Th label="Tug'ilgan"    sortKey="birth" current={sortKey} dir={sortDir} onSort={handleSort}/>
                    <Th label="Vafot sanasi" sortKey="death" current={sortKey} dir={sortDir} onSort={handleSort}/>
                    <Th label="Farzand #"    sortKey="child" current={sortKey} dir={sortDir} onSort={handleSort}/>
                    <th>Holati</th>
                    <th style={{ width:100 }}>Amallar</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((p,i) => (
                    <tr key={p.id}>
                      <td>
                        <span style={{ width:24,height:24,borderRadius:'50%',background:isDark?'#334155':'#f1f5f9',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:textSecondary }}>{i+1}</span>
                      </td>
                      <td>
                        <div style={{ display:'flex',alignItems:'center',gap:9 }}>
                          <div style={{ width:34,height:34,borderRadius:10,overflow:'hidden',flexShrink:0,background:p.gender==='male'?'linear-gradient(135deg,#3b82f6,#6366f1)':'linear-gradient(135deg,#ec4899,#db2777)',display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontSize:14 }}>
                            {(p.photo_url||p.photo)?<img src={p.photo_url||p.photo} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/>:(p.gender==='male'?'👨':'👩')}
                          </div>
                          <div>
                            <div style={{ fontWeight:700,fontSize:13,color:textPrimary,lineHeight:1.3 }}>{p.full_name}</div>
                            {p.phone&&<div style={{ fontSize:11,color:textMuted }}>{p.phone}</div>}
                          </div>
                        </div>
                      </td>
                      <td><span className={`badge ${p.gender==='male'?'badge-male':'badge-female'}`}>{p.gender==='male'?'👨 Erkak':'👩 Ayol'}</span></td>
                      <td style={{ fontSize:12,color:textSecondary }}>{p.age!=null?`${p.age} yosh`:'—'}</td>
                      <td style={{ fontSize:12,color:textSecondary }}>{p.birth_date?fmtDate(p.birth_date):'—'}</td>
                      <td style={{ fontSize:12,color:textSecondary }}>{p.death_date?fmtDate(p.death_date):'—'}</td>
                      <td style={{ fontSize:12,color:textSecondary,textAlign:'center' }}>{p.child_number?`${p.child_number}-farzand`:'—'}</td>
                      <td>{p.death_date?<span className="badge badge-dead">🌿 Vafot etgan</span>:<span className="badge badge-alive">💚 Tirik</span>}</td>
                      <td>
                        <div style={{ display:'flex',gap:4 }}>
                          <button onClick={()=>navigate(`/admin/persons/${p.id}`)} title="Ko'rish"
                            style={{ width:28,height:28,borderRadius:8,border:'none',background:'#eff6ff',color:'#2563eb',cursor:'pointer',fontSize:13 }}>👁</button>
                          <button onClick={()=>navigate(`/admin/persons/${p.id}/edit`)} title="Tahrirlash"
                            style={{ width:28,height:28,borderRadius:8,border:'none',background:'#fffbeb',color:'#d97706',cursor:'pointer',fontSize:13 }}>✏️</button>
                          <button onClick={()=>setDeletePerson(p)} title="O'chirish"
                            style={{ width:28,height:28,borderRadius:8,border:'none',background:'#fef2f2',color:'#dc2626',cursor:'pointer',fontSize:13 }}>🗑️</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ── Mobile: card list ── */}
            <div className="adp-card-list">
              {sorted.map((p,i) => (
                <div key={p.id} style={{
                  display:'flex', alignItems:'center', gap:10,
                  padding:'10px 12px',
                  borderBottom: i<sorted.length-1 ? `1px solid ${border}` : 'none',
                }}>
                  {/* Raqam */}
                  <span style={{ fontSize:11,fontWeight:700,color:textMuted,width:18,flexShrink:0,textAlign:'center' }}>{i+1}</span>

                  {/* Avatar */}
                  <div style={{
                    width:42,height:42,borderRadius:12,overflow:'hidden',flexShrink:0,
                    background:p.gender==='male'?'linear-gradient(135deg,#3b82f6,#6366f1)':'linear-gradient(135deg,#ec4899,#db2777)',
                    display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontSize:18,
                  }}>
                    {(p.photo_url||p.photo)?<img src={p.photo_url||p.photo} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/>:(p.gender==='male'?'👨':'👩')}
                  </div>

                  {/* Info */}
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ fontWeight:800,fontSize:13,color:textPrimary,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{p.full_name}</div>
                    <div style={{ display:'flex',alignItems:'center',gap:5,marginTop:3,flexWrap:'wrap' }}>
                      <span className={`badge ${p.gender==='male'?'badge-male':'badge-female'}`} style={{fontSize:10}}>
                        {p.gender==='male'?'👨 Erkak':'👩 Ayol'}
                      </span>
                      {p.death_date
                        ?<span className="badge badge-dead" style={{fontSize:10}}>🌿 Vafot</span>
                        :<span className="badge badge-alive" style={{fontSize:10}}>💚 Tirik</span>
                      }
                      {p.age!=null && (
                        <span style={{fontSize:10,color:textMuted,fontWeight:600}}>{p.age} yosh</span>
                      )}
                    </div>
                  </div>

                  {/* Amallar */}
                  <div style={{ display:'flex',gap:5,flexShrink:0 }}>
                    <button onClick={()=>navigate(`/admin/persons/${p.id}`)}
                      style={{width:32,height:32,borderRadius:10,border:'none',background:'#eff6ff',color:'#2563eb',cursor:'pointer',fontSize:15}}>👁</button>
                    <button onClick={()=>navigate(`/admin/persons/${p.id}/edit`)}
                      style={{width:32,height:32,borderRadius:10,border:'none',background:'#fffbeb',color:'#d97706',cursor:'pointer',fontSize:15}}>✏️</button>
                    <button onClick={()=>setDeletePerson(p)}
                      style={{width:32,height:32,borderRadius:10,border:'none',background:'#fef2f2',color:'#dc2626',cursor:'pointer',fontSize:15}}>🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {deletePerson_ && (
        <DeleteModal
          person={deletePerson_}
          onClose={() => setDeletePerson(null)}
          onConfirm={handleDeleteConfirm}
        />
      )}
    </div>
  )
}
