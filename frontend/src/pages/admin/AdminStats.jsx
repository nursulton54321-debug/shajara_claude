import { useEffect, useState, useMemo } from 'react'
import { getStatistics, getPersons } from '../../api/persons'
import useThemeStore from '../../store/themeStore'
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
  Legend, CartesianGrid, LabelList,
} from 'recharts'

/* ── Animatsiyalar ── */
const KEYFRAMES = `
@keyframes statFloat {
  0%,100% { transform: translateY(0px) }
  50%      { transform: translateY(-6px) }
}
@keyframes countUp {
  from { opacity: 0; transform: translateY(16px) }
  to   { opacity: 1; transform: translateY(0) }
}
@keyframes shimmer {
  0%   { background-position: -200% center }
  100% { background-position:  200% center }
}
@keyframes barRise {
  from { transform: scaleY(0); transform-origin: bottom }
  to   { transform: scaleY(1); transform-origin: bottom }
}
@keyframes ringDraw {
  from { stroke-dashoffset: 283 }
}
@keyframes fadeSlideUp {
  from { opacity:0; transform: translateY(20px) }
  to   { opacity:1; transform: translateY(0) }
}
@keyframes sparkle {
  0%,100% { transform: scale(1) rotate(0deg); opacity:.7 }
  50%      { transform: scale(1.4) rotate(20deg); opacity:1 }
}
`

const MONTH_SHORT = ['Yan','Fev','Mar','Apr','May','Iyn','Iyl','Avg','Sen','Okt','Noy','Dek']
const MONTH_FULL  = ['Yanvar','Fevral','Mart','Aprel','May','Iyun','Iyul','Avgust','Sentabr','Oktabr','Noyabr','Dekabr']

/* ── SVG Ring ── */
function Ring({ pct = 0, size = 64, stroke = 7 }) {
  const r    = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const off  = circ - (pct / 100) * circ
  return (
    <svg width={size} height={size} style={{ transform:'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none"
        stroke="rgba(255,255,255,0.18)" strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none"
        stroke="rgba(255,255,255,0.92)" strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={off} strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 1.4s cubic-bezier(0.34,1.56,0.64,1)', animationName:'ringDraw' }} />
    </svg>
  )
}

/* ── Raqam animatsiyasi ── */
function AnimCount({ target = 0, duration = 1100 }) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!target) return
    let start = null
    const step = ts => {
      if (!start) start = ts
      const p = Math.min((ts - start) / duration, 1)
      const ease = 1 - Math.pow(1 - p, 3)
      setVal(Math.round(ease * target))
      if (p < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [target])
  return <>{val}</>
}

/* ── Stat Karta — gorizontal, ixcham ── */
function StatCard({ icon, label, sublabel, value, pct, grad, glow, delay = 0 }) {
  const [hov, setHov] = useState(false)
  const [live, setLive] = useState(false)
  useEffect(() => { const t = setTimeout(() => setLive(true), delay + 50); return () => clearTimeout(t) }, [delay])

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: grad,
        borderRadius: 14,
        padding: '11px 14px',
        position: 'relative',
        overflow: 'hidden',
        cursor: 'default',
        transition: 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.25s',
        transform: hov ? 'translateY(-4px) scale(1.02)' : 'none',
        boxShadow: hov ? `0 14px 32px ${glow}, 0 0 0 1px rgba(255,255,255,0.15)` : `0 5px 16px ${glow}`,
        animation: `countUp 0.5s ease ${delay}ms both`,
        display: 'flex', alignItems: 'center', gap: 10,
      }}
    >
      {/* Dek doira */}
      <div style={{ position:'absolute', top:-16, right:-16, width:64, height:64, borderRadius:'50%',
        background:'rgba(255,255,255,0.1)', pointerEvents:'none' }} />

      {/* Shimmer */}
      {hov && <div style={{
        position:'absolute', inset:0, borderRadius:14, pointerEvents:'none',
        background:'linear-gradient(105deg,transparent 35%,rgba(255,255,255,0.12) 50%,transparent 65%)',
        backgroundSize:'200% 100%', animation:'shimmer 0.7s ease forwards',
      }} />}

      {/* Ikonka */}
      <div style={{
        width:36, height:36, borderRadius:10, flexShrink:0,
        background:'rgba(255,255,255,0.2)', backdropFilter:'blur(4px)',
        display:'flex', alignItems:'center', justifyContent:'center', fontSize:18,
        animation: hov ? 'statFloat 1.4s ease infinite' : 'none',
      }}>{icon}</div>

      {/* Matn */}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, fontWeight:800, color:'rgba(255,255,255,0.92)', lineHeight:1.25, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{label}</div>
        {sublabel && <div style={{ fontSize:11, color:'rgba(255,255,255,0.62)', marginTop:2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{sublabel}</div>}
        {/* Progress bar */}
        <div style={{ marginTop:5, height:3, borderRadius:2, background:'rgba(255,255,255,0.2)', overflow:'hidden' }}>
          <div style={{
            height:'100%', borderRadius:2, background:'rgba(255,255,255,0.85)',
            width: live ? `${pct ?? 100}%` : '0%',
            transition:'width 1.4s cubic-bezier(0.34,1.56,0.64,1)',
          }} />
        </div>
      </div>

      {/* Raqam + foiz */}
      <div style={{ flexShrink:0, textAlign:'right' }}>
        <div style={{ fontSize:32, fontWeight:900, color:'white', lineHeight:1, letterSpacing:'-1px' }}>
          {live ? <AnimCount target={value} duration={1000 + delay} /> : 0}
        </div>
        {pct != null && (
          <div style={{ fontSize:12, fontWeight:800, color:'rgba(255,255,255,0.78)', marginTop:2 }}>{pct}%</div>
        )}
      </div>
    </div>
  )
}

