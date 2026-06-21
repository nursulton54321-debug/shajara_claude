import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getPublicTree } from '../api/persons'

// ── Mini person card for public view ─────────────────────────────
function PersonCard({ p }) {
  const male   = p.gender === 'male'
  const dead   = !!p.death_date
  const accent = dead ? '#6b7280' : male ? '#6366f1' : '#ec4899'

  const fmtYear = (d) => d ? new Date(d + 'T00:00:00').getFullYear() : null
  const birth = fmtYear(p.birth_date)
  const death = fmtYear(p.death_date)

  return (
    <div style={{
      display:'flex', alignItems:'center', gap:10, padding:'10px 12px',
      borderRadius:14, background:'white',
      border:`1.5px solid ${dead ? '#e2e8f0' : accent + '30'}`,
      boxShadow: dead ? 'none' : `0 2px 10px ${accent}12`,
      opacity: dead ? 0.72 : 1,
    }}>
      {/* Avatar */}
      <div style={{
        width:44, height:44, borderRadius:13, flexShrink:0, overflow:'hidden',
        border:`2px solid ${accent}`, background: male ? '#eef2ff' : '#fff0f8',
        display:'flex', alignItems:'center', justifyContent:'center', fontSize:22,
      }}>
        {p.photo_url
          ? <img src={p.photo_url} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" />
          : <span>{male ? '👨' : '👩'}</span>}
      </div>

      {/* Info */}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13.5, fontWeight:800, color:'#0f172a', lineHeight:1.2,
          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {p.full_name}
        </div>
        <div style={{ fontSize:11, color:'#64748b', marginTop:2 }}>
          {birth && <span>🎂 {birth}</span>}
          {death && <span> — 🌿 {death}</span>}
          {p.birth_place && <span> · 📍 {p.birth_place}</span>}
        </div>
      </div>

      {dead && (
        <div style={{ width:22, height:22, borderRadius:'50%', background:'#6b7280',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:9, color:'white', fontWeight:900, flexShrink:0 }}>🌿</div>
      )}
    </div>
  )
}

// ── computeGenerations (same BFS as TreePage) ─────────────────────
function computeGenerations(persons) {
  const pm  = Object.fromEntries(persons.map(p => [p.id, p]))
  const gen = Object.fromEntries(persons.map(p => [p.id, 0]))
  let changed = true
  while (changed) {
    changed = false
    persons.forEach(p => {
      const parents = [p.father_id && pm[p.father_id], p.mother_id && pm[p.mother_id]].filter(Boolean)
      parents.forEach(par => {
        if (gen[p.id] <= gen[par.id]) { gen[p.id] = gen[par.id] + 1; changed = true }
      })
    })
  }
  // second pass: married-in spouses
  changed = true
  while (changed) {
    changed = false
    persons.forEach(p => {
      if (p.father_id || p.mother_id) return
      ;(p.families || []).forEach(f => {
        const sg = gen[f.partner_id]
        if (f.partner_id && sg !== undefined && gen[p.id] < sg) { gen[p.id] = sg; changed = true }
      })
    })
  }
  return gen
}

