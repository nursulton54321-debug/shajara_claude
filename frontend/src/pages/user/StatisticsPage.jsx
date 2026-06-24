import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getPersons, exportBackup } from '../../api/persons'
import toast from 'react-hot-toast'
import useThemeStore from '../../store/themeStore'
import { fmtDate } from '../../utils/date'
import AnimCount from '../../components/AnimCount'
import { SkeletonBlock } from '../../components/Skeleton'
import logger from '../../utils/logger'
import ErrorCard from '../../components/ErrorCard'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, PieChart, Pie, Legend, LabelList, CartesianGrid,
} from 'recharts'

const MONTH_NAMES = ['Yanvar','Fevral','Mart','Aprel','May','Iyun','Iyul','Avgust','Sentabr','Oktabr','Noyabr','Dekabr']
const MONTH_SHORT = ['Yan','Fev','Mar','Apr','May','Iyn','Iyl','Avg','Sen','Okt','Noy','Dek']

const renderPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, value, percent }) => {
  if (!value || percent < 0.05) return null
  const R = Math.PI / 180
  const r = innerRadius + (outerRadius - innerRadius) * 0.55
  const x = cx + r * Math.cos(-midAngle * R)
  const y = cy + r * Math.sin(-midAngle * R)
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={900}
      style={{ textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>
      {value} ({Math.round(percent * 100)}%)
    </text>
  )
}

// Legend ni custom render qilamiz — rang aniq ko'rinsin
function CustomLegend({ payload, textColor }) {
  if (!payload?.length) return null
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 6, flexWrap: 'wrap' }}>
      {payload.map((entry, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: entry.color, flexShrink: 0 }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: textColor }}>{entry.value}</span>
        </div>
      ))}
    </div>
  )
}
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

// ── Helpers ──────────────────────────────────────────────────────
const calcAge = (birth, death) => {
  if (!birth) return null
  const e = death ? new Date(death + 'T00:00:00') : new Date()
  return Math.floor((e - new Date(birth + 'T00:00:00')) / (365.25 * 86400000))
}

// O'zbek viloyatlari + tumanlar koordinatalari
const PLACE_COORDS = [
  { keys: ['toshkent shahr', 'toshkent sh', 'chilonzor', 'yakkasaroy', 'shayxontohur', 'yunusobod', 'mirobod', 'mirzo ulug', 'olmaz', 'bektemir', 'uchtepa', 'sergeli'],
    coords: [41.2995, 69.2401], label: 'Toshkent shahri' },
  { keys: ['toshkent viloyat', 'toshkent v', 'chirchiq', 'angren', 'olmaliq', 'nurafshon', 'bo\'stonliq', 'bostanliq', 'ohangaron', 'yangiyo\'l', 'yangiyo`l'],
    coords: [41.1123, 69.8597], label: 'Toshkent viloyati' },
  { keys: ['toshkent'],                        coords: [41.2995, 69.2401], label: 'Toshkent' },
  { keys: ['andijon', 'asaka', 'xo\'jaobod', 'xojaobod', 'marhamat', 'ulug\'nor', 'jalaquduq', 'shahrixon', 'bo\'z', 'izboskan', 'buloqboshi', 'qo\'rg\'ontepa'],
    coords: [40.7821, 72.3442], label: 'Andijon' },
  { keys: ["farg'ona", 'fargona', 'fergana', 'marg\'ilon', 'margilon', 'qo\'qon', 'quva', 'rishton', 'bag\'dod', 'dang\'ara', 'yozyovon', 'oltiariq', 'furqat'],
    coords: [40.3864, 71.7864], label: "Farg'ona" },
  { keys: ['namangan', 'chust', 'pop', 'uychi', 'kosonsoy', 'to\'raqo\'rg\'on', 'norin', 'mingbuloq', 'yangiqo\'rg\'on', 'ulug\'nor'],
    coords: [41.0011, 71.6726], label: 'Namangan' },
  { keys: ['samarqand', 'urgut', 'kattaqo\'rg\'on', 'bulung\'ur', 'paxtachi', 'jomboy', 'narpay', 'ishtixon', 'pastdarg\'om', 'oqdaryo', 'toyloq', 'nurobod'],
    coords: [39.6542, 66.9597], label: 'Samarqand' },
  { keys: ['buxoro', 'bukhara', 'g\'ijduvon', 'kogon', 'qorovulbozor', 'romitan', 'shofirkon', 'vobkent', 'jondor', 'olot', 'peshku'],
    coords: [39.7747, 64.4286], label: 'Buxoro' },
  { keys: ['qashqadaryo', 'kashkadarya', 'qarshi', 'shahrisabz', 'kitob', 'g\'uzor', 'koson', 'muborak', 'kamashi', 'chiroqchi', 'yakkabog\'', 'dehqonobod'],
    coords: [38.8610, 65.7880], label: 'Qashqadaryo' },
  { keys: ['surxondaryo', 'surkhandarya', 'termiz', 'denov', 'sho\'rchi', 'uzun', 'sherobod', 'jarqo\'rg\'on', 'qumqo\'rg\'on', 'baysun', 'boysun'],
    coords: [37.9400, 67.5680], label: 'Surxondaryo' },
  { keys: ['navoiy', 'navoi', 'zarafshon', 'uchquduq', 'karmana', 'konimex', 'nurota', 'tomdi', 'xatirchi'],
    coords: [40.0841, 65.3792], label: 'Navoiy' },
  { keys: ['xorazm', 'khorezm', 'urganch', 'urgench', 'xiva', 'khiva', 'tuproqqal\'a', 'gurlan', 'bog\'ot', 'shovot', 'yangibozor', 'qo\'shko\'pir'],
    coords: [41.5522, 60.6247], label: 'Xorazm' },
  { keys: ["qoraqalpog'iston", 'karakalpak', 'nukus', 'qo\'ng\'irot', 'moynoq', 'xo\'jayli', 'to\'rtko\'l', 'beruniy', 'qanlikol'],
    coords: [43.7304, 59.6166], label: "Qoraqalpog'iston" },
  { keys: ['jizzax', 'do\'stlik', 'dustlik', 'g\'allaorol', 'zomin', 'paxtakor', 'arnasoy', 'forish', 'sharof rashidov', 'yangiobod'],
    coords: [40.1158, 67.8422], label: 'Jizzax' },
  { keys: ['sirdaryo', 'syrdarya', 'guliston', 'yangiyer', 'shirin', 'xovos', 'boyovut', 'sardoba', 'mirzaobod', 'oqoltin'],
    coords: [40.8484, 68.6614], label: 'Sirdaryo' },
]