/* ── Pie label ── */
const renderPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, value, percent }) => {
  if (!value) return null
  const R = Math.PI / 180
  const r = innerRadius + (outerRadius - innerRadius) * 0.55
  const x = cx + r * Math.cos(-midAngle * R)
  const y = cy + r * Math.sin(-midAngle * R)
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={14} fontWeight={900}>
      {value}
      <tspan x={x} dy={16} fontSize={11} opacity={0.9}>{Math.round(percent*100)}%</tspan>
    </text>
  )
}

const CustomTooltip = ({ active, payload, label, isDark }) => {
  if (!active || !payload?.length) return null
  const bg  = isDark ? '#1e293b' : '#ffffff'
  const br  = isDark ? '#334155' : '#f1f5f9'
  const c1  = isDark ? '#e2e8f0' : '#374151'
  const c2  = isDark ? '#94a3b8' : '#6b7280'
  const c3  = isDark ? '#f1f5f9' : '#111827'
  return (
    <div style={{ background:bg, borderRadius:14, boxShadow:'0 8px 28px rgba(0,0,0,0.18)',
      border:`1px solid ${br}`, padding:'10px 14px', fontSize:13 }}>
      {label && <div style={{ fontWeight:800, color:c1, marginBottom:6 }}>{label}</div>}
      {payload.map((p, i) => (
        <div key={i} style={{ display:'flex', alignItems:'center', gap:7 }}>
          <div style={{ width:9, height:9, borderRadius:'50%', background:p.fill||p.color }} />
          <span style={{ color:c2 }}>{p.name||p.dataKey}:</span>
          <span style={{ fontWeight:800, color:c3 }}>{p.value} ta</span>
        </div>
      ))}
    </div>
  )
}

/* ── Oylik chart custom bar ── */
const MonthBar = ({ x, y, width, height, fill, isActive, value }) => {
  if (!height || height <= 0) return null
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} rx={8} ry={8} fill={fill}
        style={{ transition:'all 0.3s ease', filter: isActive ? `drop-shadow(0 4px 12px ${fill}90)` : 'none' }} />
      {isActive && (
        <rect x={x-2} y={y-2} width={width+4} height={height+2} rx={10} ry={10}
          fill="none" stroke={fill} strokeWidth={2} opacity={0.5} />
      )}
    </g>
  )
}