// ── Main component ────────────────────────────────────────────────
export default function PublicTreePage() {
  const { token }              = useParams()
  const navigate               = useNavigate()
  const [persons, setPersons]  = useState([])
  const [owner, setOwner]      = useState('')
  const [loading, setLoading]  = useState(true)
  const [error, setError]      = useState(null)
  const [search, setSearch]    = useState('')

  useEffect(() => {
    getPublicTree(token)
      .then(r => {
        setPersons(r.data.persons || [])
        setOwner(r.data.owner || '')
        setLoading(false)
      })
      .catch(err => {
        const status = err?.response?.status
        if (status === 410) setError('expired')
        else if (status === 404) setError('notfound')
        else setError('error')
        setLoading(false)
      })
  }, [token])

  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
      background:'linear-gradient(135deg,#eef2ff,#fdf4ff)' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:64, marginBottom:16 }}>🌳</div>
        <div style={{ color:'#6366f1', fontWeight:700, fontSize:16 }}>Shajara yuklanmoqda...</div>
      </div>
    </div>
  )

  if (error) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
      background:'linear-gradient(135deg,#fff1f2,#fdf4ff)', padding:20 }}>
      <div style={{ textAlign:'center', maxWidth:360 }}>
        <div style={{ fontSize:56, marginBottom:12 }}>{error === 'expired' ? '⏰' : '🔒'}</div>
        <div style={{ fontSize:20, fontWeight:800, color:'#0f172a', marginBottom:8 }}>
          {error === 'expired' ? 'Havola muddati tugagan' : 'Havola topilmadi'}
        </div>
        <div style={{ fontSize:14, color:'#64748b', marginBottom:20 }}>
          {error === 'expired'
            ? 'Bu ulashish havolasi 7 kun davomida amal qiladi. Havola yaratuvchisidan yangi havola so\'rang.'
            : 'Bu havola mavjud emas yoki o\'chirilgan bo\'lishi mumkin.'}
        </div>
        <button onClick={() => navigate('/login')}
          style={{ padding:'10px 24px', borderRadius:12, border:'none', cursor:'pointer',
            background:'linear-gradient(135deg,#6366f1,#7c3aed)', color:'white',
            fontSize:14, fontWeight:700, boxShadow:'0 4px 14px rgba(99,102,241,0.35)' }}>
          Kirish →
        </button>
      </div>
    </div>
  )

  const genMap  = persons.length ? computeGenerations(persons) : {}
  const activeQ = search.trim().toLowerCase()

  const filtered = persons.filter(p => {
    if (!activeQ) return true
    return (p.full_name?.toLowerCase().includes(activeQ) || p.birth_place?.toLowerCase().includes(activeQ))
  })

  const byGen = {}
  filtered.forEach(p => {
    const g = (genMap[p.id] ?? 0) + 1
    if (!byGen[g]) byGen[g] = []
    byGen[g].push(p)
  })
  const gens = Object.keys(byGen).map(Number).sort((a, b) => a - b)

  const total  = persons.length
  const alive  = persons.filter(p => !p.death_date).length
  const males  = persons.filter(p => p.gender === 'male').length
  const females= persons.filter(p => p.gender === 'female').length

  return (
    <div style={{ minHeight:'100vh', background:'#f8fafc', fontFamily:'system-ui,-apple-system,sans-serif' }}>
      {/* Header */}
      <div style={{ background:'linear-gradient(135deg,#4f46e5,#7c3aed,#a855f7)', padding:'20px 20px 16px' }}>
        <div style={{ maxWidth:640, margin:'0 auto' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
            <span style={{ fontSize:28 }}>🌳</span>
            <div>
              <div style={{ fontSize:20, fontWeight:900, color:'white' }}>Shajara daraxti</div>
              <div style={{ fontSize:11, color:'rgba(255,255,255,0.72)', marginTop:1 }}>
                {owner ? `${owner} oilasi · ` : ''}Faqat ko'rish uchun · Login talab qilinmaydi
              </div>
            </div>
          </div>

          {/* Stats */}
          <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
            {[
              { icon:'👥', label:"Jami a'zolar", value: total },
              { icon:'💚', label:'Tiriklar',      value: alive },
              { icon:'👨', label:'Erkaklar',      value: males },
              { icon:'👩', label:'Ayollar',        value: females },
            ].map(s => (
              <div key={s.label} style={{ background:'rgba(255,255,255,0.15)', borderRadius:10,
                padding:'6px 14px', color:'white', backdropFilter:'blur(4px)' }}>
                <span style={{ fontSize:13 }}>{s.icon} </span>
                <span style={{ fontWeight:800, fontSize:15 }}>{s.value}</span>
                <span style={{ fontSize:10, opacity:0.8, marginLeft:4 }}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth:640, margin:'0 auto', padding:'16px 14px' }}>
        {/* Search */}
        <div style={{ position:'relative', marginBottom:14 }}>
          <svg style={{ position:'absolute', top:'50%', transform:'translateY(-50%)', left:10,
            width:15, height:15, color:'#94a3b8', pointerEvents:'none' }}
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Ism yoki tug'ilgan joy bo'yicha qidiring..."
            style={{ width:'100%', padding:'10px 12px 10px 32px', borderRadius:12, fontSize:13,
              border:`1.5px solid ${search ? '#6366f1' : '#e2e8f0'}`,
              background:'white', color:'#0f172a', outline:'none',
              boxSizing:'border-box', transition:'border-color .15s' }}/>
          {search && (
            <button onClick={() => setSearch('')}
              style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)',
                background:'none', border:'none', cursor:'pointer', color:'#94a3b8', fontSize:14 }}>✕</button>
          )}
        </div>

        {activeQ && (
          <div style={{ fontSize:11.5, color:'#64748b', fontWeight:600, marginBottom:10 }}>
            🔍 "{activeQ}" bo'yicha {filtered.length} ta natija
          </div>
        )}

        {/* Generations */}
        {gens.length === 0 ? (
          <div style={{ textAlign:'center', padding:'40px 0', color:'#94a3b8' }}>
            <div style={{ fontSize:40, marginBottom:8 }}>🔍</div>
            <div style={{ fontSize:14, fontWeight:600 }}>Natija topilmadi</div>
          </div>
        ) : gens.map(gen => (
          <div key={gen} style={{ marginBottom:16 }}>
            {/* Gen header */}
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
              <div style={{ height:1, flex:1, background:'#e2e8f0' }}/>
              <div style={{ padding:'3px 12px', borderRadius:20, fontSize:11, fontWeight:800,
                background:'linear-gradient(135deg,#6366f1,#7c3aed)', color:'white',
                boxShadow:'0 2px 8px rgba(99,102,241,.3)', flexShrink:0 }}>
                {gen}-avlod · {byGen[gen].length} kishi
              </div>
              <div style={{ height:1, flex:1, background:'#e2e8f0' }}/>
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
              {byGen[gen].sort((a,b) => (a.child_number||99)-(b.child_number||99)).map(p => (
                <PersonCard key={p.id} p={p} />
              ))}
            </div>
          </div>
        ))}

        {/* Footer */}
        <div style={{ marginTop:24, padding:'14px 16px', borderRadius:14,
          background:'linear-gradient(135deg,#eef2ff,#fdf4ff)',
          border:'1.5px solid #c7d2fe', textAlign:'center' }}>
          <div style={{ fontSize:12, color:'#6366f1', fontWeight:700, marginBottom:6 }}>
            🌳 Shajara — Oila tarixi platformasi
          </div>
          <div style={{ fontSize:11, color:'#94a3b8', marginBottom:10 }}>
            O'z oilangiz shajara daraxtini yarating
          </div>
          <button onClick={() => navigate('/register')}
            style={{ padding:'8px 20px', borderRadius:10, border:'none', cursor:'pointer',
              background:'linear-gradient(135deg,#6366f1,#7c3aed)', color:'white',
              fontSize:12, fontWeight:700, boxShadow:'0 3px 10px rgba(99,102,241,0.3)' }}>
            Ro'yxatdan o'tish →
          </button>
        </div>
      </div>
    </div>
  )
}