function getCoords(place) {
  if (!place) return null
  const lower = place.toLowerCase().trim()
  for (const entry of PLACE_COORDS) {
    if (entry.keys.some(k => lower.includes(k))) return entry.coords
  }
  return null
}

function getPlaceLabel(place) {
  if (!place) return place
  const lower = place.toLowerCase().trim()
  for (const entry of PLACE_COORDS) {
    if (entry.keys.some(k => lower.includes(k))) return entry.label
  }
  return place
}

// Avlodlarni hisoblash — "katta gen ustun" BFS
// Qoida: biror shaxsga yuqoriroq gen tayinlansa, u QAYTA ishlanadi va
//   → farzandlari ham yangilanadi (gen+1)
//   → turmush o'rtog'i ham yangilanadi (xuddi shu gen)
// Shu tufayli Nargizabonu kabi tashqaridan kelganlar dastlab gen=1 olsa ham,
// keyinchalik juft (Elyor gen=3) uni gen=3 ga ko'taradi va
// ularning farzandlari ham gen=4 bo'ladi.
function computeGenerations(persons) {
  const pm = {}
  persons.forEach(p => { pm[p.id] = p })
  const genMap = {}

  // Ota → farzandlar xaritasi
  const childrenOf = {}
  persons.forEach(p => {
    ;[p.father_id, p.mother_id].filter(Boolean).forEach(pid => {
      if (!childrenOf[pid]) childrenOf[pid] = []
      childrenOf[pid].push(p.id)
    })
  })

  // Shaxs → turmush o'rtoqlari xaritasi (families orqali)
  const spousesOf = {}
  persons.forEach(p => {
    ;(p.families || []).forEach(f => {
      if (!spousesOf[p.id]) spousesOf[p.id] = []
      spousesOf[p.id].push(f.partner_id)
    })
  })

  // Queue: ota-onasi yo'q barcha shaxslar gen=1 dan boshlanadi
  const queue = persons
    .filter(p => !p.father_id && !p.mother_id)
    .map(p => ({ id: p.id, gen: 1 }))

  while (queue.length) {
    const { id, gen } = queue.shift()

    // Faqat yangi gen KATTAROQ bo'lsa yangilash (eski kichik gen o'chiriladi)
    if (genMap[id] != null && genMap[id] >= gen) continue
    genMap[id] = gen

    // Farzandlari → gen + 1
    ;(childrenOf[id] || []).forEach(childId => {
      queue.push({ id: childId, gen: gen + 1 })
    })

    // Turmush o'rtog'i → xuddi shu gen
    ;(spousesOf[id] || []).forEach(spouseId => {
      if (genMap[spouseId] == null || genMap[spouseId] < gen) {
        queue.push({ id: spouseId, gen })
      }
    })
  }

  // Hech qaysi bog'liqlikka kirmagan shaxslar → gen 1
  persons.forEach(p => { if (!genMap[p.id]) genMap[p.id] = 1 })
  return genMap
}

// ── Yosh piramidasi ma'lumotlari ─────────────────────────────────
const AGE_GROUPS = ['0–9','10–19','20–29','30–39','40–49','50–59','60–69','70–79','80+']
function buildPyramid(persons) {
  const data = AGE_GROUPS.map(g => ({ group: g, male: 0, female: 0 }))
  persons.forEach(p => {
    const age = calcAge(p.birth_date, p.death_date || null)
    if (age == null || age < 0) return
    const idx = Math.min(Math.floor(age / 10), 8)
    if (p.gender === 'male') data[idx].male++
    else data[idx].female++
  })
  return data
}

// ── Tug'ilgan kun (bu oy) ─────────────────────────────────────────
const today = new Date()
function daysUntil(str) {
  if (!str) return null
  const bd = new Date(str + 'T00:00:00')
  let next = new Date(today.getFullYear(), bd.getMonth(), bd.getDate())
  if (next < today) next = new Date(today.getFullYear() + 1, bd.getMonth(), bd.getDate())
  return Math.round((next - today) / 86400000)
}