/* ══════════════════════════════════════════════════════ */
export default function AdminStats() {
  const [stats, setStats]     = useState(null)
  const [persons, setPersons] = useState([])
  const [hoverMonth, setHoverMonth] = useState(null)
  const { isDark } = useThemeStore()

  useEffect(() => {
    getStatistics().then(r => setStats(r.data))
    getPersons({ page_size: 10000 }).then(r => {
      const d = Array.isArray(r.data) ? r.data : (r.data?.results || [])
      setPersons(d)
    })
  }, [])

  /* Oylik ma'lumotlar */
  const monthData = useMemo(() => {
    const counts = Array(12).fill(0)
    persons.forEach(p => {
      if (p.birth_date) counts[new Date(p.birth_date + 'T00:00:00').getMonth()]++
    })
    return MONTH_SHORT.map((name, i) => ({ name, full: MONTH_FULL[i], count: counts[i], idx: i }))
  }, [persons])

  const curMonth  = new Date().getMonth()
  const maxCount  = Math.max(...monthData.map(d => d.count), 1)

  if (!stats) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:52, animation:'statFloat 1.5s ease infinite' }}>📊</div>
        <div style={{ color:'#6366f1', fontWeight:800, fontSize:16, marginTop:10 }}>Yuklanmoqda...</div>
      </div>
    </div>
  )

  const total = stats.total || 1
  const vafot = stats.deceased ?? (total - (stats.alive || 0))

  const cards = [
    { icon:'👨‍👩‍👧‍👦', label:"Jami a'zolar",    sublabel:'Bazaga kiritilgan',
      value:stats.total, pct:100,
      grad:'linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%)', glow:'rgba(79,70,229,0.45)', delay:0 },
    { icon:'👨', label:'Erkaklar',             sublabel:`${stats.male} nafar`,
      value:stats.male, pct:Math.round(stats.male/total*100),
      grad:'linear-gradient(135deg,#0ea5e9 0%,#2563eb 100%)', glow:'rgba(14,165,233,0.45)', delay:80 },
    { icon:'👩', label:'Ayollar',              sublabel:`${stats.female} nafar`,
      value:stats.female, pct:Math.round(stats.female/total*100),
      grad:'linear-gradient(135deg,#ec4899 0%,#db2777 100%)', glow:'rgba(236,72,153,0.45)', delay:160 },
    { icon:'💚', label:"Tirik a'zolar",        sublabel:`${vafot} kishi vafot etgan`,
      value:stats.alive, pct:Math.round((stats.alive||0)/total*100),
      grad:'linear-gradient(135deg,#10b981 0%,#059669 100%)', glow:'rgba(16,185,129,0.45)', delay:240 },
    { icon:'🕯️', label:'Vafot etganlar',       sublabel:'Xotirlash lozim',
      value:vafot, pct:Math.round(vafot/total*100),
      grad:'linear-gradient(135deg,#64748b 0%,#475569 100%)', glow:'rgba(100,116,139,0.35)', delay:320 },
    { icon:'🎂', label:"Bu oy tug'ilgan kunlar", sublabel:'Yaqinlashayotgan',
      value:stats.this_month_birthdays ?? 0,
      pct:Math.round((stats.this_month_birthdays??0)/total*100),
      grad:'linear-gradient(135deg,#f59e0b 0%,#d97706 100%)', glow:'rgba(245,158,11,0.45)', delay:400 },
  ]

  const genderData = [
    { name:'Erkak', value:stats.male,   pct:Math.round(stats.male/total*100) },
    { name:'Ayol',  value:stats.female, pct:Math.round(stats.female/total*100) },
  ]
  const lifeData = [
    { name:'Tirik',       value:stats.alive,  pct:Math.round((stats.alive||0)/total*100) },
    { name:'Vafot etgan', value:vafot,         pct:Math.round(vafot/total*100) },
  ]
  const summaryData = [
    { name:'Jami',  value:stats.total,                fill:'#6366f1' },
    { name:'Erkak', value:stats.male,                 fill:'#3b82f6' },
    { name:'Ayol',  value:stats.female,               fill:'#ec4899' },
    { name:'Tirik', value:stats.alive,                fill:'#10b981' },
    { name:'Vafot', value:vafot,                      fill:'#6b7280' },
    { name:'Bu oy', value:stats.this_month_birthdays, fill:'#f59e0b' },
  ]

  /* isDark ga bog'liq rang o'zgaruvchilari */
  const cPrimary   = isDark ? '#f1f5f9' : '#1e293b'
  const cSecondary = isDark ? '#94a3b8' : '#64748b'
  const cMuted     = isDark ? '#64748b' : '#94a3b8'
  const cBg        = isDark ? '#1e293b' : '#ffffff'
  const cBgSubtle  = isDark ? '#0f172a' : '#f8fafc'
  const cBorder    = isDark ? '#334155' : '#f1f5f9'
  const cGrid      = isDark ? '#334155' : '#f1f5f9'

  return (
    <>
      <style>{KEYFRAMES}</style>
      <div style={{ padding:24, display:'flex', flexDirection:'column', gap:24,
        background: isDark ? '#0f172a' : '#f8fafc', minHeight:'100%' }}>
        <h1 style={{ fontSize:22, fontWeight:900, color:cPrimary, margin:0 }}>📈 Statistika</h1>

        {/* ── Premium stat kartalar ── */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:12 }}>
          {cards.map(c => <StatCard key={c.label} {...c} />)}
        </div>

        {/* ── 2-ustun: Bar chart + Jins+Hayot yonma-yon ── */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>

          {/* Bar chart */}
          <div style={{ background:cBg, borderRadius:20, padding:20, border:`1px solid ${cBorder}`,
            boxShadow:'0 2px 16px rgba(0,0,0,0.06)' }}>
            <h2 style={{ fontWeight:800, color:cPrimary, fontSize:15, marginBottom:16 }}>📊 Umumiy ko'rsatkich</h2>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={summaryData} barSize={38} margin={{ top:22, right:10, left:0, bottom:0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={cGrid} vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize:12, fill:cMuted, fontWeight:600 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize:12, fill:cMuted }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip isDark={isDark} />} cursor={{ fill: isDark?'#334155':'#f8fafc' }} />
                <Bar dataKey="value" radius={[9,9,0,0]} name="Soni">
                  {summaryData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                  <LabelList dataKey="value" position="top"
                    style={{ fontSize:13, fontWeight:800, fill:cPrimary }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Jins + Hayot holati — bitta card ichida yonma-yon */}
          <div style={{ background:cBg, borderRadius:20, padding:20, border:`1px solid ${cBorder}`,
            boxShadow:'0 2px 16px rgba(0,0,0,0.06)', display:'flex', flexDirection:'column' }}>
            <h2 style={{ fontWeight:800, color:cPrimary, fontSize:15, marginBottom:12 }}>
              👫 Jins nisbati &nbsp;·&nbsp; 💚 Hayot holati
            </h2>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, flex:1 }}>
              {/* Jins nisbati */}
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center' }}>
                <div style={{ fontSize:12, fontWeight:700, color:cSecondary, marginBottom:6 }}>👫 Jins nisbati</div>
                <ResponsiveContainer width="100%" height={170}>
                  <PieChart>
                    <Pie data={genderData} cx="50%" cy="50%"
                      innerRadius={46} outerRadius={72}
                      dataKey="value" paddingAngle={3} labelLine={false} label={renderPieLabel}>
                      <Cell fill="#3b82f6" />
                      <Cell fill="#ec4899" />
                    </Pie>
                    <Tooltip content={<CustomTooltip isDark={isDark} />} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display:'flex', gap:8, marginTop:4, justifyContent:'center', flexWrap:'wrap' }}>
                  {genderData.map((d, i) => (
                    <div key={i} style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, fontWeight:700,
                      color: i===0 ? '#3b82f6' : '#ec4899' }}>
                      <div style={{ width:8, height:8, borderRadius:'50%', background: i===0?'#3b82f6':'#ec4899' }} />
                      {d.name}: {d.value} ({d.pct}%)
                    </div>
                  ))}
                </div>
              </div>

              {/* Hayot holati */}
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center' }}>
                <div style={{ fontSize:12, fontWeight:700, color:cSecondary, marginBottom:6 }}>💚 Hayot holati</div>
                <ResponsiveContainer width="100%" height={170}>
                  <PieChart>
                    <Pie data={lifeData} cx="50%" cy="50%"
                      innerRadius={46} outerRadius={72}
                      dataKey="value" paddingAngle={3} labelLine={false} label={renderPieLabel}>
                      <Cell fill="#10b981" />
                      <Cell fill="#6b7280" />
                    </Pie>
                    <Tooltip content={<CustomTooltip isDark={isDark} />} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display:'flex', gap:8, marginTop:4, justifyContent:'center', flexWrap:'wrap' }}>
                  {lifeData.map((d, i) => (
                    <div key={i} style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, fontWeight:700,
                      color: i===0 ? '#10b981' : '#6b7280' }}>
                      <div style={{ width:8, height:8, borderRadius:'50%', background: i===0?'#10b981':'#6b7280' }} />
                      {d.name}: {d.value} ({d.pct}%)
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── 2-ustun: Oylar diagrammasi + Foiz ko'rsatkichlari ── */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>

          {/* Oylar bo'yicha tug'ilganlar — dark/light mode responsive karta */}
          {(() => {
            /* Mode-ga qarab ranglar */
            const mBg      = isDark
              ? 'linear-gradient(135deg,#0f172a 0%,#1e1b4b 60%,#0f172a 100%)'
              : 'linear-gradient(135deg,#eef2ff 0%,#f0f9ff 60%,#eef2ff 100%)'
            const mShadow  = isDark ? '0 16px 48px rgba(99,102,241,0.28)' : '0 16px 48px rgba(99,102,241,0.14)'
            const mBorder  = isDark ? 'none' : '1px solid #c7d2fe'
            const mTitle   = isDark ? 'white' : '#1e1b4b'
            const mSub     = isDark ? 'rgba(255,255,255,0.45)' : '#6366f1'
            const mBadge1Bg= isDark ? 'rgba(99,102,241,0.2)'  : 'rgba(99,102,241,0.1)'
            const mBadge1Br= isDark ? 'rgba(99,102,241,0.3)'  : '#a5b4fc'
            const mBadge1T = isDark ? '#a5b4fc' : '#4f46e5'
            const mBadge2Bg= isDark ? 'rgba(245,158,11,0.2)'  : 'rgba(245,158,11,0.12)'
            const mBadge2Br= isDark ? 'rgba(245,158,11,0.3)'  : '#fcd34d'
            const mBadge2T = isDark ? '#fde68a' : '#b45309'
            const mCountC  = (isCur, isMax) =>
              isDark
                ? (isCur ? '#fde68a' : isMax ? '#c4b5fd' : '#a5b4fc')
                : (isCur ? '#d97706' : isMax ? '#7c3aed' : '#4f46e5')
            const mLabelC  = (isCur, isMax, isHov) =>
              isDark
                ? (isCur?'#fde68a':isMax?'#c4b5fd':isHov?'white':'rgba(255,255,255,0.4)')
                : (isCur?'#d97706':isMax?'#7c3aed':isHov?'#1e1b4b':'#94a3b8')
            const mEmptyBar = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(99,102,241,0.08)'
            const mLegendC  = isDark ? 'rgba(255,255,255,0.5)' : '#64748b'

            return (
              <div style={{
                borderRadius:22,
                background: mBg,
                padding:'22px 20px 18px',
                position:'relative', overflow:'hidden',
                boxShadow: mShadow,
                border: mBorder,
              }}>
                {/* Dekor */}
                <div style={{ position:'absolute', top:-50, right:-50, width:180, height:180, borderRadius:'50%',
                  background: isDark
                    ? 'radial-gradient(circle,rgba(99,102,241,0.2) 0%,transparent 70%)'
                    : 'radial-gradient(circle,rgba(99,102,241,0.12) 0%,transparent 70%)',
                  pointerEvents:'none' }} />
                <div style={{ position:'absolute', bottom:-30, left:20, width:130, height:130, borderRadius:'50%',
                  background: isDark
                    ? 'radial-gradient(circle,rgba(245,158,11,0.14) 0%,transparent 70%)'
                    : 'radial-gradient(circle,rgba(245,158,11,0.1) 0%,transparent 70%)',
                  pointerEvents:'none' }} />

                {/* Header */}
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ width:38, height:38, borderRadius:11,
                      background:'linear-gradient(135deg,#f59e0b,#d97706)',
                      display:'flex', alignItems:'center', justifyContent:'center', fontSize:18,
                      boxShadow:'0 4px 12px rgba(245,158,11,0.4)', flexShrink:0 }}>📅</div>
                    <div>
                      <div style={{ fontSize:14, fontWeight:900, color:mTitle, lineHeight:1.2 }}>
                        Oylar bo'yicha tug'ilganlar
                      </div>
                      <div style={{ fontSize:11, color:mSub, marginTop:1 }}>
                        {persons.filter(p=>p.birth_date).length} ta ma'lumot
                      </div>
                    </div>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:4, alignItems:'flex-end' }}>
                    <div style={{ padding:'3px 10px', borderRadius:20, background:mBadge1Bg,
                      border:`1px solid ${mBadge1Br}`, fontSize:10, color:mBadge1T, fontWeight:700 }}>
                      Eng ko'p: {MONTH_SHORT[monthData.indexOf(monthData.reduce((a,b)=>a.count>b.count?a:b))]}
                    </div>
                    <div style={{ padding:'3px 10px', borderRadius:20, background:mBadge2Bg,
                      border:`1px solid ${mBadge2Br}`, fontSize:10, color:mBadge2T, fontWeight:700 }}>
                      Joriy: {MONTH_SHORT[curMonth]}
                    </div>
                  </div>
                </div>

                {/* Barlar */}
                <div style={{ display:'flex', alignItems:'flex-end', gap:4, height:140, padding:'0 2px' }}>
                  {monthData.map((d, i) => {
                    const isCur   = i === curMonth
                    const isMax   = d.count === maxCount && d.count > 0
                    const isHov   = hoverMonth === i
                    const barH    = maxCount > 0 ? Math.round((d.count / maxCount) * 100) : 0
                    const fill    = isCur ? '#f59e0b' : isMax ? '#8b5cf6' : '#6366f1'
                    const opacity = d.count===0 ? (isDark ? 0.12 : 0.25) : isHov ? 1 : 0.72

                    return (
                      <div key={i}
                        onMouseEnter={() => setHoverMonth(i)}
                        onMouseLeave={() => setHoverMonth(null)}
                        style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
                        {isHov && d.count > 0 && (
                          <div style={{ position:'absolute', marginTop:-36,
                            background: isDark ? 'rgba(255,255,255,0.95)' : 'rgba(30,27,75,0.92)',
                            borderRadius:8, padding:'3px 8px',
                            fontSize:11, fontWeight:800,
                            color: isDark ? '#1e293b' : 'white',
                            boxShadow:'0 4px 16px rgba(0,0,0,0.2)', whiteSpace:'nowrap', zIndex:10 }}>
                            {d.full}: {d.count}
                          </div>
                        )}
                        <div style={{ fontSize:10, fontWeight:900,
                          color: d.count>0 ? mCountC(isCur, isMax) : 'transparent',
                          minHeight:14 }}>{d.count||''}</div>
                        <div style={{
                          width:'100%', height: Math.max(barH, d.count>0?5:2),
                          borderRadius:'6px 6px 3px 3px',
                          background: d.count===0 ? mEmptyBar
                            : `linear-gradient(180deg,${fill} 0%,${fill}99 100%)`,
                          opacity,
                          transition:'all 0.25s cubic-bezier(0.34,1.56,0.64,1)',
                          transform: isHov ? 'scaleX(1.1)' : 'scaleX(1)',
                          boxShadow: isHov&&d.count>0 ? `0 -4px 12px ${fill}70` : 'none',
                        }}>
                          {isCur && d.count>0 && (
                            <div style={{ height:3, borderRadius:6, width:'100%',
                              background:'linear-gradient(90deg,transparent,rgba(255,255,255,0.8),transparent)',
                              animation:'shimmer 2s ease infinite', backgroundSize:'200% 100%' }} />
                          )}
                        </div>
                        <div style={{ fontSize:10, fontWeight: isCur||isMax||isHov?800:500,
                          color: mLabelC(isCur, isMax, isHov),
                          transition:'all 0.2s', transform:isHov?'scale(1.1)':'scale(1)' }}>{d.name}</div>
                      </div>
                    )
                  })}
                </div>

                {/* Legend */}
                <div style={{ display:'flex', gap:14, marginTop:12, justifyContent:'center' }}>
                  {[{c:'#f59e0b',l:'Joriy oy'},{c:'#8b5cf6',l:"Eng ko'p"},{c:'#6366f1',l:'Boshqa'}].map(x=>(
                    <div key={x.l} style={{ display:'flex', alignItems:'center', gap:5, fontSize:10,
                      color: mLegendC }}>
                      <div style={{ width:8, height:8, borderRadius:3, background:x.c }} />{x.l}
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}

          {/* ── Foiz ko'rsatkichlari ── */}
          <div style={{ background:cBg, borderRadius:22, padding:20, border:`1px solid ${cBorder}`,
            boxShadow:'0 2px 16px rgba(0,0,0,0.06)', display:'flex', flexDirection:'column' }}>
            <h2 style={{ fontWeight:800, color:cPrimary, fontSize:15, marginBottom:18 }}>📐 Foiz ko'rsatkichlari</h2>
            <div style={{ display:'flex', flexDirection:'column', gap:14, flex:1 }}>
            {[
              { label:'Erkaklar',                    value:stats.male,                  color:'#3b82f6', icon:'👨' },
              { label:'Ayollar',                     value:stats.female,                color:'#ec4899', icon:'👩' },
              { label:"Tirik a'zolar",               value:stats.alive,                 color:'#10b981', icon:'💚' },
              { label:'Vafot etganlar',              value:vafot,                       color:'#6b7280', icon:'🕯️' },
              { label:"Bu oydagi tug'ilgan kunlar",  value:stats.this_month_birthdays,  color:'#f59e0b', icon:'🎂' },
            ].map(({ label, value, color, icon }) => {
              const pct = Math.round((value||0) / total * 100)
              return (
                <div key={label}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:7 }}>
                    <span style={{ fontSize:14, color:cPrimary, fontWeight:700,
                      display:'flex', alignItems:'center', gap:7 }}>
                      <span style={{ fontSize:16 }}>{icon}</span>{label}
                    </span>
                    <span style={{ fontSize:13, fontWeight:800, color }}>{value} ta · {pct}%</span>
                  </div>
                  <div style={{ height:9, borderRadius:5, background:isDark?'#334155':'#f1f5f9', overflow:'hidden' }}>
                    <div style={{ height:'100%', borderRadius:5, background:color,
                      width:`${pct}%`, transition:'width 1.2s cubic-bezier(0.34,1.56,0.64,1)' }} />
                  </div>
                </div>
              )
            })}
            </div>
          </div>

        </div>{/* end 2-col monthly+foiz */}

      </div>
    </>
  )
}
