/**
 * Munosabat hisoblagich
 * ─────────────────────
 * Ikki shaxs o'rtasidagi qarindoshlik munosabatini aniqlaydi.
 * Algoritm:
 *  1. Barcha shaxslarni yuklaydi va graf quradi
 *  2. LCA (Lowest Common Ancestor) orqali munosabat darajasini hisoblaydi
 *  3. BFS orqali oila zanjiri yo'lini topadi
 *  4. Yo'lni vizual tarzda ko'rsatadi
 */
import { useEffect, useMemo, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { getPersons, aiExplain } from '../../api/persons'
import useThemeStore from '../../store/themeStore'

// ─── Yordamchi funksiyalar ────────────────────────────────────

/** ID ni raqamga o'tkazadi (null-safe) */
const toInt = (v) => (v != null && v !== '' ? parseInt(v) : null)

/** Shaxsning otasi/onasi/juftini oladi */
const fatherId  = (p) => toInt(p.father ?? p.father_id)
const motherId  = (p) => toInt(p.mother ?? p.mother_id)
// Ko'p oila: families[] massivdan barcha partner_id lar
const spouseIds = (p) => (p.families || []).map(f => f.partner_id).filter(Boolean)

/** Grafni quradi: shaxs xaritasi + bolalar xaritasi */
function buildGraph(persons) {
  const map = {}           // id → person
  const childrenOf = {}    // parentId → [childId, ...]

  persons.forEach((p) => {
    map[p.id] = p
    childrenOf[p.id] = childrenOf[p.id] || []
  })

  persons.forEach((p) => {
    const dad = fatherId(p)
    const mom = motherId(p)
    if (dad) { childrenOf[dad] = childrenOf[dad] || []; if (!childrenOf[dad].includes(p.id)) childrenOf[dad].push(p.id) }
    if (mom) { childrenOf[mom] = childrenOf[mom] || []; if (!childrenOf[mom].includes(p.id)) childrenOf[mom].push(p.id) }
  })

  return { map, childrenOf }
}

/** Barcha ajdodlarni (o'zi ham kiritilgan holda) va ularning chuqurligini qaytaradi */
function getAncestors(startId, map) {
  const result = {}
  const queue = [{ id: startId, depth: 0 }]
  while (queue.length) {
    const { id, depth } = queue.shift()
    if (result[id] !== undefined) continue
    result[id] = depth
    const p = map[id]
    if (!p) continue
    const dad = fatherId(p)
    const mom = motherId(p)
    if (dad) queue.push({ id: dad, depth: depth + 1 })
    if (mom) queue.push({ id: mom, depth: depth + 1 })
  }
  return result
}

/** LCA (eng yaqin umumiy ajdod) ni topadi */
function findLCA(idA, idB, map) {
  const ancA = getAncestors(idA, map)
  const ancB = getAncestors(idB, map)
  let best = null

  for (const id in ancA) {
    const numId = parseInt(id)
    if (ancB[numId] !== undefined) {
      const total = ancA[numId] + ancB[numId]
      if (!best || total < best.total)
        best = { id: numId, depthA: ancA[numId], depthB: ancB[numId], total }
    }
  }
  return best
}

/**
 * BFS orqali ikki shaxs orasidagi to'liq yo'lni topadi.
 * Yo'l elementlari: { id, dir: 'up'|'down'|'spouse'|'start' }
 */
function findPath(startId, endId, map, childrenOf) {
  if (startId === endId) return [{ id: startId, dir: 'start' }]

  const visited = new Set([startId])
  const queue = [[{ id: startId, dir: 'start' }]]

  while (queue.length) {
    const path = queue.shift()
    const curId = path[path.length - 1].id
    const cur = map[curId]
    if (!cur) continue

    const neighbors = []
    const dad = fatherId(cur)
    const mom = motherId(cur)

    if (dad) neighbors.push({ id: dad,   dir: 'up' })
    if (mom) neighbors.push({ id: mom,   dir: 'up' })
    spouseIds(cur).forEach(sp => neighbors.push({ id: sp, dir: 'spouse' }))
    ;(childrenOf[curId] || []).forEach((cid) => neighbors.push({ id: cid, dir: 'down' }))

    for (const nb of neighbors) {
      if (visited.has(nb.id)) continue
      const newPath = [...path, nb]
      if (nb.id === endId) return newPath
      visited.add(nb.id)
      queue.push(newPath)
    }
  }
  return null
}

// ─── Munosabat nomi (O'zbekcha, jinsga mos) ──────────────────

function getRelInfo(depthA, depthB, genderA, genderB) {
  const mA = genderA === 'male'
  const mB = genderB === 'male'

  // Bir xil shaxs
  if (depthA === 0 && depthB === 0)
    return { label: 'Bir xil shaxs', detail: 'Tanlangan ikkala shaxs bir xil', emoji: '🪞', color: '#6366f1', grade: 0 }

  // A — B ning to'g'ridan-to'g'ri ajdodi
  if (depthA === 0) {
    if (depthB === 1) return { label: mA ? "Otasi" : "Onasi", detail: "To'g'ridan-to'g'ri ota-ona", emoji: mA ? '👨' : '👩', color: '#7c3aed', grade: 1 }
    if (depthB === 2) return { label: mA ? "Bobosi" : "Buvisi", detail: "Ikkinchi avlod ajdodi", emoji: mA ? '👴' : '👵', color: '#6d28d9', grade: 2 }
    if (depthB === 3) return { label: mA ? "Qari bobosi" : "Qari buvisi", detail: "Uchinchi avlod ajdodi", emoji: mA ? '🧓' : '👵', color: '#5b21b6', grade: 3 }
    return { label: `${depthB}-avlod ajdodi`, detail: `${depthB} pog'ona yuqorida`, emoji: '🌿', color: '#4c1d95', grade: depthB }
  }

  // B — A ning to'g'ridan-to'g'ri ajdodi
  if (depthB === 0) {
    if (depthA === 1) return { label: mA ? "O'g'li" : "Qizi", detail: "To'g'ridan-to'g'ri farzand", emoji: mA ? '👦' : '👧', color: '#059669', grade: 1 }
    if (depthA === 2) return { label: mA ? "O'g'il nabirasi" : "Qiz nabirasi", detail: "Ikkinchi avlod nasl", emoji: '👶', color: '#047857', grade: 2 }
    if (depthA === 3) return { label: mA ? "O'g'il evarasi" : "Qiz evarasi", detail: "Uchinchi avlod nasl", emoji: '🌱', color: '#065f46', grade: 3 }
    return { label: `${depthA}-avlod naslidan`, detail: `${depthA} pog'ona pastda`, emoji: '🌱', color: '#064e3b', grade: depthA }
  }

  // Aka-uka / Opa-singil
  if (depthA === 1 && depthB === 1) {
    const same = (mA && mB) || (!mA && !mB)
    return {
      label: mA ? (mB ? "Akasi / Ukasi" : "Opasining akasi") : (mB ? "Singlisining akasi" : "Opasi / Singlisi"),
      detail: "Bir ajdoddan tug'ilgan, bir avlod",
      emoji: '👨‍👩‍👦', color: '#2563eb', grade: 2
    }
  }

  // Amaki / Tog'a / Amma / Xola  (A chuqurligi 1, B chuqurligi 2)
  if (depthA === 1 && depthB === 2)
    return {
      label: mA ? "Amakisi / Tog'asi" : "Ammassi / Xolasi",
      detail: mA ? "Otaning akasi/ukasi yoki onaning akasi" : "Otaning singlisi yoki onaning singlisi",
      emoji: mA ? '👨' : '👩', color: '#d97706', grade: 3
    }

  // Jiyan  (A chuqurligi 2, B chuqurligi 1)
  if (depthA === 2 && depthB === 1)
    return {
      label: mA ? "Jiyani (o'g'il)" : "Jiyani (qiz)",
      detail: "Aka-uka yoki opa-singlining farzandi",
      emoji: mA ? '👦' : '👧', color: '#d97706', grade: 3
    }

  // 1-darajali amakivachcha  (2,2)
  if (depthA === 2 && depthB === 2)
    return {
      label: "Amakivachchasi (1-darajali)",
      detail: "Ota yoki onaning aka-ukasi / opa-singlisining farzandi",
      emoji: '🤝', color: '#0891b2', grade: 4
    }

  // Katta amaki/xola  (A=1, B=3)
  if (depthA === 1 && depthB === 3)
    return {
      label: mA ? "Katta amakisi / Tog'asining otasi" : "Katta ammasi / Xolasining onasi",
      detail: "Bobo yoki buvining akasi/singlisi",
      emoji: mA ? '👴' : '👵', color: '#7c3aed', grade: 4
    }

  // (A=3, B=1)
  if (depthA === 3 && depthB === 1)
    return {
      label: mA ? "Katta jiyanining o'g'li" : "Katta jiyanining qizi",
      detail: "Uchinchi avlod jiyan",
      emoji: '👶', color: '#7c3aed', grade: 4
    }

  // 2-darajali amakivachcha  (3,3)
  if (depthA === 3 && depthB === 3)
    return {
      label: "2-darajali qarindosh",
      detail: "Bobo/buvining aka-ukasi/opa-singlisining nabirasi",
      emoji: '🔗', color: '#64748b', grade: 5
    }

  // Umumiy holat
  const diff = Math.abs(depthA - depthB)
  const base = Math.min(depthA, depthB)
  if (diff === 0)
    return { label: `${base}-avlod qarindoshi`, detail: `${base} pog'ona umumiy ajdodgacha`, emoji: '🔗', color: '#94a3b8', grade: base + 3 }
  return {
    label: `Uzoq qarindosh (${depthA}/${depthB})`,
    detail: `Umumiy ajdoddan ${depthA} va ${depthB} pog'ona uzoqda`,
    emoji: '🔗', color: '#94a3b8', grade: depthA + depthB
  }
}

// ─── Yo'l qadam yorlig'i ──────────────────────────────────────

function stepLabel(dir, person) {
  const male = person?.gender === 'male'
  if (dir === 'up')    return male ? '↑ Otasi' : '↑ Onasi'
  if (dir === 'down')  return male ? "↓ O'g'li" : '↓ Qizi'
  if (dir === 'spouse') return '↔ Juft'
  return ''
}

// ─── Kichik komponentlar ──────────────────────────────────────

function PersonCard({ person, label, accent, onClick, selected }) {
  const { isDark } = useThemeStore()
  if (!person) return (
    <div style={{ width: 90, textAlign: 'center', opacity: 0.3 }}>
      <div style={{ width: 52, height: 52, borderRadius: 16, background: isDark ? '#334155' : '#f1f5f9',
        margin: '0 auto 6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
        👤
      </div>
      <div style={{ fontSize: 11, color: '#94a3b8' }}>Tanlanmagan</div>
    </div>
  )

  const male = person.gender === 'male'
  const dead = !!person.death_date

  return (
    <div onClick={onClick} style={{
      width: 90, textAlign: 'center', cursor: onClick ? 'pointer' : 'default',
      transition: 'transform 0.15s',
    }}
    onMouseEnter={e => onClick && (e.currentTarget.style.transform = 'scale(1.04)')}
    onMouseLeave={e => (e.currentTarget.style.transform = '')}>
      <div style={{
        width: 52, height: 52, borderRadius: 16, margin: '0 auto 6px',
        overflow: 'hidden', border: `3px solid ${selected ? accent : (isDark ? '#475569' : '#e2e8f0')}`,
        background: dead ? (isDark ? '#374151' : '#f3f4f6') : male ? '#ede9fe' : '#fce7f3',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
        boxShadow: selected ? `0 0 0 3px ${accent}40` : 'none',
        transition: 'border-color 0.15s, box-shadow 0.15s',
      }}>
        {person.photo_url || person.photo
          ? <img src={person.photo_url || person.photo} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
          : <span>{male ? '👨' : '👩'}</span>}
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: isDark ? '#f1f5f9' : '#1e293b', lineHeight: 1.2, marginBottom: 2 }}>
        {person.full_name?.split(' ').slice(0, 2).join(' ')}
      </div>
      {label && (
        <div style={{ fontSize: 10, color: accent, fontWeight: 700, background: `${accent}18`,
          padding: '1px 6px', borderRadius: 10, display: 'inline-block' }}>
          {label}
        </div>
      )}
      {person.birth_date && (
        <div style={{ fontSize: 10, color: isDark ? '#64748b' : '#94a3b8', marginTop: 2 }}>
          {new Date(person.birth_date + 'T00:00:00').getFullYear()}
          {dead ? `–${new Date(person.death_date + 'T00:00:00').getFullYear()}` : ''}
        </div>
      )}
    </div>
  )
}

// SearchInput — server-side qidiruv (debounce, page_size: 20)
// Barcha shaxslarni oldindan yuklamaydi — faqat yozilganda API chaqiriladi.
function SearchInput({ label, selectedId, selectedPerson, onSelect, accent }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const { isDark } = useThemeStore()
  const wrapRef = useRef(null)
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 })
  const debounceRef = useRef(null)

  const fetchResults = (val) => {
    clearTimeout(debounceRef.current)
    const params = val.trim().length >= 1 ? { search: val.trim(), page_size: 20 } : { page_size: 20 }
    debounceRef.current = setTimeout(() => {
      setSearching(true)
      getPersons(params)
        .then(r => { setResults(r.data.results || r.data || []); setSearching(false) })
        .catch(() => setSearching(false))
    }, val.trim().length >= 1 ? 280 : 0)
  }

  const selected = selectedPerson || null

  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleOpen = () => {
    if (wrapRef.current) {
      const r = wrapRef.current.getBoundingClientRect()
      setDropPos({ top: r.bottom + window.scrollY + 4, left: r.left + window.scrollX, width: r.width })
    }
    if (!open) fetchResults(q)
    setOpen(o => !o)
  }

  return (
    <div ref={wrapRef} className="rel-search-wrap" style={{ position: 'relative', flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: isDark ? '#94a3b8' : '#64748b', textTransform: 'uppercase',
        letterSpacing: '0.06em', marginBottom: 6 }}>{label}</div>

      <div
        onClick={handleOpen}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
          borderRadius: 14, border: `2px solid ${open ? accent : (isDark ? '#334155' : '#e2e8f0')}`,
          background: isDark ? '#1e293b' : 'white', cursor: 'pointer', transition: 'border-color 0.15s',
          boxShadow: open ? `0 0 0 3px ${accent}20` : '0 1px 4px rgba(0,0,0,0.06)',
          minWidth: 0,
        }}
      >
        {selected ? (
          <>
            <div style={{ width: 30, height: 30, borderRadius: 9, overflow: 'hidden', flexShrink: 0,
              background: selected.gender === 'male' ? '#ede9fe' : '#fce7f3',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
              {selected.photo_url || selected.photo
                ? <img src={selected.photo_url || selected.photo} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                : <span>{selected.gender === 'male' ? '👨' : '👩'}</span>}
            </div>
            <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: isDark ? '#f1f5f9' : '#0f172a',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selected.full_name}</div>
              <div style={{ fontSize: 10, color: isDark ? '#64748b' : '#94a3b8' }}>
                {selected.birth_date ? new Date(selected.birth_date + 'T00:00:00').getFullYear() : ''}
                {selected.gender === 'male' ? ' · Erkak' : ' · Ayol'}
              </div>
            </div>
            <button
              onClick={e => { e.stopPropagation(); onSelect(null); setQ(''); setOpen(false) }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 16, padding: '0 2px', flexShrink: 0 }}>
              ✕
            </button>
          </>
        ) : (
          <>
            <span style={{ fontSize: 16, flexShrink: 0 }}>🔍</span>
            <span style={{ fontSize: 13, color: isDark ? '#64748b' : '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Shaxsni tanlang...
            </span>
          </>
        )}
        <span style={{ color: '#94a3b8', fontSize: 11, flexShrink: 0 }}>{open ? '▲' : '▼'}</span>
      </div>

      {/* Dropdown — fixed position to avoid overflow:hidden clipping */}
      {open && (
        <div style={{
          position: 'fixed',
          top: dropPos.top, left: dropPos.left, width: dropPos.width,
          zIndex: 9999,
          background: isDark ? '#1e293b' : 'white',
          borderRadius: 14, border: isDark ? '1.5px solid #334155' : '1.5px solid #e2e8f0',
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)', overflow: 'hidden',
        }}>
          <div style={{ padding: '8px 10px', borderBottom: isDark ? '1px solid #334155' : '1px solid #f1f5f9' }}>
            <input
              autoFocus
              placeholder="Ism yoki familiya..."
              value={q}
              onChange={e => { setQ(e.target.value); fetchResults(e.target.value) }}
              style={{
                width: '100%', padding: '8px 12px', borderRadius: 10,
                border: isDark ? '1.5px solid #334155' : '1.5px solid #e2e8f0',
                fontSize: 13, outline: 'none',
                background: isDark ? '#0f172a' : '#f8fafc',
                color: isDark ? '#f1f5f9' : '#0f172a',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ maxHeight: 260, overflowY: 'auto' }}>
            {searching ? (
              <div style={{ padding: '16px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Qidirilmoqda...</div>
            ) : results.length === 0 ? (
              <div style={{ padding: '16px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                Topilmadi
              </div>
            ) : results.map(p => (
              <div key={p.id}
                onClick={() => { onSelect(p.id, p); setOpen(false); setQ('') }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px',
                  cursor: 'pointer', background: p.id === selectedId ? `${accent}10` : 'transparent',
                  borderLeft: p.id === selectedId ? `3px solid ${accent}` : '3px solid transparent',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = isDark ? `${accent}18` : `${accent}08`}
                onMouseLeave={e => e.currentTarget.style.background = p.id === selectedId ? `${accent}10` : 'transparent'}
              >
                <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                  background: p.gender === 'male' ? '#ede9fe' : '#fce7f3', overflow: 'hidden',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
                  {p.photo_url || p.photo
                    ? <img src={p.photo_url || p.photo} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                    : <span>{p.gender === 'male' ? '👨' : '👩'}</span>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: isDark ? '#f1f5f9' : '#0f172a',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.full_name}</div>
                  <div style={{ fontSize: 11, color: isDark ? '#64748b' : '#94a3b8' }}>
                    {p.birth_date ? new Date(p.birth_date + 'T00:00:00').getFullYear() : '—'}
                    {p.death_date ? ` – ${new Date(p.death_date + 'T00:00:00').getFullYear()}` : ''}
                    {` · ${p.gender === 'male' ? 'Erkak' : 'Ayol'}`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Asosiy sahifa ────────────────────────────────────────────

export default function RelationshipPage() {
  const navigate = useNavigate()
  const [persons, setPersons]   = useState([])
  const [loading, setLoading]   = useState(false)  // faqat hisoblash vaqtida yuklaydi
  const [idA, setIdA]           = useState(null)
  const [idB, setIdB]           = useState(null)
  const [personA, setPersonA]   = useState(null)  // SearchInput tanlagan to'liq object
  const [personB, setPersonB]   = useState(null)
  const [result, setResult]     = useState(null)
  const [calculating, setCalc]  = useState(false)
  const [history, setHistory]   = useState([])
  // 15. AI explain
  const [aiText, setAiText]         = useState('')
  const [aiSource, setAiSource]     = useState('')  // 'template' | 'gemini/...' | 'groq/...'
  const [aiLoading, setAiLoading]   = useState(false)
  const [aiDisplayed, setAiDisplayed] = useState('')  // typewriter effect
  const aiTimerRef                  = useRef(null)

  const { isDark } = useThemeStore()
  const { map, childrenOf } = useMemo(() => {
    if (!persons.length) return { map: {}, childrenOf: {} }
    return buildGraph(persons)
  }, [persons])

  // Barcha shaxslarni faqat hisoblash kerak bo'lganda yuklaymiz (lazy).
  // Selector o'zi server-side qidiruv ishlatadi — mount'da hech narsa yuklanmaydi.
  const loadGraph = () => {
    if (persons.length > 0) return Promise.resolve()
    setLoading(true)
    return getPersons({ page_size: 9999 })
      .then(r => { setPersons(r.data.results || r.data); setLoading(false) })
      .catch(() => setLoading(false))
  }

  // Avtomatik hisoblash (ikkala shaxs tanlanganda)
  useEffect(() => {
    if (idA && idB) {
      loadGraph().then(() => {
        // map persons.length > 0 bo'lgandan keyin yangilanadi → keyingi render da calculate
      })
    } else {
      setResult(null)
    }
  }, [idA, idB])

  useEffect(() => {
    if (idA && idB && persons.length > 0) calculate(idA, idB)
  }, [idA, idB, map])

  const calculate = (a, b) => {
    if (!a || !b || !Object.keys(map).length) return
    setCalc(true)

    setTimeout(() => {  // mikro-animatsiya uchun
      const pA = map[a]
      const pB = map[b]
      if (!pA || !pB) { setResult({ error: 'Shaxs topilmadi' }); setCalc(false); return }

      // To'g'ridan-to'g'ri juft tekshiruvi (ko'p oila)
      if (spouseIds(pA).includes(b)) {
        const rel = {
          label: pA.gender === 'male' ? "Xotini" : "Eri",
          detail: "To'g'ridan-to'g'ri turmush o'rtog'i",
          emoji: '💍', color: '#f43f5e', grade: 1
        }
        const path = [{ id: a, dir: 'start' }, { id: b, dir: 'spouse' }]
        setResult({ rel, path, pA, pB })
        addHistory(pA, pB, rel)
        setCalc(false)
        return
      }

      // LCA orqali munosabat
      const lca = findLCA(a, b, map)
      if (!lca) {
        // Oila bog'lanishi yo'q — lekin yo'l bor bo'lishi mumkin (spouse orqali)
        const path = findPath(a, b, map, childrenOf)
        if (!path) {
          setResult({ error: 'Bu ikki shaxs orasida hech qanday oila aloqasi topilmadi.' })
          setCalc(false)
          return
        }
        const rel = { label: 'Nikoh orqali qarindosh', detail: 'Turmush o\'rtog\'lari orqali bog\'langan', emoji: '💍', color: '#f43f5e', grade: 5 }
        setResult({ rel, path, pA, pB })
        addHistory(pA, pB, rel)
        setCalc(false)
        return
      }

      const rel = getRelInfo(lca.depthA, lca.depthB, pA.gender, pB.gender)
      const path = findPath(a, b, map, childrenOf)
      setResult({ rel, lca, path, pA, pB })
      addHistory(pA, pB, rel)
      setCalc(false)
    }, 300)
  }

  const addHistory = (pA, pB, rel) => {
    setHistory(h => [
      { id: Date.now(), nameA: pA.full_name, nameB: pB.full_name, rel, ts: new Date() },
      ...h.slice(0, 4)
    ])
  }

  const swap = () => {
    setIdA(idB); setIdB(idA)
    setPersonA(personB); setPersonB(personA)
  }

  // Natija o'zgarganda AI textni tozalash
  useEffect(() => { setAiText(''); setAiDisplayed('') }, [idA, idB])

  // Typewriter effect
  useEffect(() => {
    if (!aiText) { setAiDisplayed(''); return }
    setAiDisplayed('')
    let i = 0
    clearInterval(aiTimerRef.current)
    aiTimerRef.current = setInterval(() => {
      i++
      setAiDisplayed(aiText.slice(0, i))
      if (i >= aiText.length) clearInterval(aiTimerRef.current)
    }, 18)
    return () => clearInterval(aiTimerRef.current)
  }, [aiText])

  const handleAiExplain = async () => {
    if (!result || aiLoading) return
    setAiLoading(true)
    setAiText('')
    try {
      const payload = {
        name_a:         result.pA?.full_name || '',
        name_b:         result.pB?.full_name || '',
        relation_label: result.rel?.label || '',
        lca_name:       result.lca ? (map[result.lca.id]?.full_name || '') : '',
        depth_a:        result.lca?.depthA ?? 0,
        depth_b:        result.lca?.depthB ?? 0,
        path_names:     (result.path || []).map(n => map[n.id]?.full_name).filter(Boolean),
      }
      const r = await aiExplain(payload)
      setAiText(r.data.text)
      setAiSource(r.data.source || '')
    } catch (err) {
      const status = err?.response?.status
      if (status === 401 || status === 403) {
        setAiText('AI tushuntirish uchun akkauntga kirish kerak.')
      } else if (status >= 500) {
        setAiText(`Server xatosi (${status}). Bir ozdan keyin urinib ko'ring.`)
      } else {
        setAiText("Kechirasiz, AI tushuntirishda xato yuz berdi. Qaytadan urinib ko'ring.")
      }
      setAiSource('')
    } finally {
      setAiLoading(false)
    }
  }

  const gradeColor = result?.rel?.color || '#6366f1'

  return (
    <div style={{ minHeight: '100vh', background: isDark ? '#0f172a' : '#f8fafc', width: '100%', boxSizing: 'border-box' }}>
      <style>{`
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }

        /* Full-width wrapper */
        .rel-wrap {
          width: 100% !important;
          max-width: 100% !important;
          margin: 0 !important;
          box-sizing: border-box !important;
        }

        /* Single-column stacked layout */
        .rel-result-cols  { display: flex; flex-direction: column; gap: 20px; width: 100%; }
        .rel-result-left  { display: flex; flex-direction: column; gap: 20px; width: 100%; }
        .rel-result-right { display: flex; flex-direction: column; gap: 20px; width: 100%; }
        @media (max-width: 640px) {
          .rel-topbar { padding: 10px 12px !important; gap: 8px !important; }
          .rel-topbar-title { font-size: 13px !important; }
          .rel-topbar-sub { display: none !important; }
          .rel-topbar-count { font-size: 10px !important; padding: 3px 8px !important; }
          .rel-wrap { padding: 12px 10px 80px !important; }
          .rel-selector { padding: 16px !important; border-radius: 18px !important; margin-bottom: 14px !important; }
          .rel-inputs-row { flex-direction: column !important; align-items: stretch !important; }
          .rel-swap-btn { flex-direction: row !important; gap: 8px !important; padding-bottom: 0 !important; align-self: center !important; }
          .rel-swap-inner { width: 38px !important; height: 38px !important; }
          .rel-search-wrap { min-width: unset !important; width: 100% !important; }
          .rel-preview { padding: 12px 14px !important; margin-top: 14px !important; }
          .rel-result-header { padding: 16px 16px 14px !important; }
          .rel-result-hero { gap: 12px !important; }
          .rel-result-icon { width: 52px !important; height: 52px !important; font-size: 26px !important; border-radius: 16px !important; }
          .rel-result-title { font-size: 16px !important; }
          .rel-lca-row { flex-direction: column !important; gap: 10px !important; padding: 14px 14px !important; }
          .rel-lca-nums { flex-direction: row !important; gap: 16px !important; justify-content: center !important; }
          .rel-empty-grid { grid-template-columns: 1fr !important; gap: 12px !important; }
          .rel-path-section { padding: 14px 12px !important; }
          .rel-ai-section { padding: 12px 14px !important; }
          .rel-degree-grid { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>

      {/* ── Top bar ── */}
      <div className="rel-topbar" style={{ position: 'sticky', top: 0, zIndex: 100,
        background: isDark ? 'rgba(15,23,42,0.92)' : 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(12px)',
        borderBottom: isDark ? '1px solid #334155' : '1px solid #e2e8f0',
        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 24px',
        boxShadow: '0 1px 12px rgba(0,0,0,0.06)' }}>
        <button onClick={() => navigate(-1)} style={{
          padding: '6px 12px', borderRadius: 10, background: isDark ? '#1e293b' : '#f1f5f9',
          border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: isDark ? '#94a3b8' : '#64748b',
          whiteSpace: 'nowrap', flexShrink: 0,
        }}>← Orqaga</button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="rel-topbar-title" style={{ fontSize: 14, fontWeight: 900, color: isDark ? '#f1f5f9' : '#0f172a',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            🔗 Munosabat hisoblagich
          </div>
          <div className="rel-topbar-sub" style={{ fontSize: 11, color: isDark ? '#64748b' : '#94a3b8' }}>
            Ikki shaxs o'rtasidagi qarindoshlik munosabatini aniqlang
          </div>
        </div>

        <div className="rel-topbar-count" style={{ fontSize: 11, color: isDark ? '#64748b' : '#94a3b8',
          background: isDark ? '#1e293b' : '#f1f5f9', padding: '4px 10px', borderRadius: 20,
          whiteSpace: 'nowrap', flexShrink: 0 }}>
          {loading ? '⏳ Yuklanmoqda...' : persons.length > 0 ? `${persons.length} ta` : 'Tanlang'}
        </div>
      </div>

      <div className="rel-wrap" style={{ width: '100%', boxSizing: 'border-box', padding: '20px 20px 80px' }}>

        {/* ── Selector panel ── */}
        <div className="rel-selector" style={{ background: isDark ? '#1e293b' : 'white', borderRadius: 24, padding: '20px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
          border: isDark ? '1px solid #334155' : '1px solid #f1f5f9', marginBottom: 20,
          position: 'relative', width: '100%', boxSizing: 'border-box' }}>
          {/* Decorative gradient strip */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3,
            background: 'linear-gradient(90deg,#6366f1,#ec4899)', borderRadius: '24px 24px 0 0' }} />

          <div className="rel-inputs-row" style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
            <SearchInput
              label="👤 Birinchi shaxs (A)"
              selectedId={idA}
              selectedPerson={personA}
              onSelect={(id, p) => { setIdA(id); setPersonA(p || null) }}
              accent="#6366f1"
            />

            {/* Swap button */}
            <div className="rel-swap-btn" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, paddingBottom: 4, flexShrink: 0 }}>
              <div style={{ fontSize: 9, color: '#94a3b8', whiteSpace: 'nowrap' }}>almashtir</div>
              <button onClick={swap} className="rel-swap-inner" style={{
                width: 44, height: 44, borderRadius: 14,
                border: isDark ? '2px solid #334155' : '2px solid #e2e8f0',
                background: isDark ? '#0f172a' : 'white', cursor: 'pointer', fontSize: 20,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s', boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#6366f1'; e.currentTarget.style.background = isDark ? '#1e1b4b' : '#eef2ff' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = isDark ? '#334155' : '#e2e8f0'; e.currentTarget.style.background = isDark ? '#0f172a' : 'white' }}>
                ⇄
              </button>
            </div>

            <SearchInput
              label="👤 Ikkinchi shaxs (B)"
              selectedId={idB}
              selectedPerson={personB}
              onSelect={(id, p) => { setIdB(id); setPersonB(p || null) }}
              accent="#ec4899"
            />
          </div>

          {/* Preview cards */}
          {(idA || idB) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 20,
              padding: '16px 20px', borderRadius: 16,
              background: isDark ? '#0f172a' : '#f8fafc',
              border: isDark ? '1px solid #334155' : '1px solid #f1f5f9' }}>
              <PersonCard person={personA || map[idA]} label="A" accent="#6366f1" selected />
              <div style={{ flex: 1, textAlign: 'center' }}>
                {calculating ? (
                  <div style={{ animation: 'spin 1s linear infinite', fontSize: 28 }}>⚙️</div>
                ) : result?.rel ? (
                  <div>
                    <div style={{ fontSize: 28, marginBottom: 4 }}>{result.rel.emoji}</div>
                    <div style={{ fontSize: 13, fontWeight: 900, color: result.rel.color }}>{result.rel.label}</div>
                  </div>
                ) : (
                  <div style={{ color: '#94a3b8', fontSize: 13 }}>
                    {idA && idB ? '...' : '← Ikkala shaxsni tanlang →'}
                  </div>
                )}
              </div>
              <PersonCard person={personB || map[idB]} label="B" accent="#ec4899" selected />
            </div>
          )}
        </div>

        {/* ── Natija ── */}
        {result && !result.error && (
          <div className="rel-result-cols">

          <div className="rel-result-left">
            {/* Main result card */}
            <div style={{
              borderRadius: 24, overflow: 'hidden',
              boxShadow: '0 4px 32px rgba(0,0,0,0.1)',
              border: `1px solid ${result.rel.color}30`,
            }}>
              {/* Header */}
              <div className="rel-result-header" style={{
                padding: '24px 24px 18px',
                background: `linear-gradient(135deg, ${result.rel.color}15, ${result.rel.color}05)`,
                borderBottom: `1px solid ${result.rel.color}20`,
              }}>
                <div className="rel-result-hero" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div className="rel-result-icon" style={{
                    width: 72, height: 72, borderRadius: 20,
                    background: `linear-gradient(135deg,${result.rel.color},${result.rel.color}aa)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 36, boxShadow: `0 8px 24px ${result.rel.color}40`, flexShrink: 0,
                  }}>
                    {result.rel.emoji}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: result.rel.color,
                      textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                      Munosabat natijasi
                    </div>
                    <div className="rel-result-title" style={{ fontSize: 20, fontWeight: 900, color: isDark ? '#f1f5f9' : '#0f172a', lineHeight: 1.2, marginBottom: 6,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {result.pA?.full_name?.split(' ')[0]} — {result.pB?.full_name?.split(' ')[0]}
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{
                        padding: '5px 16px', borderRadius: 20, fontSize: 14, fontWeight: 800,
                        background: result.rel.color, color: 'white',
                        boxShadow: `0 4px 12px ${result.rel.color}40`
                      }}>
                        {result.rel.label}
                      </span>
                      {result.lca && (
                        <span style={{ fontSize: 12, color: '#64748b', padding: '4px 12px',
                          background: '#f1f5f9', borderRadius: 20 }}>
                          {result.lca.depthA + result.lca.depthB} qadam
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 16, padding: '12px 16px', borderRadius: 12,
                  background: `${result.rel.color}10`, border: `1px solid ${result.rel.color}20` }}>
                  <div style={{ fontSize: 13, color: isDark ? '#cbd5e1' : '#374151', lineHeight: 1.5 }}>
                    <strong style={{ color: result.rel.color }}>{result.pA?.full_name}</strong>
                    {' '}—{' '}
                    <strong style={{ color: '#ec4899' }}>{result.pB?.full_name}</strong>
                    {' '}ning{' '}
                    <strong style={{ color: result.rel.color }}>{result.rel.label.toLowerCase()}</strong>
                    {' '}hisoblanadi.
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                    💡 {result.rel.detail}
                  </div>
                </div>
              </div>

              {/* LCA info */}
              {result.lca && result.lca.depthA > 0 && result.lca.depthB > 0 && (
                <div className="rel-lca-row" style={{ padding: '14px 20px', background: isDark ? '#1e293b' : 'white',
                  borderBottom: isDark ? `1px solid #334155` : `1px solid #f1f5f9`, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 140, textAlign: 'center', padding: '10px', borderRadius: 12, background: isDark ? '#1e1b4b' : '#eef2ff' }}>
                    <div style={{ fontSize: 10, color: '#6366f1', fontWeight: 700, marginBottom: 2 }}>UMUMIY AJDOD</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: isDark ? '#a5b4fc' : '#1e1b4b' }}>
                      {map[result.lca.id]?.full_name || `ID: ${result.lca.id}`}
                    </div>
                    <div style={{ fontSize: 10, color: '#818cf8', marginTop: 2 }}>
                      A: {result.lca.depthA} pog'ona · B: {result.lca.depthB} pog'ona
                    </div>
                  </div>
                  <div className="rel-lca-nums" style={{ display: 'flex', gap: 14 }}>
                    {[
                      { label: 'A → ajdod', val: result.lca.depthA, color: '#6366f1' },
                      { label: 'B → ajdod', val: result.lca.depthB, color: '#ec4899' },
                      { label: 'Jami', val: result.lca.depthA + result.lca.depthB, color: isDark ? '#f1f5f9' : '#0f172a' },
                    ].map(({ label, val, color }) => (
                      <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ fontSize: 10, color: '#94a3b8' }}>{label}</div>
                        <div style={{ fontSize: 22, fontWeight: 900, color }}>{val}</div>
                        <div style={{ fontSize: 10, color: '#94a3b8' }}>qadam</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Path chain — Visual Road Map */}
              {result.path && result.path.length > 1 && (() => {
                // LCA id ni aniqlaymiz (path ichida)
                const lcaId = result.lca?.id
                // Turning point index: up bo'lgan so'nggi node yoki LCA
                const turningIdx = lcaId ? result.path.findIndex(n => n.id === lcaId) : -1

                return (
                <div style={{ padding: '20px 28px', background: isDark ? '#1e293b' : 'white' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: isDark ? '#94a3b8' : '#374151',
                      textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      🗺️ Oila yo'l xaritasi
                    </div>
                    <div style={{ fontSize: 11, color: isDark ? '#475569' : '#94a3b8' }}>
                      {result.path.length - 1} qadam
                    </div>
                  </div>

                  {/* Legend */}
                  <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
                    {[
                      { color: '#7c3aed', label: '↑ Yuqoriga (ota-ona)' },
                      { color: '#059669', label: '↓ Pastga (farzand)' },
                      { color: '#f43f5e', label: '↔ Juft (nikoh)' },
                    ].map(l => (
                      <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <div style={{ width: 10, height: 10, borderRadius: 3, background: l.color }} />
                        <span style={{ fontSize: 10, color: isDark ? '#64748b' : '#94a3b8', fontWeight: 600 }}>{l.label}</span>
                      </div>
                    ))}
                  </div>

                  {/* Path — scrollable row */}
                  <div style={{ overflowX: 'auto', paddingBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', minWidth: 'max-content', gap: 0 }}>
                      {result.path.map((node, i) => {
                        const p = map[node.id]
                        if (!p) return null
                        const isFirst  = i === 0
                        const isLast   = i === result.path.length - 1
                        const isLCA    = node.id === lcaId && i === turningIdx && turningIdx > 0 && turningIdx < result.path.length - 1
                        const male     = p.gender === 'male'
                        const dead     = !!p.death_date

                        // Direction color
                        const dirColor = node.dir === 'up' ? '#7c3aed'
                          : node.dir === 'down'   ? '#059669'
                          : node.dir === 'spouse' ? '#f43f5e'
                          : '#6366f1'

                        // Card accent
                        const accent = isFirst ? '#6366f1'
                          : isLast  ? '#ec4899'
                          : isLCA   ? '#f59e0b'
                          : dead    ? '#6b7280'
                          : male    ? '#6366f1' : '#ec4899'

                        const cardBg = isFirst
                          ? (isDark ? '#1e1b4b' : '#eef2ff')
                          : isLast  ? (isDark ? '#2d1b2e' : '#fff0f8')
                          : isLCA   ? (isDark ? '#2d1f06' : '#fffbeb')
                          : (isDark ? '#0f172a' : '#f8fafc')

                        const cardBorder = isFirst ? '#c7d2fe'
                          : isLast  ? '#fbcfe8'
                          : isLCA   ? '#fde68a'
                          : (isDark ? '#334155' : '#e2e8f0')

                        // Direction label + arrow for connector
                        const dirLabel = node.dir === 'up'     ? 'otasi/onasi ↑'
                          : node.dir === 'down'   ? '↓ farzandi'
                          : node.dir === 'spouse' ? '↔ juft'
                          : ''

                        return (
                          <div key={`${node.id}-${i}`} style={{ display: 'flex', alignItems: 'center' }}>
                            {/* Connector arrow (except before first node) */}
                            {i > 0 && (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
                                gap: 3, margin: '0 4px', flexShrink: 0 }}>
                                <div style={{
                                  fontSize: 9, fontWeight: 700, color: dirColor,
                                  background: `${dirColor}15`, padding: '2px 7px', borderRadius: 8,
                                  border: `1px solid ${dirColor}30`, whiteSpace: 'nowrap',
                                }}>
                                  {dirLabel}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                                  <div style={{ width: 20, height: 2, background: dirColor, opacity: 0.5 }} />
                                  <div style={{
                                    width: 0, height: 0,
                                    borderTop: '5px solid transparent',
                                    borderBottom: '5px solid transparent',
                                    borderLeft: `7px solid ${dirColor}`,
                                  }} />
                                </div>
                              </div>
                            )}

                            {/* Person card */}
                            <div
                              onClick={() => navigate(`/persons/${p.id}`)}
                              style={{
                                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                                padding: '10px 12px', borderRadius: 16,
                                background: cardBg,
                                border: `2px solid ${isFirst || isLast || isLCA ? accent : cardBorder}`,
                                cursor: 'pointer', transition: 'all 0.15s',
                                minWidth: 76, maxWidth: 90,
                                boxShadow: isFirst || isLast || isLCA
                                  ? `0 4px 14px ${accent}30`
                                  : '0 1px 4px rgba(0,0,0,0.05)',
                                position: 'relative',
                              }}
                              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = `0 6px 20px ${accent}40` }}
                              onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = isFirst || isLast || isLCA ? `0 4px 14px ${accent}30` : '0 1px 4px rgba(0,0,0,0.05)' }}
                            >
                              {/* LCA Crown badge */}
                              {isLCA && (
                                <div style={{
                                  position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
                                  fontSize: 16, filter: 'drop-shadow(0 2px 4px rgba(245,158,11,0.5))',
                                }}>👑</div>
                              )}

                              {/* Photo */}
                              <div style={{
                                width: isFirst || isLast ? 52 : 42,
                                height: isFirst || isLast ? 52 : 42,
                                borderRadius: isFirst || isLast ? 16 : 13,
                                overflow: 'hidden',
                                border: `2.5px solid ${accent}`,
                                background: dead ? (isDark ? '#374151' : '#f3f4f6') : male ? '#ede9fe' : '#fce7f3',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: isFirst || isLast ? 24 : 18,
                                flexShrink: 0,
                                boxShadow: isFirst || isLast ? `0 3px 10px ${accent}40` : 'none',
                              }}>
                                {p.photo_url || p.photo
                                  ? <img src={p.photo_url || p.photo} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                                  : <span>{male ? '👨' : '👩'}</span>}
                              </div>

                              {/* Name */}
                              <div style={{
                                fontSize: isFirst || isLast ? 11 : 10,
                                fontWeight: 700,
                                color: isDark ? '#f1f5f9' : '#1e293b',
                                textAlign: 'center', lineHeight: 1.25,
                                maxWidth: 80, wordBreak: 'break-word',
                              }}>
                                {p.full_name?.split(' ').slice(0, 2).join(' ')}
                              </div>

                              {/* Year */}
                              {p.birth_date && (
                                <div style={{ fontSize: 9, color: isDark ? '#64748b' : '#94a3b8' }}>
                                  {new Date(p.birth_date + 'T00:00:00').getFullYear()}
                                  {dead ? `–${new Date(p.death_date + 'T00:00:00').getFullYear()}` : ''}
                                </div>
                              )}

                              {/* A / B badge */}
                              {(isFirst || isLast) && (
                                <div style={{
                                  fontSize: 9, fontWeight: 900, color: 'white',
                                  background: accent, padding: '2px 8px', borderRadius: 8,
                                  boxShadow: `0 2px 6px ${accent}40`,
                                }}>
                                  {isFirst ? 'A' : 'B'}
                                </div>
                              )}

                              {/* LCA label */}
                              {isLCA && (
                                <div style={{
                                  fontSize: 9, fontWeight: 900, color: '#92400e',
                                  background: '#fef3c7', padding: '2px 7px', borderRadius: 8,
                                  border: '1px solid #fde68a',
                                }}>
                                  Umumiy ajdod
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                  <div style={{ marginTop: 12, fontSize: 11, color: isDark ? '#475569' : '#94a3b8' }}>
                    💡 Kartani bosing — shaxs profiliga o'tish
                  </div>
                </div>
                )
              })()}
            </div>

          </div>{/* end rel-result-left */}

          <div className="rel-result-right">
            {/* ── 15. AI tushuntirish ── */}
            <div style={{
              borderRadius: 20, overflow: 'hidden',
              border: `1.5px solid ${aiText ? '#6366f130' : (isDark ? '#334155' : '#e2e8f0')}`,
              boxShadow: aiText ? '0 4px 20px rgba(99,102,241,0.10)' : 'none',
              background: isDark ? '#1e293b' : 'white',
            }}>
              {/* Header row */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 20px',
                background: aiText
                  ? `linear-gradient(135deg,#6366f108,#7c3aed05)`
                  : 'transparent',
                borderBottom: aiText ? `1px solid #6366f115` : 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 11, flexShrink: 0,
                    background: 'linear-gradient(135deg,#6366f1,#7c3aed)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18, boxShadow: '0 3px 10px rgba(99,102,241,0.35)',
                  }}>🤖</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: isDark ? '#f1f5f9' : '#0f172a' }}>
                      AI tushuntirish
                    </div>
                    <div style={{ fontSize: 11, color: isDark ? '#64748b' : '#94a3b8' }}>
                      {aiSource
                        ? (aiSource === 'template'
                            ? '📝 Shablon javob (AI kalit yo\'q)'
                            : aiSource.startsWith('groq')
                              ? `⚡ Groq · ${aiSource.split('/')[1] || ''}`
                              : `✨ Gemini · ${aiSource}`)
                        : 'Gemini · Tabiiy til · Bepul'}
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleAiExplain}
                  disabled={aiLoading}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '8px 18px', borderRadius: 12, border: 'none', cursor: aiLoading ? 'default' : 'pointer',
                    background: aiLoading
                      ? (isDark ? '#334155' : '#f1f5f9')
                      : 'linear-gradient(135deg,#6366f1,#7c3aed)',
                    color: aiLoading ? (isDark ? '#64748b' : '#94a3b8') : 'white',
                    fontSize: 13, fontWeight: 700,
                    boxShadow: aiLoading ? 'none' : '0 4px 14px rgba(99,102,241,0.35)',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => { if (!aiLoading) e.currentTarget.style.opacity = '0.88' }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
                >
                  {aiLoading ? (
                    <>
                      <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⚙️</span>
                      Tahlil qilinmoqda...
                    </>
                  ) : aiText ? (
                    <>🔄 Qayta tushuntir</>
                  ) : (
                    <>✨ AI orqali tushuntir</>
                  )}
                </button>
              </div>

              {/* AI text */}
              {aiDisplayed && (
                <div style={{ padding: '16px 20px' }}>
                  <div style={{
                    fontSize: 14, lineHeight: 1.7,
                    color: isDark ? '#cbd5e1' : '#374151',
                    background: isDark ? '#0f172a' : '#f8fafc',
                    borderRadius: 14, padding: '14px 18px',
                    border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                    position: 'relative',
                  }}>
                    {/* Cursor blink when typing */}
                    {aiDisplayed.length < aiText.length && (
                      <span style={{ display: 'inline-block', width: 2, height: '1em',
                        background: '#6366f1', marginLeft: 2, verticalAlign: 'text-bottom',
                        animation: 'pulse 0.8s ease-in-out infinite' }} />
                    )}
                    {aiDisplayed}
                  </div>
                </div>
              )}

              {/* Empty state hint */}
              {!aiText && !aiLoading && (
                <div style={{ padding: '12px 20px 16px', textAlign: 'center',
                  fontSize: 12, color: isDark ? '#475569' : '#94a3b8' }}>
                  Yuqoridagi "✨ AI orqali tushuntir" tugmasini bosib, qarindoshlik munosabatini tabiiy tilda tushuntirishni oling
                </div>
              )}
            </div>

            {/* Relationship table */}
            <div style={{ background: isDark ? '#1e293b' : 'white', borderRadius: 20, padding: '20px 24px',
              boxShadow: '0 2px 16px rgba(0,0,0,0.07)', border: isDark ? '1px solid #334155' : '1px solid #f1f5f9' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: isDark ? '#94a3b8' : '#374151', marginBottom: 16,
                textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                📊 Qarindoshlik darajasi
              </div>
              <div className="rel-degree-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
                {[
                  { key: 'Birinchi daraja', desc: 'Ota-ona, farzand', active: result.lca?.total === 1 || (result.lca?.depthA === 0 && result.lca?.depthB === 1) || (result.lca?.depthA === 1 && result.lca?.depthB === 0) },
                  { key: 'Ikkinchi daraja', desc: 'Aka-uka, opa-singil, bobo, buvi', active: result.lca?.total === 2 },
                  { key: 'Uchinchi daraja', desc: 'Amaki, tog\'a, amma, xola, jiyan', active: result.lca?.total === 3 },
                  { key: 'To\'rtinchi daraja', desc: 'Amakivachcha, tog\'avachcha', active: result.lca?.total === 4 },
                  { key: 'Beshinchi daraja', desc: '2-darajali amakivachcha', active: result.lca?.total === 5 },
                  { key: 'Uzoq qarindosh', desc: '6+ qadam uzoqda', active: (result.lca?.total || 0) >= 6 },
                ].map(({ key, desc, active }) => (
                  <div key={key} style={{
                    padding: '10px 12px', borderRadius: 12,
                    background: active ? `${gradeColor}12` : (isDark ? '#0f172a' : '#f8fafc'),
                    border: `1.5px solid ${active ? gradeColor : (isDark ? '#334155' : '#e2e8f0')}`,
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: active ? gradeColor : (isDark ? '#64748b' : '#64748b') }}>{key}</div>
                    <div style={{ fontSize: 10, color: isDark ? '#475569' : '#94a3b8', marginTop: 2, lineHeight: 1.3 }}>{desc}</div>
                    {active && <div style={{ marginTop: 4, fontSize: 10, color: gradeColor }}>✓ Hozirgi holat</div>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        )}

        {/* Error state */}
        {result?.error && (
          <div style={{ background: isDark ? '#1e293b' : 'white', borderRadius: 20, padding: '40px', textAlign: 'center',
            boxShadow: '0 2px 16px rgba(0,0,0,0.07)', border: '1px solid #fee2e2' }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>🔍</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#ef4444', marginBottom: 8 }}>
              Munosabat topilmadi
            </div>
            <div style={{ fontSize: 13, color: '#94a3b8', maxWidth: 400, margin: '0 auto' }}>
              {result.error}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!idA && !idB && !result && (
          <div className="rel-empty-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
            {/* How it works */}
            <div style={{ background: isDark ? '#1e293b' : 'white', borderRadius: 20, padding: '24px',
              boxShadow: '0 2px 16px rgba(0,0,0,0.07)', border: isDark ? '1px solid #334155' : '1px solid #f1f5f9' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: isDark ? '#94a3b8' : '#374151', marginBottom: 16,
                textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                💡 Qanday ishlaydi?
              </div>
              {[
                { step: '1', text: 'Yuqoridan birinchi shaxsni (A) tanlang', icon: '👤' },
                { step: '2', text: 'Ikkinchi shaxsni (B) tanlang', icon: '👤' },
                { step: '3', text: 'Natija avtomatik hisoblanadi', icon: '⚡' },
                { step: '4', text: 'Oila zanjiridagi yo\'lni ko\'ring', icon: '🔗' },
              ].map(({ step, text, icon }) => (
                <div key={step} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 12 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 10, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                    color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 900, flexShrink: 0 }}>
                    {step}
                  </div>
                  <div style={{ paddingTop: 4 }}>
                    <span style={{ fontSize: 15, marginRight: 6 }}>{icon}</span>
                    <span style={{ fontSize: 13, color: isDark ? '#cbd5e1' : '#374151' }}>{text}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Relationship reference */}
            <div style={{ background: isDark ? '#1e293b' : 'white', borderRadius: 20, padding: '24px',
              boxShadow: '0 2px 16px rgba(0,0,0,0.07)', border: isDark ? '1px solid #334155' : '1px solid #f1f5f9' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: isDark ? '#94a3b8' : '#374151', marginBottom: 16,
                textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                📖 Munosabatlar lug'ati
              </div>
              {[
                { uz: "Otasi / Onasi", emoji: '👨👩', desc: '1-avlod, to\'g\'ridan-to\'g\'ri' },
                { uz: "Bobosi / Buvisi", emoji: '👴👵', desc: '2-avlod yuqori' },
                { uz: "O'g'li / Qizi",  emoji: '👦👧', desc: 'To\'g\'ridan-to\'g\'ri farzand' },
                { uz: "Aka-uka / Opa-singil", emoji: '👨‍👩‍👦', desc: 'Bir avlod, bir ajdod' },
                { uz: "Amaki / Tog'a / Amma / Xola", emoji: '👨👩', desc: 'Ota yoki onaning aka/singil' },
                { uz: "Jiyan", emoji: '👦👧', desc: 'Aka-uka/opa-singlining farzandi' },
                { uz: "Amakivachcha", emoji: '🤝', desc: '1-darajali amakivachcha' },
              ].map(({ uz, emoji, desc }) => (
                <div key={uz} style={{ display: 'flex', alignItems: 'center', gap: 10,
                  padding: '6px 0', borderBottom: isDark ? '1px solid #1e293b' : '1px solid #f8fafc' }}>
                  <span style={{ fontSize: 14 }}>{emoji}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: isDark ? '#cbd5e1' : '#374151' }}>{uz}</div>
                    <div style={{ fontSize: 11, color: isDark ? '#475569' : '#94a3b8' }}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* History */}
        {history.length > 0 && (
          <div style={{ background: isDark ? '#1e293b' : 'white', borderRadius: 20, padding: '20px 24px',
            boxShadow: '0 2px 16px rgba(0,0,0,0.07)', border: isDark ? '1px solid #334155' : '1px solid #f1f5f9', marginTop: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: isDark ? '#94a3b8' : '#64748b',
              textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
              🕐 So'nggi hisob-kitoblar
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {history.map(h => (
                <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 12,
                  padding: '8px 12px', borderRadius: 12,
                  background: isDark ? '#0f172a' : '#f8fafc',
                  border: isDark ? '1px solid #334155' : '1px solid #f1f5f9' }}>
                  <span style={{ fontSize: 18 }}>{h.rel.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: isDark ? '#f1f5f9' : '#374151' }}>
                      {h.nameA} → {h.nameB}
                    </div>
                    <div style={{ fontSize: 11, color: h.rel.color, fontWeight: 600 }}>{h.rel.label}</div>
                  </div>
                  <div style={{ fontSize: 10, color: '#94a3b8' }}>
                    {h.ts.toLocaleTimeString('uz', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

    </div>
  )
}