// ── Sof Leaflet xarita komponenti (react-leaflet ishlatilmaydi) ───
function LeafletMap({ mapPersons, isDark, navigate }) {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const textSecondary = isDark ? '#94a3b8' : '#64748b'

  useEffect(() => {
    if (!mapRef.current) return

    // Eski instansni tozalash
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove()
      mapInstanceRef.current = null
    }

    const map = L.map(mapRef.current, {
      center: [41.2995, 69.2401],
      zoom: 6,
      scrollWheelZoom: false,
      zoomControl: true,
    })
    mapInstanceRef.current = map

    // Tile qatlam
    const tileUrl = isDark
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
    L.tileLayer(tileUrl, {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 18,
    }).addTo(map)

    // Markerlar
    mapPersons.forEach(loc => {
      const radius = Math.min(8 + loc.persons.length * 3, 24)
      const marker = L.circleMarker(loc.coords, {
        radius,
        fillColor: '#6366f1',
        fillOpacity: 0.85,
        color: 'white',
        weight: 2,
      }).addTo(map)

      const personLinks = loc.persons.slice(0, 5).map(p =>
        `<div style="font-size:12px;padding:3px 0;border-bottom:1px solid #f1f5f9;
          cursor:pointer;color:#4f46e5;" data-id="${p.id}">${p.full_name}</div>`
      ).join('')
      const extra = loc.persons.length > 5
        ? `<div style="font-size:11px;color:#94a3b8;margin-top:4px">+${loc.persons.length - 5} ta boshqa</div>`
        : ''

      marker.bindPopup(`
        <div style="min-width:160px;font-family:sans-serif">
          <div style="font-weight:800;margin-bottom:6px;font-size:13px">📍 ${loc.place}</div>
          <div style="font-size:11px;color:#64748b;margin-bottom:8px">${loc.persons.length} ta shaxs</div>
          ${personLinks}${extra}
        </div>
      `)

      // Popup ichidagi shaxs nomlariga klik
      marker.on('popupopen', () => {
        setTimeout(() => {
          document.querySelectorAll('[data-id]').forEach(el => {
            el.addEventListener('click', () => navigate(`/persons/${el.dataset.id}`))
          })
        }, 50)
      })
    })

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [mapPersons, isDark])

  return (
    <div>
      <div ref={mapRef} style={{
        borderRadius: 14, overflow: 'hidden', height: 420,
        border: isDark ? '1px solid #334155' : '1px solid #e2e8f0',
      }} />
      {/* Legend */}
      <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {[...mapPersons].sort((a, b) => b.persons.length - a.persons.length).map((loc, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600,
            background: isDark ? '#0f172a' : '#f1f5f9', color: textSecondary,
          }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#6366f1', flexShrink: 0 }} />
            {loc.place} ({loc.persons.length})
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Komponentlar ─────────────────────────────────────────────────

function Card({ title, icon, children, accent = '#6366f1' }) {
  const { isDark } = useThemeStore()
  return (
    <div style={{
      background: isDark ? '#1e293b' : 'white', borderRadius: 20, overflow: 'hidden',
      boxShadow: '0 2px 20px rgba(0,0,0,0.08)',
      border: isDark ? '1px solid #334155' : '1px solid #f1f5f9',
    }}>
      <div style={{
        padding: '14px 18px 10px', display: 'flex', alignItems: 'center', gap: 8,
        borderBottom: isDark ? '1px solid #334155' : '1px solid #f1f5f9',
      }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <span style={{ fontSize: 13, fontWeight: 800, color: accent,
          textTransform: 'uppercase', letterSpacing: '0.06em' }}>{title}</span>
      </div>
      <div style={{ padding: '16px 18px' }}>{children}</div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════
export default function StatisticsPage() {
  const [persons, setPersons] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadErr, setLoadErr] = useState(null)
  const [activeTab, setActiveTab] = useState('generations')
  const [pdfLoading, setPdfLoading] = useState(false)
  const [zipLoading, setZipLoading] = useState(false)
  const navigate = useNavigate()
  const { isDark } = useThemeStore()

  const loadData = useCallback(async () => {
    setLoading(true)
    setLoadErr(null)
    try {
      const r = await getPersons({ page_size: 10000 })
      const data = Array.isArray(r.data) ? r.data : (r.data?.results || [])
      setPersons(data)
    } catch {
      setLoadErr("Statistika ma'lumotlarini yuklashda xato yuz berdi")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // ── 2.1 Avlodlar statistikasi ──
  const genStats = useMemo(() => {
    if (!persons.length) return []
    const genMap = computeGenerations(persons)
    const stats = {}
    persons.forEach(p => {
      const g = genMap[p.id] || 1
      if (!stats[g]) stats[g] = { gen: g, total: 0, male: 0, female: 0, ages: [] }
      stats[g].total++
      if (p.gender === 'male') stats[g].male++
      else stats[g].female++
      const age = calcAge(p.birth_date, null)
      if (age != null && age >= 0) stats[g].ages.push(age)
    })
    // Har bir avlodga tegishli shaxslar ro'yxatini ham saqlash (PDF uchun)
    const personsByGen = {}
    persons.forEach(p => {
      const g = genMap[p.id] || 1
      if (!personsByGen[g]) personsByGen[g] = []
      personsByGen[g].push(p)
    })
    return Object.values(stats)
      .sort((a, b) => a.gen - b.gen)
      .map(s => ({
        ...s,
        avgAge: s.ages.length ? Math.round(s.ages.reduce((a, b) => a + b, 0) / s.ages.length) : null,
        name: `${s.gen}-avlod`,
        _persons: (personsByGen[s.gen] || []).sort((a, b) => (a.child_number || 99) - (b.child_number || 99)),
      }))
  }, [persons])

  // ── 2.3 Yosh piramidasi ──
  const pyramid = useMemo(() => buildPyramid(persons), [persons])
  const maxPyramid = useMemo(() => Math.max(...pyramid.map(d => Math.max(d.male, d.female)), 1), [pyramid])

  // ── 2.2 Xarita ma'lumotlari ──
  const mapPersons = useMemo(() => {
    const grouped = {}
    persons.forEach(p => {
      if (!p.birth_place) return
      const coords = getCoords(p.birth_place)
      if (!coords) return
      const key = coords.join(',')
      if (!grouped[key]) grouped[key] = { coords, persons: [], place: getPlaceLabel(p.birth_place) }
      grouped[key].persons.push(p)
    })
    return Object.values(grouped)
  }, [persons])

  // ── 2.5 Oylar bo'yicha tug'ilganlar ──
  const monthData = useMemo(() => {
    const counts = Array(12).fill(0)
    persons.forEach(p => {
      if (p.birth_date) {
        const m = new Date(p.birth_date + 'T00:00:00').getMonth()
        counts[m]++
      }
    })
    return MONTH_SHORT.map((name, i) => ({ name, count: counts[i], fullName: MONTH_NAMES[i] }))
  }, [persons])

  const curMonth = today.getMonth()

  // ── 2.6 Jins + Hayot holati ──
  const totalM   = persons.filter(p => p.gender === 'male').length
  const totalF   = persons.filter(p => p.gender === 'female').length
  const totalAl  = persons.filter(p => !p.death_date).length
  const totalDe  = persons.filter(p => p.death_date).length
  const total    = persons.length

  const pieGender = [
    { name: `Erkaklar — ${totalM} ta`, value: totalM },
    { name: `Ayollar — ${totalF} ta`,  value: totalF },
  ]
  const pieLife = [
    { name: `Tirik — ${totalAl} ta`,       value: totalAl },
    { name: `Vafot etgan — ${totalDe} ta`, value: totalDe },
  ]

  // ── 2.4 Bu oy tug'ilganlar ──
  const birthdayPersons = useMemo(() => {
    return persons
      .filter(p => {
        if (!p.birth_date) return false
        const bd = new Date(p.birth_date + 'T00:00:00')
        return bd.getMonth() === today.getMonth()
      })
      .map(p => ({ ...p, daysUntil: daysUntil(p.birth_date) }))
      .sort((a, b) => (a.daysUntil ?? 999) - (b.daysUntil ?? 999))
  }, [persons])

  const handleExportPDF = async () => {
    setPdfLoading(true)
    const tid = toast.loading('📄 PDF tayyorlanmoqda...')
    try {
      const totalStats = {
        total:    persons.length,
        male:     persons.filter(p => p.gender === 'male').length,
        female:   persons.filter(p => p.gender === 'female').length,
        alive:    persons.filter(p => !p.death_date).length,
        deceased: persons.filter(p => p.death_date).length,
      }
      // Lazy import — faqat bosiganda yuklanadi
      const { exportFamilyPDF } = await import('../../utils/exportPDF.js')
      await exportFamilyPDF({ persons, genStats, stats: totalStats })
      toast.success('✅ PDF yuklandi!', { id: tid })
    } catch (e) {
      logger.error('PDF export xatosi:', e)
      toast.error('❌ PDF xatosi: ' + (e?.message || e), { id: tid })
    } finally {
      setPdfLoading(false)
    }
  }

  const handleExportBackup = async () => {
    setZipLoading(true)
    const tid = toast.loading('📦 Backup tayyorlanmoqda...')
    try {
      const res = await exportBackup()
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/zip' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `shajara-backup-${new Date().toISOString().slice(0, 10)}.zip`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('✅ Backup ZIP yuklandi!', { id: tid })
    } catch {
      toast.error('❌ ZIP xatosi', { id: tid })
    } finally {
      setZipLoading(false)
    }
  }

  const textPrimary   = isDark ? '#f1f5f9' : '#0f172a'
  const textSecondary = isDark ? '#94a3b8' : '#64748b'
  const cardBg        = isDark ? '#1e293b' : 'white'
  const borderColor   = isDark ? '#334155' : '#f1f5f9'

  const tabs = [
    { id: 'generations', label: 'Avlodlar', icon: '🌳' },
    { id: 'pyramid',     label: 'Yosh piramidasi', icon: '📊' },
    { id: 'map',         label: 'Xarita', icon: '🗺️' },
    { id: 'birthdays',   label: "Tug'ilgan kunlar", icon: '🎂' },
  ]

  if (loadErr) return (
    <div style={{ padding: 24 }}>
      <ErrorCard message={loadErr} onRetry={loadData} />
    </div>
  )

  if (loading) return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header skeleton */}
      <SkeletonBlock height={90} radius={16} />
      {/* Tabs skeleton */}
      <div style={{ display: 'flex', gap: 8 }}>
        {[120, 140, 90, 150].map((w, i) => <SkeletonBlock key={i} width={w} height={36} radius={12} />)}
      </div>
      {/* Content skeletons */}
      <SkeletonBlock height={260} radius={16} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <SkeletonBlock height={200} radius={16} />
        <SkeletonBlock height={200} radius={16} />
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100%', background: isDark ? '#0f172a' : '#f1f5f9', paddingBottom: 80 }}>
      <style>{`
        @media (max-width: 640px) {
          .stat-hero { padding: 16px 14px 14px !important; }
          .stat-hero-sub { font-size: 10px !important; }
          .stat-hero-title { font-size: 20px !important; }
          .stat-hero-meta { font-size: 10px !important; }
          .stat-hero-chips { grid-template-columns: repeat(4, 1fr) !important; gap: 6px !important; }
          .stat-hero-chip { padding: 8px 4px !important; border-radius: 12px !important; }
          .stat-hero-chip-num { font-size: 18px !important; }
          .stat-hero-chip-lbl { font-size: 8px !important; }
          .stat-hero-chip-icon { font-size: 14px !important; }
          .stat-export-row { gap: 6px !important; }
          .stat-export-row button { font-size: 11px !important; padding: 7px 8px !important; }
          .stat-tabs-wrap { padding: 10px 10px 0 !important; }
          .stat-tabs-inner { gap: 6px !important; }
          .stat-tab { flex: 1 !important; padding: 10px 6px !important; flex-direction: column !important; gap: 3px !important; }
          .stat-tab-lbl { font-size: 8px !important; }
          .stat-tab-ico { font-size: 20px !important; }
          .stat-body { padding: 12px 10px !important; gap: 12px !important; }
          .stat-pie-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* ══════ HERO HEADER ══════ */}
      <div className="stat-hero" style={{
        background: 'linear-gradient(135deg,#4338ca 0%,#6d28d9 50%,#7c3aed 100%)',
        padding: '24px 24px 20px', position: 'relative', overflow: 'hidden',
      }}>
        {/* Decorative blobs */}
        <div style={{ position:'absolute', top:-60, right:-60, width:200, height:200, borderRadius:'50%',
          background:'rgba(255,255,255,0.06)', pointerEvents:'none' }} />
        <div style={{ position:'absolute', bottom:-40, left:-20, width:140, height:140, borderRadius:'50%',
          background:'rgba(255,255,255,0.04)', pointerEvents:'none' }} />

        {/* Title */}
        <div style={{ color:'white', marginBottom:16, position:'relative' }}>
          <div className="stat-hero-sub" style={{ fontSize:11, opacity:0.65, letterSpacing:'0.08em',
            textTransform:'uppercase', marginBottom:4 }}>Tahlil va vizualizatsiya</div>
          <div className="stat-hero-title" style={{ fontSize:26, fontWeight:900, letterSpacing:'-0.5px',
            display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:28 }}>📊</span> Statistika
          </div>
          <div className="stat-hero-meta" style={{ fontSize:12, opacity:0.7, marginTop:4 }}>
            <AnimCount to={persons.length} /> ta shaxs · {genStats.length} ta avlod · {new Date().getFullYear()}-yil
          </div>
        </div>

        {/* Stat chips — 4 column grid */}
        <div className="stat-hero-chips" style={{
          display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, marginBottom:12,
        }}>
          {[
            { label:'Erkaklar', value: persons.filter(p=>p.gender==='male').length,   icon:'👨', bg:'rgba(129,140,248,0.25)', clr:'#c7d2fe', brd:'rgba(129,140,248,0.4)' },
            { label:'Ayollar',  value: persons.filter(p=>p.gender==='female').length,  icon:'👩', bg:'rgba(249,168,212,0.25)', clr:'#fbcfe8', brd:'rgba(249,168,212,0.4)' },
            { label:'Tirik',    value: persons.filter(p=>!p.death_date).length,        icon:'💚', bg:'rgba(110,231,183,0.25)', clr:'#a7f3d0', brd:'rgba(110,231,183,0.4)' },
            { label:'Vafot',    value: persons.filter(p=>p.death_date).length,         icon:'🕯️', bg:'rgba(209,213,219,0.2)',  clr:'#e5e7eb', brd:'rgba(209,213,219,0.35)' },
          ].map(({ label, value, icon, bg, clr, brd }) => (
            <div key={label} className="stat-hero-chip" style={{
              background: bg, border:`1px solid ${brd}`, borderRadius:14,
              padding:'10px 8px', backdropFilter:'blur(8px)',
              display:'flex', flexDirection:'column', alignItems:'center', gap:3,
            }}>
              <span className="stat-hero-chip-icon" style={{ fontSize:18 }}>{icon}</span>
              <span className="stat-hero-chip-num" style={{ fontSize:22, fontWeight:900, color:clr, lineHeight:1 }}>
                <AnimCount to={value} />
              </span>
              <span className="stat-hero-chip-lbl" style={{ fontSize:9, color:'rgba(255,255,255,0.65)',
                fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em' }}>{label}</span>
            </div>
          ))}
        </div>

        {/* Export buttons */}
        <div className="stat-export-row" style={{ display:'flex', gap:8 }}>
          <button onClick={handleExportPDF} disabled={pdfLoading} style={{
            flex:1, padding:'9px 12px', borderRadius:12, border:'1.5px solid rgba(255,255,255,0.25)',
            cursor:'pointer', background:'rgba(255,255,255,0.12)', color:'white',
            fontSize:12, fontWeight:700, backdropFilter:'blur(4px)',
            display:'flex', alignItems:'center', justifyContent:'center', gap:5,
            opacity: pdfLoading ? 0.6 : 1, transition:'all 0.15s',
          }}>
            {pdfLoading ? '⏳' : '📄'} PDF yuklab olish
          </button>
          <button onClick={handleExportBackup} disabled={zipLoading} style={{
            flex:1, padding:'9px 12px', borderRadius:12, border:'1.5px solid rgba(255,255,255,0.25)',
            cursor:'pointer', background:'rgba(255,255,255,0.12)', color:'white',
            fontSize:12, fontWeight:700, backdropFilter:'blur(4px)',
            display:'flex', alignItems:'center', justifyContent:'center', gap:5,
            opacity: zipLoading ? 0.6 : 1, transition:'all 0.15s',
          }}>
            {zipLoading ? '⏳' : '📦'} Backup ZIP
          </button>
        </div>
      </div>

      {/* ══════ TABS ══════ */}
      <div className="stat-tabs-wrap" style={{
        padding:'14px 20px 0',
        background: isDark ? '#0f172a' : '#f1f5f9',
      }}>
        <div className="stat-tabs-inner" style={{
          display:'flex', gap:8, overflowX:'auto',
          background: isDark ? '#1e293b' : 'white',
          borderRadius:16, padding:6,
          boxShadow: isDark ? '0 2px 12px rgba(0,0,0,0.3)' : '0 2px 12px rgba(0,0,0,0.06)',
          border: isDark ? '1px solid #334155' : '1px solid #f1f5f9',
        }}>
          {tabs.map(t => {
            const active = activeTab === t.id
            return (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className="stat-tab"
                style={{
                  flex: '1 0 auto', padding:'10px 16px', borderRadius:12,
                  border:'none', cursor:'pointer',
                  display:'flex', alignItems:'center', justifyContent:'center', gap:6,
                  transition:'all 0.18s',
                  background: active
                    ? 'linear-gradient(135deg,#4f46e5,#7c3aed)'
                    : 'transparent',
                  color: active ? 'white' : textSecondary,
                  boxShadow: active ? '0 4px 14px rgba(79,70,229,0.4)' : 'none',
                  transform: active ? 'scale(1.02)' : 'scale(1)',
                }}>
                <span className="stat-tab-ico" style={{ fontSize:17, lineHeight:1 }}>{t.icon}</span>
                <span className="stat-tab-lbl" style={{ fontSize:11, fontWeight:800, whiteSpace:'nowrap' }}>{t.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="stat-body" style={{ padding:'18px 20px', display:'flex', flexDirection:'column', gap:18 }}>

        {/* ═══════════════════ 2.1 AVLODLAR STATISTIKASI ═══════════════════ */}
        {activeTab === 'generations' && (
          <>
            {/* ── Oylar bo'yicha tug'ilganlar ── */}
            <Card title="Oylar bo'yicha tug'ilganlar" icon="📅" accent="#f59e0b">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: textSecondary }}>
                  Har bir oyda nechta oila a'zosi tug'ilganligi
                </div>
                <div style={{ fontSize: 11, color: textSecondary, background: isDark ? '#0f172a' : '#f8fafc',
                  padding: '3px 10px', borderRadius: 20, border: `1px solid ${borderColor}` }}>
                  Jami: {persons.filter(p => p.birth_date).length} ta
                </div>
              </div>
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={monthData} margin={{ top: 20, right: 8, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#f1f5f9'} vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: textSecondary }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: textSecondary }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background: cardBg, border: `1px solid ${borderColor}`, borderRadius: 12, color: textPrimary }}
                    labelFormatter={name => {
                      const idx = MONTH_SHORT.indexOf(name)
                      return idx >= 0 ? MONTH_NAMES[idx] : name
                    }}
                    formatter={v => [`${v} ta shaxs`, "Tug'ilgan"]}
                  />
                  <Bar dataKey="count" radius={[7,7,0,0]} maxBarSize={40}>
                    {monthData.map((entry, i) => (
                      <Cell key={i}
                        fill={i === curMonth
                          ? '#f59e0b'
                          : entry.count === Math.max(...monthData.map(d => d.count)) && entry.count > 0
                            ? '#6366f1'
                            : isDark ? '#334155' : '#e0e7ff'}
                      />
                    ))}
                    <LabelList dataKey="count" position="top"
                      style={{ fontSize: 11, fontWeight: 800, fill: isDark ? '#94a3b8' : '#6366f1' }}
                      formatter={v => v > 0 ? v : ''} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', gap: 16, marginTop: 6, justifyContent: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: textSecondary }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: '#f59e0b' }} /> Joriy oy
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: textSecondary }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: '#6366f1' }} /> Eng ko'p tug'ilgan oy
                </div>
              </div>
            </Card>

            {/* ── Jins nisbati + Hayot holati (yonma-yon) ── */}
            <div className="stat-pie-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {/* Jins nisbati */}
              <Card title="Jins nisbati" icon="👫" accent="#3b82f6">
                <div style={{ fontSize: 11, color: textSecondary, marginBottom: 8 }}>
                  Erkak va ayollar ulushi · Jami {total} ta
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={pieGender} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                      dataKey="value" paddingAngle={3} labelLine={false} label={renderPieLabel}>
                      <Cell fill="#3b82f6" />
                      <Cell fill="#ec4899" />
                    </Pie>
                    <Tooltip formatter={(v, n) => [`${v} ta`, n]}
                      contentStyle={{ background: cardBg, border: `1px solid ${borderColor}`, borderRadius: 10, color: textPrimary }}
                      labelStyle={{ color: textPrimary }} />
                    <Legend content={<CustomLegend textColor={textPrimary} />} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                  <div style={{ textAlign: 'center', padding: '8px', borderRadius: 10,
                    background: isDark ? '#0f172a' : '#eff6ff', border: `1px solid ${borderColor}` }}>
                    <div style={{ fontSize: 20, fontWeight: 900, color: '#3b82f6' }}><AnimCount to={totalM} /></div>
                    <div style={{ fontSize: 10, color: textSecondary }}>👨 Erkaklar ({total ? Math.round(totalM/total*100) : 0}%)</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '8px', borderRadius: 10,
                    background: isDark ? '#0f172a' : '#fdf2f8', border: `1px solid ${borderColor}` }}>
                    <div style={{ fontSize: 20, fontWeight: 900, color: '#ec4899' }}><AnimCount to={totalF} /></div>
                    <div style={{ fontSize: 10, color: textSecondary }}>👩 Ayollar ({total ? Math.round(totalF/total*100) : 0}%)</div>
                  </div>
                </div>
              </Card>

              {/* Hayot holati */}
              <Card title="Hayot holati" icon="💚" accent="#10b981">
                <div style={{ fontSize: 11, color: textSecondary, marginBottom: 8 }}>
                  Tirik va vafot etgan a'zolar · Jami {total} ta
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={pieLife} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                      dataKey="value" paddingAngle={3} labelLine={false} label={renderPieLabel}>
                      <Cell fill="#10b981" />
                      <Cell fill="#6b7280" />
                    </Pie>
                    <Tooltip formatter={(v, n) => [`${v} ta`, n]}
                      contentStyle={{ background: cardBg, border: `1px solid ${borderColor}`, borderRadius: 10, color: textPrimary }}
                      labelStyle={{ color: textPrimary }} />
                    <Legend content={<CustomLegend textColor={textPrimary} />} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                  <div style={{ textAlign: 'center', padding: '8px', borderRadius: 10,
                    background: isDark ? '#0f172a' : '#f0fdf4', border: `1px solid ${borderColor}` }}>
                    <div style={{ fontSize: 20, fontWeight: 900, color: '#10b981' }}><AnimCount to={totalAl} /></div>
                    <div style={{ fontSize: 10, color: textSecondary }}>💚 Tirik ({total ? Math.round(totalAl/total*100) : 0}%)</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '8px', borderRadius: 10,
                    background: isDark ? '#0f172a' : '#f9fafb', border: `1px solid ${borderColor}` }}>
                    <div style={{ fontSize: 20, fontWeight: 900, color: '#6b7280' }}><AnimCount to={totalDe} /></div>
                    <div style={{ fontSize: 10, color: textSecondary }}>🕯️ Vafot ({total ? Math.round(totalDe/total*100) : 0}%)</div>
                  </div>
                </div>
              </Card>
            </div>

            {/* Per-generation bar chart */}
            <Card title="Har bir avlod" icon="🌳" accent="#6366f1">
              {genStats.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 24, color: textSecondary }}>Ma'lumot yo'q</div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={genStats} barGap={6} margin={{ top: 22, right: 10, left: 0, bottom: 0 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: textSecondary }} />
                    <YAxis tick={{ fontSize: 11, fill: textSecondary }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ background: cardBg, border: `1px solid ${borderColor}`, borderRadius: 12, color: textPrimary }}
                      labelStyle={{ color: textPrimary, fontWeight: 700 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12, color: textSecondary }} />
                    <Bar dataKey="male" name="Erkak" fill="#6366f1" radius={[6,6,0,0]}>
                      <LabelList dataKey="male" position="top" style={{ fontSize: 12, fontWeight: 800, fill: isDark ? '#a5b4fc' : '#4338ca' }} formatter={v => v > 0 ? v : ''} />
                    </Bar>
                    <Bar dataKey="female" name="Ayol" fill="#ec4899" radius={[6,6,0,0]}>
                      <LabelList dataKey="female" position="top" style={{ fontSize: 12, fontWeight: 800, fill: isDark ? '#f9a8d4' : '#be185d' }} formatter={v => v > 0 ? v : ''} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Card>

            {/* Generation detail cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
              {genStats.map(g => {
                const maleRatio = g.total ? Math.round((g.male / g.total) * 100) : 0
                return (
                  <div key={g.gen} style={{
                    background: isDark ? '#1e293b' : 'white', borderRadius: 16, padding: '16px',
                    border: isDark ? '1px solid #334155' : '1px solid #f1f5f9',
                    boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
                  }}>
                    {/* Generation number */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                        background: `linear-gradient(135deg,hsl(${220 + g.gen * 30},70%,55%),hsl(${240 + g.gen * 30},70%,45%))`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'white', fontSize: 16, fontWeight: 900,
                      }}>{g.gen}</div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: textPrimary }}>{g.name}</div>
                        <div style={{ fontSize: 11, color: textSecondary }}><AnimCount to={g.total} /> ta shaxs</div>
                      </div>
                    </div>

                    {/* Gender bar */}
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10,
                        color: textSecondary, marginBottom: 4 }}>
                        <span>👨 {g.male}</span>
                        <span>👩 {g.female}</span>
                      </div>
                      <div style={{ height: 6, borderRadius: 3, background: isDark ? '#334155' : '#e2e8f0', overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: 3, width: `${maleRatio}%`,
                          background: 'linear-gradient(90deg,#6366f1,#ec4899)',
                          transition: 'width 0.5s' }} />
                      </div>
                    </div>

                    {/* Stats */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div style={{ background: isDark ? '#0f172a' : '#f8fafc', borderRadius: 10, padding: '8px 10px', textAlign: 'center' }}>
                        <div style={{ fontSize: 18, fontWeight: 900, color: '#6366f1' }}>{g.male}</div>
                        <div style={{ fontSize: 9, color: textSecondary }}>👨 Erkak</div>
                      </div>
                      <div style={{ background: isDark ? '#0f172a' : '#f8fafc', borderRadius: 10, padding: '8px 10px', textAlign: 'center' }}>
                        <div style={{ fontSize: 18, fontWeight: 900, color: '#ec4899' }}>{g.female}</div>
                        <div style={{ fontSize: 9, color: textSecondary }}>👩 Ayol</div>
                      </div>
                    </div>

                    {g.avgAge != null && (
                      <div style={{ marginTop: 10, textAlign: 'center', padding: '6px', borderRadius: 10,
                        background: isDark ? '#0f172a' : '#fef3c7', border: isDark ? '1px solid #334155' : '1px solid #fde68a' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#d97706' }}>
                          Ø {g.avgAge} yosh (o'rtacha)
                        </span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* ═══════════════════ 2.3 YOSH PIRAMIDASI ═══════════════════ */}
        {activeTab === 'pyramid' && (
          <Card title="Yosh piramidasi" icon="📊" accent="#7c3aed">
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, justifyContent: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: textSecondary }}>
                <div style={{ width: 12, height: 12, borderRadius: 3, background: '#6366f1' }} />
                Erkaklar
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: textSecondary }}>
                <div style={{ width: 12, height: 12, borderRadius: 3, background: '#ec4899' }} />
                Ayollar
              </div>
            </div>

            {/* Custom pyramid */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {[...pyramid].reverse().map(row => {
                const maleW = maxPyramid > 0 ? (row.male / maxPyramid) * 100 : 0
                const femW  = maxPyramid > 0 ? (row.female / maxPyramid) * 100 : 0
                return (
                  <div key={row.group} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {/* Label */}
                    <div style={{ width: 42, fontSize: 10.5, fontWeight: 700, color: textSecondary, textAlign: 'right', flexShrink: 0 }}>
                      {row.group}
                    </div>
                    {/* Male bar (right-align) */}
                    <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
                      <div style={{ height: 24, borderRadius: '6px 0 0 6px', minWidth: row.male ? 4 : 0,
                        width: `${maleW}%`, background: 'linear-gradient(90deg,#6366f1,#818cf8)',
                        display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                        paddingRight: row.male ? 5 : 0, fontSize: 10, fontWeight: 700, color: 'white',
                        transition: 'width 0.5s',
                      }}>
                        {row.male > 0 ? row.male : ''}
                      </div>
                    </div>
                    {/* Center */}
                    <div style={{ width: 1, height: 24, background: isDark ? '#334155' : '#e2e8f0', flexShrink: 0 }} />
                    {/* Female bar */}
                    <div style={{ flex: 1 }}>
                      <div style={{ height: 24, borderRadius: '0 6px 6px 0', minWidth: row.female ? 4 : 0,
                        width: `${femW}%`, background: 'linear-gradient(90deg,#f9a8d4,#ec4899)',
                        display: 'flex', alignItems: 'center', paddingLeft: row.female ? 5 : 0,
                        fontSize: 10, fontWeight: 700, color: 'white',
                        transition: 'width 0.5s',
                      }}>
                        {row.female > 0 ? row.female : ''}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Summary */}
            {(() => {
              const ages = persons.map(p => calcAge(p.birth_date, null)).filter(a => a != null && a >= 0)
              const avgAge = ages.length ? Math.round(ages.reduce((a,b)=>a+b,0)/ages.length) : null
              const oldest = persons.filter(p=>p.birth_date && !p.death_date).sort((a,b)=>new Date(a.birth_date)-new Date(b.birth_date))[0]
              const youngest = persons.filter(p=>p.birth_date && !p.death_date).sort((a,b)=>new Date(b.birth_date)-new Date(a.birth_date))[0]
              const oldestAge = oldest ? calcAge(oldest.birth_date, null) : null
              const youngestAge = youngest ? calcAge(youngest.birth_date, null) : null
              const cards = [
                {
                  emoji: '📅', label: "O'rtacha yosh", sub: `${ages.length} ta shaxs`, photo: null, name: null,
                  age: avgAge, color: '#7c3aed', avatarBg: 'linear-gradient(135deg,#6366f1,#7c3aed)',
                  bg: isDark ? 'linear-gradient(135deg,#1e1b4b,#2d1b6b)' : 'linear-gradient(135deg,#ede9fe,#ddd6fe)',
                  brd: isDark ? '#4c1d95' : '#c4b5fd',
                },
                {
                  emoji: '👴', label: 'Eng katta', sub: oldest?.birth_date ? `${new Date(oldest.birth_date).getFullYear()}-yil` : '',
                  photo: oldest?.photo_url, name: oldest?.full_name, age: oldestAge, color: '#f59e0b',
                  avatarBg: 'linear-gradient(135deg,#f59e0b,#d97706)',
                  bg: isDark ? 'linear-gradient(135deg,#1c1008,#2d1a00)' : 'linear-gradient(135deg,#fef3c7,#fde68a)',
                  brd: isDark ? '#78350f' : '#fbbf24',
                },
                {
                  emoji: '👶', label: 'Eng yosh', sub: youngest?.birth_date ? `${new Date(youngest.birth_date).getFullYear()}-yil` : '',
                  photo: youngest?.photo_url, name: youngest?.full_name, age: youngestAge, color: '#10b981',
                  avatarBg: 'linear-gradient(135deg,#10b981,#059669)',
                  bg: isDark ? 'linear-gradient(135deg,#022c22,#064e3b)' : 'linear-gradient(135deg,#d1fae5,#a7f3d0)',
                  brd: isDark ? '#065f46' : '#6ee7b7',
                },
              ]
              return (
                <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                  {cards.map(({ emoji, label, sub, photo, name, age, color, avatarBg, bg, brd }) => (
                    <div key={label} style={{
                      borderRadius: 16, background: bg, border: `1.5px solid ${brd}`,
                      padding: '14px 12px', display: 'flex', flexDirection: 'column',
                      alignItems: 'center', gap: 8, minWidth: 0, textAlign: 'center',
                      boxShadow: `0 4px 16px ${color}22`,
                    }}>
                      {/* Badge label */}
                      <div style={{ fontSize: 9, fontWeight: 800, color, textTransform: 'uppercase',
                        letterSpacing: '0.06em', opacity: 0.85 }}>{label}</div>
                      {/* Avatar */}
                      <div style={{
                        width: 52, height: 52, borderRadius: 16, flexShrink: 0,
                        background: avatarBg, overflow: 'hidden',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 24, boxShadow: `0 4px 12px ${color}44`,
                        border: `2px solid ${brd}`,
                      }}>
                        {photo
                          ? <img src={photo} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                          : emoji}
                      </div>
                      {/* Age big number */}
                      <div style={{ fontSize: 32, fontWeight: 900, color, lineHeight: 1 }}>
                        {age != null ? <AnimCount to={age} /> : '—'}
                      </div>
                      <div style={{ fontSize: 10, fontWeight: 700, color, opacity: 0.7 }}>yosh</div>
                      {/* Name */}
                      {name && (
                        <div style={{ fontSize: 11, fontWeight: 800, color,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          width: '100%' }} title={name}>{name}</div>
                      )}
                      {sub && (
                        <div style={{ fontSize: 10, color: textSecondary, opacity: 0.75 }}>{sub}</div>
                      )}
                    </div>
                  ))}
                </div>
              )
            })()}
          </Card>
        )}

        {/* ═══════════════════ 2.2 XARITA ═══════════════════ */}
        {activeTab === 'map' && (
          <Card title="Tug'ilgan joylar xaritasi" icon="🗺️" accent="#0ea5e9">
            {mapPersons.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🗺️</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: textPrimary, marginBottom: 8 }}>
                  Tug'ilgan joy ma'lumotlari yo'q
                </div>
                <div style={{ fontSize: 12, color: textSecondary, marginBottom: 16, maxWidth: 340, margin: '8px auto 16px' }}>
                  Shaxs tahrirlash sahifasida "📍 Tug'ilgan joy" maydonini to'ldiring (masalan: Toshkent, Andijon viloyati)
                </div>
                <button onClick={() => navigate('/persons')}
                  style={{ padding: '9px 20px', borderRadius: 12, border: 'none', cursor: 'pointer',
                    background: 'linear-gradient(135deg,#0ea5e9,#0284c7)', color: 'white',
                    fontSize: 13, fontWeight: 700 }}>
                  👥 Shaxslarni tahrirlash
                </button>
              </div>
            ) : (
              <LeafletMap mapPersons={mapPersons} isDark={isDark} navigate={navigate} />
            )}
          </Card>
        )}

        {/* ═══════════════════ 2.4 TUG'ILGAN KUNLAR ═══════════════════ */}
        {activeTab === 'birthdays' && (
          <Card title="Bu oy tug'ilganlar" icon="🎂" accent="#f59e0b">
            {birthdayPersons.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: textSecondary }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🎂</div>
                <div style={{ fontSize: 14 }}>Bu oy tug'ilgan shaxslar yo'q</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {birthdayPersons.map(p => {
                  const age = calcAge(p.birth_date, null)
                  const isToday = p.daysUntil === 0
                  const isSoon  = p.daysUntil !== null && p.daysUntil <= 3 && p.daysUntil > 0
                  const bd = new Date(p.birth_date + 'T00:00:00')
                  return (
                    <div key={p.id}
                      onClick={() => navigate(`/persons/${p.id}`)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 14,
                        padding: '12px 14px', borderRadius: 16, cursor: 'pointer',
                        transition: 'all 0.15s',
                        background: isToday
                          ? 'linear-gradient(135deg,#fffbeb,#fef3c7)'
                          : (isDark ? '#0f172a' : '#f8fafc'),
                        border: isToday
                          ? '1.5px solid #fde68a'
                          : (isDark ? '1px solid #334155' : '1px solid #f1f5f9'),
                        boxShadow: isToday ? '0 4px 16px rgba(245,158,11,0.2)' : 'none',
                      }}
                      onMouseEnter={e => !isToday && (e.currentTarget.style.transform = 'translateX(4px)')}
                      onMouseLeave={e => (e.currentTarget.style.transform = '')}
                    >
                      {/* Photo */}
                      <div style={{
                        width: 52, height: 52, borderRadius: 16, flexShrink: 0, overflow: 'hidden',
                        border: `2.5px solid ${isToday ? '#f59e0b' : p.gender === 'male' ? '#6366f1' : '#ec4899'}`,
                        background: p.gender === 'male' ? '#eef2ff' : '#fff0f8',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
                        boxShadow: isToday ? '0 4px 12px rgba(245,158,11,0.3)' : 'none',
                        position: 'relative',
                      }}>
                        {p.photo_url || p.photo
                          ? <img src={p.photo_url || p.photo} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                          : <span>{p.gender === 'male' ? '👨' : '👩'}</span>}
                        {isToday && (
                          <div style={{ position: 'absolute', bottom: -2, right: -2, fontSize: 16 }}>🎉</div>
                        )}
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 800,
                          color: isToday ? '#92400e' : textPrimary, marginBottom: 2, overflow: 'hidden',
                          textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.full_name}
                        </div>
                        <div style={{ fontSize: 11, color: isToday ? '#b45309' : textSecondary }}>
                          📅 {fmtDate(p.birth_date)}
                          {age != null && ` · ${isToday ? age : age + 1} yosh bo'ladi`}
                        </div>
                        {p.birth_place && (
                          <div style={{ fontSize: 10, color: textSecondary, marginTop: 2 }}>
                            📍 {p.birth_place}
                          </div>
                        )}
                      </div>

                      {/* Days badge */}
                      <div style={{ flexShrink: 0 }}>
                        {isToday ? (
                          <div style={{ padding: '6px 12px', borderRadius: 12, fontSize: 12, fontWeight: 900,
                            background: '#f59e0b', color: 'white', boxShadow: '0 3px 8px rgba(245,158,11,0.4)' }}>
                            🎉 Bugun!
                          </div>
                        ) : isSoon ? (
                          <div style={{ padding: '6px 12px', borderRadius: 12, fontSize: 12, fontWeight: 800,
                            background: '#fef3c7', color: '#92400e',
                            border: '1.5px solid #fde68a' }}>
                            {p.daysUntil} kun
                          </div>
                        ) : (
                          <div style={{ padding: '5px 10px', borderRadius: 10, fontSize: 11, fontWeight: 700,
                            background: isDark ? '#1e293b' : '#f1f5f9',
                            color: textSecondary }}>
                            {p.daysUntil != null ? `${p.daysUntil} kun` : bd.getDate() + '-son'}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}

                {/* Month summary */}
                <div style={{ marginTop: 8, padding: '12px 16px', borderRadius: 14,
                  background: isDark ? '#0f172a' : '#fffbeb',
                  border: isDark ? '1px solid #334155' : '1px solid #fde68a',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#d97706' }}>
                    🎂 Jami {birthdayPersons.length} ta tug'ilgan kun
                  </span>
                  <span style={{ fontSize: 11, color: '#f59e0b' }}>
                    {fmtDate(new Date().toISOString().slice(0,10)).slice(3)}
                  </span>
                </div>
              </div>
            )}
          </Card>
        )}

      </div>
    </div>
  )
}
