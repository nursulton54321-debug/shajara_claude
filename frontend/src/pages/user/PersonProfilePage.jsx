import { useEffect, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { getPerson } from '../../api/persons'
import toast from 'react-hot-toast'
import useThemeStore from '../../store/themeStore'
import { fmtDate } from '../../utils/date'

// ── Helpers ────────────────────────────────────────────────────
const calcAge = (birth, death) => {
  if (!birth) return null
  const e = death ? new Date(death + 'T00:00:00') : new Date()
  return Math.floor((e - new Date(birth + 'T00:00:00')) / (365.25 * 86400000))
}

// ── Mini person card (oila a'zolari uchun) ─────────────────────
function FamilyCard({ id, name, gender, birthDate, deathDate, photo, role, basePath, onClick }) {
  if (!id && !name) return null
  const male = gender === 'male'
  const dead = !!deathDate
  const accent = dead ? '#6b7280' : male ? '#6366f1' : '#ec4899'
  const age = calcAge(birthDate, deathDate)
  const { isDark } = useThemeStore()

  return (
    <div
      onClick={() => id && onClick(id)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 14px', borderRadius: 14, cursor: id ? 'pointer' : 'default',
        background: dead
          ? (isDark ? '#1e293b' : '#f9fafb')
          : male
            ? (isDark ? 'linear-gradient(135deg,#1e1b4b,#1e293b)' : 'linear-gradient(135deg,#eef2ff,#f5f3ff)')
            : (isDark ? 'linear-gradient(135deg,#2d1b2e,#1e293b)' : 'linear-gradient(135deg,#fff0f8,#fdf4ff)'),
        border: `1.5px solid ${dead ? (isDark ? '#334155' : '#e5e7eb') : male ? '#c7d2fe' : '#f9a8d4'}`,
        transition: 'all 0.18s',
      }}
      onMouseEnter={e => { if (id) e.currentTarget.style.transform = 'translateX(3px)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = '' }}
    >
      {/* Avatar */}
      <div style={{
        width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
        overflow: 'hidden', border: `2px solid ${accent}`,
        background: dead ? (isDark ? '#374151' : '#f3f4f6') : male ? '#e0e7ff' : '#fce7f3',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
      }}>
        {photo
          ? <img src={photo} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
          : <span>{male ? '👨' : '👩'}</span>}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {role && (
          <div style={{ fontSize: 10, fontWeight: 700, color: accent, textTransform: 'uppercase',
            letterSpacing: '0.06em', marginBottom: 1 }}>{role}</div>
        )}
        <div style={{ fontSize: 13, fontWeight: 700, color: isDark ? '#f1f5f9' : '#0f172a', lineHeight: 1.2 }}>{name || '—'}</div>
        {(birthDate || deathDate) && (
          <div style={{ fontSize: 11, color: isDark ? '#64748b' : '#94a3b8', marginTop: 1 }}>
            {birthDate ? new Date(birthDate + 'T00:00:00').getFullYear() : '?'}
            {deathDate ? ` – ${new Date(deathDate + 'T00:00:00').getFullYear()}` : ''}
            {age != null && !deathDate ? ` · ${age} yosh` : ''}
            {dead && age != null ? ` · ${age} yosh` : ''}
          </div>
        )}
      </div>

      {id && (
        <svg width="16" height="16" fill="none" stroke={accent} viewBox="0 0 24 24" style={{ opacity: 0.6, flexShrink: 0 }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      )}
    </div>
  )
}

// ── Timeline dot ───────────────────────────────────────────────
function TimelineItem({ icon, label, date, color, sub, ageAtEvent }) {
  const year = date ? new Date(date + 'T00:00:00').getFullYear() : null
  const { isDark } = useThemeStore()
  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: sub ? 10 : 14, position: 'relative', alignItems: 'flex-start' }}>
      {/* Dot */}
      <div style={{
        width: sub ? 26 : 32, height: sub ? 26 : 32, borderRadius: '50%', flexShrink: 0,
        background: sub ? (isDark ? '#1e293b' : '#f8fafc') : color,
        border: `2.5px solid ${sub ? (isDark ? '#334155' : '#e2e8f0') : color}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: sub ? 12 : 15, zIndex: 1, marginTop: sub ? 2 : 0,
        boxShadow: sub ? 'none' : `0 3px 10px ${color}50`,
        color: sub ? undefined : 'white',
      }}>{icon}</div>
      <div style={{
        flex: 1,
        background: sub ? 'transparent' : (isDark ? '#1e293b' : 'white'),
        borderRadius: sub ? 0 : 12,
        padding: sub ? '3px 0' : '9px 13px',
        border: sub ? 'none' : `1px solid ${color}25`,
        boxShadow: sub ? 'none' : `0 2px 8px ${color}12`,
      }}>
        {/* Yil badge — faqat asosiy eventlarda */}
        {year && !sub && (
          <div style={{ display:'inline-flex', alignItems:'center', gap:4, marginBottom:3,
            padding:'1px 8px', borderRadius:8, background:`${color}15`, color, fontSize:10, fontWeight:800 }}>
            📅 {year} {date && `· ${fmtDate(date)}`}
          </div>
        )}
        <div style={{ fontSize: sub ? 12 : 13, fontWeight: sub ? 500 : 700,
          color: sub ? (isDark ? '#94a3b8' : '#64748b') : (isDark ? '#f1f5f9' : '#0f172a'),
          lineHeight:1.35 }}>
          {label}
        </div>
        {/* Sub event: sana + yoshini ko'rsat */}
        {sub && date && (
          <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:2, flexWrap:'wrap' }}>
            <span style={{ fontSize: 11, color: isDark ? '#64748b' : '#94a3b8' }}>{fmtDate(date)}</span>
            {ageAtEvent != null && ageAtEvent >= 0 && (
              <span style={{
                fontSize: 10, fontWeight: 800, color,
                background: `${color}15`, padding: '1px 7px', borderRadius: 8,
              }}>
                {ageAtEvent} yoshida
              </span>
            )}
            {ageAtEvent == null && year && (
              <span style={{ fontSize: 10, fontWeight: 700, color: isDark ? '#64748b' : '#94a3b8' }}>{year}</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Section header ─────────────────────────────────────────────
function SectionTitle({ icon, title, count }) {
  const { isDark } = useThemeStore()
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      <span style={{ fontSize: 13, fontWeight: 800, color: isDark ? '#94a3b8' : '#374151', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {title}
      </span>
      {count != null && (
        <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700,
          background: isDark ? '#334155' : '#f1f5f9',
          color: isDark ? '#94a3b8' : '#64748b',
          padding: '2px 8px', borderRadius: 20 }}>
          {count} ta
        </span>
      )}
    </div>
  )
}

// ── MiniPersonBox ──────────────────────────────────────────────
function MiniPersonBox({ id, name, gender, photo, role, isCenter, onClick }) {
  if (!name && !id) return <div style={{ width: 76 }} />
  const male   = gender === 'male'
  const accent = male ? '#6366f1' : '#ec4899'
  const { isDark } = useThemeStore()
  return (
    <div
      onClick={() => id && onClick(id)}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
        cursor: id ? 'pointer' : 'default', transition: 'transform 0.15s',
        width: 76,
      }}
      onMouseEnter={e => { if (id) e.currentTarget.style.transform = 'translateY(-2px)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = '' }}
    >
      <div style={{
        width: isCenter ? 52 : 40, height: isCenter ? 52 : 40,
        borderRadius: isCenter ? 14 : 11, overflow: 'hidden',
        border: `${isCenter ? 3 : 2}px solid ${isCenter ? '#f59e0b' : accent}`,
        background: male ? '#e0e7ff' : '#fce7f3',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: isCenter ? 22 : 18,
        boxShadow: isCenter
          ? '0 0 0 3px rgba(245,158,11,0.3), 0 4px 14px rgba(245,158,11,0.25)'
          : `0 2px 8px ${accent}25`,
      }}>
        {photo
          ? <img src={photo} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" />
          : <span>{male ? '👨' : '👩'}</span>}
      </div>
      <div style={{ textAlign:'center' }}>
        {role && (
          <div style={{ fontSize: 8, fontWeight: 800, color: isCenter ? '#f59e0b' : accent,
            textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1.2 }}>{role}</div>
        )}
        <div style={{
          fontSize: isCenter ? 10.5 : 9.5, fontWeight: 700,
          color: isDark ? '#f1f5f9' : '#0f172a',
          maxWidth: 74, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          lineHeight: 1.3,
        }}>{name || '?'}</div>
      </div>
    </div>
  )
}

// ── Vertical connector line ────────────────────────────────────
function TreeLine({ color = '#c7d2fe' }) {
  return (
    <div style={{
      width: 2, height: 16, background: color,
      margin: '0 auto', borderRadius: 2, flexShrink: 0,
    }} />
  )
}

// ── MiniTree ───────────────────────────────────────────────────
function MiniTree({ person, isDark, goToProfile }) {
  const [fData, setFData] = useState(null)
  const [mData, setMData] = useState(null)

  useEffect(() => {
    if (person.father) getPerson(person.father).then(r => setFData(r.data)).catch(() => {})
    if (person.mother) getPerson(person.mother).then(r => setMData(r.data)).catch(() => {})
  }, [person.father, person.mother])

  // Turmush o'rtog'ini families dan olish
  const spouse = person.families?.find(f => !f.is_divorced) || person.families?.[0] || null

  const hasParents   = person.father_name || person.mother_name
  const hasChildren  = person.children?.length > 0
  const hasSpouse    = !!spouse?.partner_name
  const hasGrandPats = fData && (fData.father_name || fData.mother_name)
  const hasGrandMats = mData && (mData.father_name || mData.mother_name)
  const hasGrands    = hasGrandPats || hasGrandMats

  if (!hasParents && !hasChildren && !hasSpouse) return null

  const accent = person.gender === 'male' ? '#6366f1' : '#ec4899'

  return (
    <div style={{
      background: isDark ? '#1e293b' : 'white', borderRadius: 18, padding: '16px 12px',
      boxShadow: '0 2px 16px rgba(0,0,0,0.07)',
      border: isDark ? '1px solid #334155' : '1px solid #f1f5f9',
    }}>
      <SectionTitle icon="🌳" title="Mini shajara" />

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>

        {/* Row 0: Grandparents */}
        {hasGrands && (
          <>
            <div style={{ display:'flex', alignItems:'flex-start', gap:6, justifyContent:'center' }}>
              {/* Paternal grandparents */}
              <div style={{ display:'flex', gap:6 }}>
                {fData?.father_name
                  ? <MiniPersonBox id={fData.father} name={fData.father_name} gender="male"   photo={fData.father_photo} role="Otabobo" onClick={goToProfile} />
                  : (hasGrandPats ? <div style={{ width:76 }} /> : null)}
                {fData?.mother_name
                  ? <MiniPersonBox id={fData.mother} name={fData.mother_name} gender="female" photo={fData.mother_photo} role="Otabuvi" onClick={goToProfile} />
                  : (hasGrandPats ? <div style={{ width:76 }} /> : null)}
              </div>
              {/* Separator */}
              {hasGrandPats && hasGrandMats && <div style={{ width: 12 }} />}
              {/* Maternal grandparents */}
              <div style={{ display:'flex', gap:6 }}>
                {mData?.father_name
                  ? <MiniPersonBox id={mData.father} name={mData.father_name} gender="male"   photo={mData.father_photo} role="Onabobo" onClick={goToProfile} />
                  : (hasGrandMats ? <div style={{ width:76 }} /> : null)}
                {mData?.mother_name
                  ? <MiniPersonBox id={mData.mother} name={mData.mother_name} gender="female" photo={mData.mother_photo} role="Onabuvi" onClick={goToProfile} />
                  : (hasGrandMats ? <div style={{ width:76 }} /> : null)}
              </div>
            </div>
            <TreeLine color="#c7d2fe" />
          </>
        )}

        {/* Row 1: Parents */}
        {hasParents && (
          <>
            <div style={{ display:'flex', gap:16, justifyContent:'center' }}>
              {person.father_name
                ? <MiniPersonBox id={person.father} name={person.father_name} gender="male"   photo={person.father_photo} role="Otasi" onClick={goToProfile} />
                : <div style={{ width:76 }} />}
              {person.mother_name
                ? <MiniPersonBox id={person.mother} name={person.mother_name} gender="female" photo={person.mother_photo} role="Onasi" onClick={goToProfile} />
                : null}
            </div>
            <TreeLine color={accent} />
          </>
        )}

        {/* Row 2: Person + Spouse */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
          <MiniPersonBox
            id={person.id}
            name={person.full_name}
            gender={person.gender}
            photo={person.photo_url}
            role="★ O'zi"
            isCenter={true}
            onClick={() => {}}
          />
          {hasSpouse && (
            <>
              {/* Nikoh belgisi */}
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                padding: '4px 6px',
              }}>
                <div style={{ fontSize: 14 }}>💍</div>
                {spouse.is_divorced && (
                  <div style={{ fontSize: 8, color: '#94a3b8', fontWeight: 700 }}>Ajralgan</div>
                )}
              </div>
              <MiniPersonBox
                id={spouse.partner_id}
                name={spouse.partner_name}
                gender={spouse.partner_gender}
                photo={spouse.partner_photo}
                role="Juft"
                onClick={goToProfile}
              />
            </>
          )}
        </div>

        {/* Row 3: Children */}
        {hasChildren && (
          <>
            <TreeLine color={accent} />
            <div style={{ display:'flex', gap:6, flexWrap:'wrap', justifyContent:'center', maxWidth:320 }}>
              {person.children.slice(0, 6).map(c => (
                <MiniPersonBox
                  key={c.id}
                  id={c.id}
                  name={c.full_name}
                  gender={c.gender}
                  photo={c.photo_url}
                  role={c.child_number ? `${c.child_number}-farzand` : 'Farzand'}
                  onClick={goToProfile}
                />
              ))}
              {person.children.length > 6 && (
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, width:76 }}>
                  <div style={{
                    width:40, height:40, borderRadius:11, background:'linear-gradient(135deg,#6366f1,#7c3aed)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    color:'white', fontSize:12, fontWeight:900,
                  }}>+{person.children.length - 6}</div>
                  <div style={{ fontSize:9.5, color:'#94a3b8', fontWeight:600 }}>boshqalar</div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────
export default function PersonProfilePage({ isAdmin }) {
  const { id }   = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [person, setPerson]     = useState(null)
  const [loading, setLoading]   = useState(true)
  const [photoOpen, setPhotoOpen] = useState(false)

  // base path — /admin/persons yoki /persons
  const basePath = isAdmin ? '/admin/persons' : '/persons'
  const { isDark } = useThemeStore()

  useEffect(() => {
    setLoading(true)
    getPerson(id)
      .then(r => { setPerson(r.data); setLoading(false) })
      .catch(() => { toast.error('Shaxs topilmadi'); navigate(basePath) })
  }, [id])

  const goToProfile = (pid) => navigate(`${basePath}/${pid}`)

  const handleShare = () => {
    const url = window.location.origin + location.pathname
    navigator.clipboard?.writeText(url)
      .then(() => toast.success('🔗 Havola nusxalandi!'))
      .catch(() => toast.error('Nusxalashda xato'))
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh',
      background: isDark ? '#0f172a' : 'linear-gradient(135deg,#eef2ff,#fdf4ff)' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 56, marginBottom: 16, animation: 'bounce 1s infinite' }}>🌳</div>
        <div style={{ color: '#6366f1', fontWeight: 700 }}>Yuklanmoqda...</div>
      </div>
    </div>
  )

  if (!person) return null

  const male    = person.gender === 'male'
  const dead    = !!person.death_date
  const accent  = dead ? '#6b7280' : male ? '#6366f1' : '#ec4899'
  const ageNow  = calcAge(person.birth_date, null)
  const ageDied = dead ? calcAge(person.birth_date, person.death_date) : null

  // Hero gradient
  const heroGrad = dead
    ? 'linear-gradient(135deg,#374151 0%,#1f2937 100%)'
    : male
      ? 'linear-gradient(135deg,#4f46e5 0%,#7c3aed 50%,#6366f1 100%)'
      : 'linear-gradient(135deg,#db2777 0%,#be185d 50%,#ec4899 100%)'

  // ── Hayot tarixi: barcha voqealar xronologik tartibda ──
  const raw = []
  const toMs = (d) => d ? new Date(d + 'T00:00:00').getTime() : null

  if (person.birth_date)
    raw.push({ icon:'🐣', label:"Dunyoga keldi", date:person.birth_date, color:'#10b981', order:0 })
  if (person.father_name || person.mother_name) {
    const p = [person.father_name, person.mother_name].filter(Boolean).join(' va ')
    raw.push({ icon:'👨‍👩‍👦', label:`Ota-onasi: ${p}`, date:person.birth_date, color:'#6366f1', sub:true, order:1 })
  }
  // Reminder voqealari (birthday/death takrorlanmasin)
  ;(person.reminders || []).forEach(r => {
    if (r.type === 'birthday' || r.type === 'death') return
    raw.push({
      icon: r.icon, label: r.note ? `${r.type_display}: ${r.note}` : r.type_display,
      date: r.date, color: r.color || '#a855f7', order: 2, sub: false,
    })
  })
  // Farzandlar — ota/onaning o'sha paytdagi yoshini hisoblaymiz
  ;(person.children || []).forEach(c => {
    const ageAtEvent = (person.birth_date && c.birth_date)
      ? calcAge(person.birth_date, c.birth_date)
      : null
    raw.push({
      icon: c.gender==='male'?'👦':'👧',
      label: `Farzand: ${c.full_name}`,
      date: c.birth_date, color:'#f59e0b', sub:true, order:3,
      ageAtEvent,
    })
  })
  // Ko'p oila: Family modeli orqali
  ;(person.families || []).forEach((fam, fi) => {
    const weddingR = (person.reminders||[]).find(r => r.type==='wedding')
    const label = `${fi===0 ? "Nikoh" : `${fi+1}-nikoh`}: ${fam.partner_name}`
    const ageAtEvent = (person.birth_date && fam.wedding_date) ? calcAge(person.birth_date, fam.wedding_date) : null
    if (fam.wedding_date) {
      if (fi > 0 || !weddingR)
        raw.push({ icon:'💍', label, date: fam.wedding_date, color:'#f43f5e', order:4, ageAtEvent })
    } else if (!weddingR || fi > 0) {
      raw.push({ icon:'💍', label, date: null, color:'#f43f5e', order:4 })
    }
    if (fam.divorce_date) {
      const ageDiv = (person.birth_date && fam.divorce_date) ? calcAge(person.birth_date, fam.divorce_date) : null
      raw.push({ icon:'💔', label:`Ajralish (${fam.partner_name})`, date: fam.divorce_date, color:'#94a3b8', order:4, ageAtEvent: ageDiv })
    }
  })

  if (person.death_date)
    raw.push({ icon:'🌿', label:"Vafot etdi", date:person.death_date, color:'#6b7280', order:99 })

  raw.sort((a, b) => {
    const da = toMs(a.date), db = toMs(b.date)
    if (da && db) return da !== db ? da - db : a.order - b.order
    if (da && !db) return -1
    if (!da && db) return 1
    return a.order - b.order
  })
  const timeline = raw

  return (
    <>
    {/* ── Photo lightbox ── */}
    {photoOpen && person.photo_url && createPortal(
      <div
        onClick={() => setPhotoOpen(false)}
        style={{
          position: 'fixed', inset: 0, zIndex: 999999,
          background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 20, animation: 'confirmFadeIn 0.2s ease',
        }}>
        <div onClick={e => e.stopPropagation()} style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
          <img
            src={person.photo_url}
            alt={person.full_name}
            style={{
              maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain',
              borderRadius: 20, boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
              border: `3px solid ${accent}`,
            }}
          />
          <div style={{
            position: 'absolute', bottom: -48, left: 0, right: 0,
            textAlign: 'center', color: 'white', fontSize: 14, fontWeight: 700,
          }}>
            {person.full_name}
          </div>
          <button
            onClick={() => setPhotoOpen(false)}
            style={{
              position: 'absolute', top: -14, right: -14,
              width: 36, height: 36, borderRadius: '50%', border: 'none',
              background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)',
              color: 'white', fontSize: 18, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>✕</button>
        </div>
      </div>,
      document.body
    )}

    <div style={{ minHeight: '100vh', background: isDark ? '#0f172a' : '#f8fafc' }}>

      {/* ── Top bar ── */}
      <div style={{ position: 'sticky', top: 0, zIndex: 100,
        background: isDark ? 'rgba(15,23,42,0.92)' : 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(12px)',
        borderBottom: isDark ? '1px solid #334155' : '1px solid #e2e8f0',
        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px',
        boxShadow: '0 1px 12px rgba(0,0,0,0.06)' }}>
        {/* Back */}
        <button onClick={() => navigate(-1)} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
          borderRadius: 10, background: isDark ? '#1e293b' : '#f1f5f9',
          border: 'none', cursor: 'pointer',
          fontSize: 13, fontWeight: 600, color: isDark ? '#94a3b8' : '#64748b',
        }}>
          ← Orqaga
        </button>

        <div style={{ width: 1, height: 20, background: isDark ? '#334155' : '#e2e8f0' }} />

        {/* Breadcrumb */}
        <div style={{ fontSize: 12, color: isDark ? '#64748b' : '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ cursor: 'pointer', color: '#6366f1' }}
            onClick={() => navigate(basePath)}>Shaxslar</span>
          <span>›</span>
          <span style={{ color: isDark ? '#f1f5f9' : '#374151', fontWeight: 600 }}>{person.full_name}</span>
        </div>

        {/* Right actions */}
        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', alignItems: 'center' }}>
          {/* Tree */}
          <button onClick={() => navigate('/tree')} style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px',
            borderRadius: 10, background: '#f0f9ff', border: '1.5px solid #bae6fd',
            cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#0284c7',
          }}>
            🌳 Daraxtda
          </button>
          {/* Share */}
          <button onClick={handleShare} style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px',
            borderRadius: 10, background: '#f0fdf4', border: '1.5px solid #bbf7d0',
            cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#15803d',
          }}>
            🔗 Ulashish
          </button>
          {/* Edit */}
          <button onClick={() => navigate(`${basePath}/${id}/edit`)} style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '6px 16px',
            borderRadius: 10, border: 'none', cursor: 'pointer',
            fontSize: 12, fontWeight: 700, color: 'white',
            background: `linear-gradient(135deg,${accent},${dead ? '#4b5563' : male ? '#7c3aed' : '#be185d'})`,
            boxShadow: `0 3px 10px ${dead ? 'rgba(107,114,128,0.3)' : male ? 'rgba(99,102,241,0.3)' : 'rgba(236,72,153,0.3)'}`,
          }}>
            ✏️ Tahrirlash
          </button>
        </div>
      </div>

      {/* ── Hero ── */}
      <div style={{ background: heroGrad, padding: '36px 32px 56px', position: 'relative', overflow: 'hidden' }}>

        {/* Blurred background photo — only when photo exists */}
        {person.photo_url && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
            {/* Blurred photo fill */}
            <img
              src={person.photo_url}
              alt=""
              style={{
                position: 'absolute', inset: 0,
                width: '100%', height: '100%', objectFit: 'cover',
                objectPosition: 'center 20%',
                filter: 'blur(32px) saturate(1.6) brightness(0.42)',
                transform: 'scale(1.15)',
              }}
            />
            {/* Gradient overlay: hero color on top to preserve branding */}
            <div style={{
              position: 'absolute', inset: 0,
              background: heroGrad,
              opacity: 0.68,
            }} />
            {/* Dark vignette at edges */}
            <div style={{
              position: 'absolute', inset: 0,
              background: 'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.28) 100%)',
            }} />
          </div>
        )}

        {/* Decorative circles */}
        <div style={{ position: 'absolute', top: -60, right: -60, width: 220, height: 220, borderRadius: '50%',
          background: 'rgba(255,255,255,0.06)', pointerEvents: 'none', zIndex: 1 }} />
        <div style={{ position: 'absolute', bottom: -80, left: -40, width: 280, height: 280, borderRadius: '50%',
          background: 'rgba(255,255,255,0.04)', pointerEvents: 'none', zIndex: 1 }} />

        <div style={{ display: 'flex', gap: 32, alignItems: 'center', position: 'relative', zIndex: 2 }}>
          {/* Photo — click to open lightbox */}
          <div
            onClick={() => person.photo_url && setPhotoOpen(true)}
            style={{
              width: 130, height: 130, borderRadius: 28, flexShrink: 0,
              overflow: 'hidden', border: '4px solid rgba(255,255,255,0.4)',
              background: 'rgba(255,255,255,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 48,
              boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
              cursor: person.photo_url ? 'zoom-in' : 'default',
              position: 'relative',
            }}>
            {person.photo_url
              ? <>
                  <img src={person.photo_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                  <div style={{
                    position: 'absolute', inset: 0, background: 'rgba(0,0,0,0)', borderRadius: 20,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'background 0.2s',
                    fontSize: 22,
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.32)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,0)'}
                  >
                    <span style={{ opacity: 0, transition: 'opacity 0.2s' }}
                      onMouseEnter={e => { e.currentTarget.style.opacity = 1; e.currentTarget.parentElement.style.background = 'rgba(0,0,0,0.32)' }}
                      onMouseLeave={e => { e.currentTarget.style.opacity = 0; e.currentTarget.parentElement.style.background = 'rgba(0,0,0,0)' }}
                    >🔍</span>
                  </div>
                </>
              : <span>{male ? '👨' : '👩'}</span>}
          </div>

          {/* Meta */}
          <div style={{ flex: 1, color: 'white' }}>
            {/* Badges row */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
              <span style={{ padding: '3px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)' }}>
                {male ? '👨 Erkak' : '👩 Ayol'}
              </span>
              {dead && (
                <span style={{ padding: '3px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                  background: 'rgba(255,255,255,0.15)' }}>🌿 Vafot etgan</span>
              )}
              {person.child_number && (
                <span style={{ padding: '3px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                  background: 'rgba(255,165,0,0.35)' }}>
                  🔢 {person.child_number}-farzand
                </span>
              )}
            </div>

            {/* Name */}
            <h1 style={{ fontSize: 34, fontWeight: 900, margin: '0 0 10px', lineHeight: 1.15,
              textShadow: '0 2px 12px rgba(0,0,0,0.25)' }}>
              {person.full_name}
            </h1>

            {/* Dates & age */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: 14, opacity: 0.92 }}>
              {person.birth_date && (
                <span>📅 {fmtDate(person.birth_date)}
                  {dead && person.death_date ? ` — ${fmtDate(person.death_date)}` : ''}
                </span>
              )}
              {!dead && ageNow != null && (
                <span style={{ fontWeight: 800 }}>🎂 {ageNow} yosh</span>
              )}
              {dead && ageDied != null && (
                <span>🕯️ {ageDied} yosh yashadi
                  {ageNow != null && <span style={{ opacity: 0.75, fontSize: 12 }}> · {ageNow} yosh bo'lar edi</span>}
                </span>
              )}
              {person.phone && (
                <span>📞 {person.phone}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ margin: '-24px 0 0', padding: '0 24px 48px', position: 'relative', width: '100%' }}>
        <div className="profile-grid">

          {/* ── Left column ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Parents */}
            {(person.father_name || person.mother_name) && (
              <div style={{ background: isDark ? '#1e293b' : 'white', borderRadius: 18, padding: '16px', boxShadow: '0 2px 16px rgba(0,0,0,0.07)', border: isDark ? '1px solid #334155' : '1px solid #f1f5f9' }}>
                <SectionTitle icon="👨‍👩‍👦" title="Ota-onasi" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {person.father_name && (
                    <FamilyCard
                      id={person.father}
                      name={person.father_name}
                      gender="male"
                      photo={person.father_photo}
                      role="Otasi"
                      onClick={goToProfile}
                    />
                  )}
                  {person.mother_name && (
                    <FamilyCard
                      id={person.mother}
                      name={person.mother_name}
                      gender="female"
                      photo={person.mother_photo}
                      role="Onasi"
                      onClick={goToProfile}
                    />
                  )}
                </div>
              </div>
            )}

            {/* Ko'p oila */}
            {(person.families || []).length > 0 && (
              <div style={{ background: isDark ? '#1e293b' : 'white', borderRadius: 18, padding: '16px', boxShadow: '0 2px 16px rgba(0,0,0,0.07)', border: isDark ? '1px solid #334155' : '1px solid #f1f5f9' }}>
                <SectionTitle
                  icon="💍"
                  title={person.families.length > 1 ? 'Oilalari' : "Turmush o'rtog'i"}
                  count={person.families.length > 1 ? person.families.length : null}
                />
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {person.families.map((fam, fi) => (
                    <div key={fam.id} style={{ opacity: fam.is_divorced ? 0.7 : 1, position:'relative' }}>
                      {person.families.length > 1 && (
                        <div style={{ fontSize:9, fontWeight:800, color:'#f43f5e', marginBottom:4, paddingLeft:4 }}>
                          💍 {fi+1}-NIKOH
                          {fam.is_divorced && <span style={{ marginLeft:6, color:'#94a3b8' }}>· Ajralgan</span>}
                          {fam.wedding_date && <span style={{ marginLeft:6, color:'#94a3b8' }}>{fmtDate(fam.wedding_date)}</span>}
                        </div>
                      )}
                      <FamilyCard
                        id={fam.partner_id}
                        name={fam.partner_name}
                        gender={fam.partner_gender}
                        photo={fam.partner_photo}
                        role="Juft"
                        onClick={goToProfile}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick info */}
            <div style={{ background: isDark ? '#1e293b' : 'white', borderRadius: 18, padding: '16px', boxShadow: '0 2px 16px rgba(0,0,0,0.07)', border: isDark ? '1px solid #334155' : '1px solid #f1f5f9' }}>
              <SectionTitle icon="ℹ️" title="Ma'lumotlar" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { icon: '🆔', label: 'ID', value: `#${person.id}` },
                  { icon: '📅', label: "Tug'ilgan", value: fmtDate(person.birth_date) },
                  { icon: dead ? '🌿' : '🎂', label: dead ? 'Vafot' : 'Yoshi',
                    value: dead
                      ? `${fmtDate(person.death_date)}${ageDied != null ? ` · ${ageDied} yosh yashadi` : ''}${ageNow != null ? ` · ${ageNow} yosh bo'lar edi` : ''}`
                      : (ageNow != null ? `${ageNow} yosh` : null) },
                  { icon: '📞', label: 'Telefon', value: person.phone },
                  { icon: '👤', label: "Qo'shgan", value: person.created_by_name },
                ].filter(r => r.value).map(({ icon, label, value }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10,
                    padding: '7px 10px', borderRadius: 10, background: isDark ? '#0f172a' : '#f8fafc' }}>
                    <span style={{ fontSize: 15, flexShrink: 0 }}>{icon}</span>
                    <span style={{ fontSize: 11, color: isDark ? '#64748b' : '#94a3b8', minWidth: 64 }}>{label}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: isDark ? '#f1f5f9' : '#374151', marginLeft: 'auto' }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Center column ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Children */}
            {person.children?.length > 0 && (
              <div style={{ background: isDark ? '#1e293b' : 'white', borderRadius: 18, padding: '16px', boxShadow: '0 2px 16px rgba(0,0,0,0.07)', border: isDark ? '1px solid #334155' : '1px solid #f1f5f9' }}>
                <SectionTitle icon="👶" title="Farzandlari" count={person.children.length} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
                  {person.children.map(c => (
                    <FamilyCard
                      key={c.id}
                      id={c.id}
                      name={c.full_name}
                      gender={c.gender}
                      birthDate={c.birth_date}
                      deathDate={c.death_date}
                      photo={c.photo_url}
                      role={c.child_number ? `${c.child_number}-farzand` : null}
                      onClick={goToProfile}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Timeline */}
            <div style={{ background: isDark ? '#1e293b' : 'white', borderRadius: 18, padding: '20px', boxShadow: '0 2px 16px rgba(0,0,0,0.07)', border: `1px solid ${isDark ? '#334155' : '#f1f5f9'}` }}>
              <SectionTitle icon="📅" title="Hayot tarixi" />
              {timeline.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 0', color: '#94a3b8' }}>
                  <div style={{ fontSize: 36, marginBottom: 8 }}>📋</div>
                  <div style={{ fontSize: 13 }}>Ma'lumotlar yetarli emas</div>
                </div>
              ) : (
                <div style={{ position: 'relative', paddingLeft: 22 }}>
                  <div style={{ position: 'absolute', left: 15, top: 8, bottom: 8, width: 2, background: 'linear-gradient(to bottom,#c7d2fe,#fecdd3)', borderRadius: 2 }} />
                  {timeline.map((ev, i) => (
                    <TimelineItem key={i} {...ev} />
                  ))}
                </div>
              )}
            </div>

            {/* Empty state — no family */}
            {!person.father_name && !person.mother_name && !person.families?.length && !person.children?.length && (
              <div style={{ background: isDark ? '#1e293b' : 'white', borderRadius: 18, padding: '32px 20px', textAlign: 'center',
                boxShadow: '0 2px 16px rgba(0,0,0,0.07)', border: isDark ? '1px solid #334155' : '1px solid #f1f5f9' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🌱</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: isDark ? '#f1f5f9' : '#374151', marginBottom: 6 }}>
                  Oila ma'lumotlari yo'q
                </div>
                <div style={{ fontSize: 13, color: isDark ? '#64748b' : '#94a3b8', marginBottom: 16 }}>
                  Ota-ona, turmush o'rtog'i va farzandlarni bog'lang
                </div>
                <button onClick={() => navigate(isAdmin ? '/admin/link' : `${basePath}/${id}/edit`)}
                  style={{ padding: '8px 20px', borderRadius: 12, border: 'none', cursor: 'pointer',
                    background: `linear-gradient(135deg,${accent},${male ? '#7c3aed' : dead ? '#4b5563' : '#be185d'})`,
                    color: 'white', fontSize: 13, fontWeight: 700 }}>
                  🔗 Bog'lanish qo'shish
                </button>
              </div>
            )}
          </div>

          {/* ── Right column — Mini shajara + stat ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Person quick stats card */}
            <div style={{
              background: isDark ? '#1e293b' : 'white', borderRadius: 18,
              padding: '16px', boxShadow: '0 2px 16px rgba(0,0,0,0.07)',
              border: isDark ? '1px solid #334155' : '1px solid #f1f5f9',
            }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[
                  { icon: '👶', label: "Farzand", value: person.children?.length || 0, color: '#f59e0b' },
                  { icon: '👨‍👩‍👦', label: 'Oila', value: (person.families||[]).length, color: '#ec4899' },
                  { icon: '🧬', label: 'Avlod', value: person.child_number ? `${person.child_number}-chi` : '—', color: '#6366f1' },
                ].map(s => (
                  <div key={s.label} style={{
                    flex: 1, minWidth: 70, textAlign: 'center', padding: '10px 8px', borderRadius: 12,
                    background: `${s.color}12`, border: `1px solid ${s.color}22`,
                  }}>
                    <div style={{ fontSize: 18, marginBottom: 2 }}>{s.icon}</div>
                    <div style={{ fontSize: 16, fontWeight: 900, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: isDark ? '#64748b' : '#94a3b8', textTransform: 'uppercase' }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Mini Tree */}
            <MiniTree person={person} isDark={isDark} goToProfile={goToProfile} />

            {/* Action buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button onClick={() => navigate('/tree')}
                style={{ width: '100%', padding: '10px 16px', borderRadius: 12, border: 'none', cursor: 'pointer',
                  background: 'linear-gradient(135deg,#3b82f6,#6366f1)', color: 'white',
                  fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  boxShadow: '0 4px 14px rgba(99,102,241,0.3)' }}>
                🌳 To'liq daraxtda ko'rish
              </button>
              <button onClick={() => navigate(`${basePath}/${id}/edit`)}
                style={{ width: '100%', padding: '10px 16px', borderRadius: 12, border: 'none', cursor: 'pointer',
                  background: `linear-gradient(135deg,${accent},${male ? '#7c3aed' : dead ? '#4b5563' : '#be185d'})`,
                  color: 'white', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  boxShadow: `0 4px 14px ${accent}40` }}>
                ✏️ Ma'lumotlarni tahrirlash
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  )
}
