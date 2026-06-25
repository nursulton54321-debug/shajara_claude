import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import useAuthStore from '../../store/authStore'
import { getStatistics, getBirthdays, exportCSV, importCSV, exportBackup, getPersons } from '../../api/persons'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import toast from 'react-hot-toast'
import OnboardingWizard from '../../components/OnboardingWizard'
import useThemeStore from '../../store/themeStore'
import { fmtDate } from '../../utils/date'
import { SkeletonDashboard } from '../../components/Skeleton'
import ErrorCard from '../../components/ErrorCard'

/* ── Helpers ─────────────────────────────────────────────── */
const today = new Date()
function daysUntil(d) {
  if (!d) return null
  const bd = new Date(d + 'T00:00:00')
  let next = new Date(today.getFullYear(), bd.getMonth(), bd.getDate())
  if (next < today) next = new Date(today.getFullYear() + 1, bd.getMonth(), bd.getDate())
  return Math.round((next - today) / 86400000)
}
function ageFrom(birth, end) {
  if (!birth) return null
  const e = end ? new Date(end + 'T00:00:00') : new Date()
  return Math.floor((e - new Date(birth + 'T00:00:00')) / (365.25 * 86400000))
}
function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
const rnd = (arr) => arr[Math.floor(Math.random() * arr.length)]

/* ── Global keyframes ── */
const KEYFRAMES = `
@keyframes floatY {
  0%,100% { transform: translateY(0px) }
  50%      { transform: translateY(-7px) }
}
@keyframes floatY2 {
  0%,100% { transform: translateY(0px) }
  50%      { transform: translateY(-5px) }
}
@keyframes pulse-glow {
  0%,100% { box-shadow: 0 0 0 0 rgba(99,102,241,0) }
  50%      { box-shadow: 0 0 0 8px rgba(99,102,241,0.18) }
}
@keyframes countUp {
  from { opacity:0; transform: translateY(14px) scale(0.85) }
  to   { opacity:1; transform: translateY(0) scale(1) }
}
@keyframes shimmer {
  0%   { background-position: -200% center }
  100% { background-position:  200% center }
}
@keyframes revIn {
  from { opacity:0; transform: translateY(8px) }
  to   { opacity:1; transform: translateY(0) }
}
@keyframes bounceIn {
  0%   { transform: scale(0.7); opacity:0 }
  60%  { transform: scale(1.1); opacity:1 }
  100% { transform: scale(1) }
}
@keyframes slideUp {
  from { opacity:0; transform: translateY(20px) }
  to   { opacity:1; transform: translateY(0) }
}
@keyframes wiggle {
  0%,100% { transform: rotate(0deg) }
  25%      { transform: rotate(-12deg) }
  75%      { transform: rotate(12deg) }
}
@keyframes heartbeat {
  0%,100% { transform: scale(1) }
  15%      { transform: scale(1.25) }
  30%      { transform: scale(1) }
  45%      { transform: scale(1.15) }
}
`

/* ── Animatsiyali son ── */
function AnimCount({ target = 0, duration = 900 }) {
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

/* ══════════════════════════════════════════════════════════
   STAT CARDS — premium animated
══════════════════════════════════════════════════════════ */
function StatCards({ stats, persons, bdays }) {
  const navigate = useNavigate()

  const maleAlive   = persons.filter(p => p.gender==='male'   && !p.death_date && !p.is_deceased && !p.deceased).length
  const maleDec     = Math.max(0, stats.male   - maleAlive)
  const femaleAlive = persons.filter(p => p.gender==='female' && !p.death_date && !p.is_deceased && !p.deceased).length
  const femaleDec   = Math.max(0, stats.female - femaleAlive)

  return (
    <div className="dash-stat-grid">
      {/* 1 — Jami */}
      <StatCardBase
        grad="linear-gradient(135deg,#3b82f6 0%,#6366f1 100%)"
        glow="rgba(99,102,241,.45)" idx={0} onClick={() => navigate('/persons')}>
        <StatIcon icon="👥" anim="floatY 2.8s ease infinite"/>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:28, fontWeight:900, color:'white', lineHeight:1, letterSpacing:'-0.5px' }}>
            <AnimCount target={stats.total||0}/>
          </div>
          <div style={{ fontSize:11.5, fontWeight:700, color:'rgba(255,255,255,0.9)', marginTop:3 }}>Jami a'zo</div>
          <div style={{ display:'flex', gap:10, marginTop:5 }}>
            <span style={{ fontSize:13, fontWeight:800, color:'white' }}>
              👨 <AnimCount target={stats.male||0}/>
            </span>
            <span style={{ fontSize:13, fontWeight:800, color:'rgba(255,255,255,0.85)' }}>
              👩 <AnimCount target={stats.female||0}/>
            </span>
          </div>
        </div>
      </StatCardBase>

      {/* 2 — Erkaklar */}
      <StatCardBase
        grad="linear-gradient(135deg,#6366f1 0%,#7c3aed 100%)"
        glow="rgba(124,58,237,.45)" idx={1} onClick={() => navigate('/persons')}>
        <StatIcon icon="👨" anim="floatY 3.1s ease infinite 0.3s"/>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:28, fontWeight:900, color:'white', lineHeight:1, letterSpacing:'-0.5px' }}>
            <AnimCount target={stats.male||0}/>
          </div>
          <div style={{ fontSize:11.5, fontWeight:700, color:'rgba(255,255,255,0.9)', marginTop:3 }}>
            Erkaklar · {stats.total ? Math.round(stats.male/stats.total*100) : 0}%
          </div>
          <div style={{ display:'flex', gap:8, marginTop:5 }}>
            <span style={{ fontSize:11, fontWeight:700, color:'#a7f3d0' }}>💚 {maleAlive} tirik</span>
            <span style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.55)' }}>🌿 {maleDec} vafot</span>
          </div>
        </div>
      </StatCardBase>

      {/* 3 — Ayollar */}
      <StatCardBase
        grad="linear-gradient(135deg,#ec4899 0%,#db2777 100%)"
        glow="rgba(236,72,153,.45)" idx={2} onClick={() => navigate('/persons')}>
        <StatIcon icon="👩" anim="floatY 2.6s ease infinite 0.6s"/>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:28, fontWeight:900, color:'white', lineHeight:1, letterSpacing:'-0.5px' }}>
            <AnimCount target={stats.female||0}/>
          </div>
          <div style={{ fontSize:11.5, fontWeight:700, color:'rgba(255,255,255,0.9)', marginTop:3 }}>
            Ayollar · {stats.total ? Math.round(stats.female/stats.total*100) : 0}%
          </div>
          <div style={{ display:'flex', gap:8, marginTop:5 }}>
            <span style={{ fontSize:11, fontWeight:700, color:'#fbcfe8' }}>💚 {femaleAlive} tirik</span>
            <span style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.55)' }}>🌿 {femaleDec} vafot</span>
          </div>
        </div>
      </StatCardBase>

      {/* 4 — Bu oy tug'ilgan */}
      <BirthdayStatCard stats={stats} bdays={bdays} idx={3}/>
    </div>
  )
}

function StatCardBase({ grad, glow, idx, onClick, children }) {
  const [hov, setHov] = useState(false)
  return (
    <div className="dash-stat-card"
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={onClick}
      style={{
        background: grad, borderRadius:16, padding:'14px 12px',
        cursor: onClick ? 'pointer' : 'default',
        position:'relative', overflow:'hidden',
        display:'flex', alignItems:'center', gap:10,
        transition:'transform 0.3s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.3s',
        transform: hov ? 'translateY(-4px) scale(1.02)' : 'translateY(0) scale(1)',
        boxShadow: hov ? `0 16px 32px ${glow}` : `0 4px 16px ${glow}`,
        animation: `slideUp 0.5s ease ${idx*80}ms both`,
      }}>
      <div style={{
        position:'absolute', top:-20, right:-14, width:70, height:70, borderRadius:'50%',
        background:'rgba(255,255,255,0.1)', pointerEvents:'none',
        transition:'transform 0.35s', transform: hov ? 'scale(1.5)' : 'scale(1)',
      }}/>
      {children}
    </div>
  )
}

function StatIcon({ icon, anim }) {
  const [hov, setHov] = useState(false)
  return (
    <div onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{
        width:44, height:44, borderRadius:13, flexShrink:0,
        background:'rgba(255,255,255,0.22)', border:'1.5px solid rgba(255,255,255,0.3)',
        display:'flex', alignItems:'center', justifyContent:'center', fontSize:22,
        animation: hov ? anim : 'none',
      }}>{icon}</div>
  )
}

function BirthdayStatCard({ stats, bdays, idx }) {
  const [hov, setHov] = useState(false)
  const { isDark } = useThemeStore()
  const thisMonthBdays = (bdays||[]).filter(p => {
    if (!p.birth_date) return false
    const bd = new Date(p.birth_date + 'T00:00:00')
    return bd.getMonth() === new Date().getMonth()
  })

  return (
    <div className="dash-stat-card"
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background:'linear-gradient(135deg,#f59e0b 0%,#d97706 100%)',
        borderRadius:16, padding:'14px 12px',
        position:'relative', overflow:'visible',
        display:'flex', alignItems:'center', gap:10,
        transition:'transform 0.3s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.3s',
        transform: hov ? 'translateY(-4px) scale(1.02)' : 'translateY(0) scale(1)',
        boxShadow: hov ? '0 16px 32px rgba(245,158,11,.55)' : '0 4px 16px rgba(245,158,11,.45)',
        animation: `slideUp 0.5s ease ${idx*80}ms both`,
        cursor: thisMonthBdays.length ? 'default' : 'default',
        zIndex: hov ? 10 : 1,
      }}>
      <div style={{
        position:'absolute', top:-20, right:-14, width:70, height:70, borderRadius:'50%',
        background:'rgba(255,255,255,0.1)', pointerEvents:'none',
        transition:'transform 0.35s', transform: hov ? 'scale(1.5)' : 'scale(1)',
      }}/>
      <div style={{
        width:44, height:44, borderRadius:13, flexShrink:0,
        background:'rgba(255,255,255,0.22)', border:'1.5px solid rgba(255,255,255,0.3)',
        display:'flex', alignItems:'center', justifyContent:'center', fontSize:22,
        animation: hov ? 'wiggle 2.5s ease infinite 1s' : 'none',
      }}>🎂</div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:28, fontWeight:900, color:'white', lineHeight:1, letterSpacing:'-0.5px' }}>
          <AnimCount target={stats.this_month_birthdays||0}/>
        </div>
        <div style={{ fontSize:11.5, fontWeight:700, color:'rgba(255,255,255,0.9)', marginTop:3 }}>Bu oy tug'ilgan</div>
        <div style={{ fontSize:10, color:'rgba(255,255,255,0.6)', marginTop:1 }}>
          {thisMonthBdays.length ? 'Hover qiling →' : `${stats.alive} tirik a'zo`}
        </div>
      </div>

      {/* Hover tooltip */}
      {hov && thisMonthBdays.length > 0 && (
        <div style={{
          position:'absolute', top:'calc(100% + 8px)', left:0, right:0,
          background: isDark ? '#1e293b' : '#ffffff',
          borderRadius:14, overflow:'hidden',
          boxShadow:'0 12px 40px rgba(0,0,0,0.4)',
          border: isDark ? '1.5px solid #f59e0b55' : '1.5px solid #fde68a',
          zIndex:999, animation:'slideUp 0.18s ease',
          minWidth:220,
        }}>
          <div style={{ padding:'8px 12px', background:'linear-gradient(135deg,#f59e0b,#d97706)', fontSize:11, fontWeight:800, color:'#fff' }}>
            🎂 {thisMonthBdays.length} ta — bu oy tug'ilgan kunlar
          </div>
          {thisMonthBdays.slice(0,6).map(p => (
            <div key={p.id} style={{
              display:'flex', alignItems:'center', gap:8, padding:'7px 12px',
              background: isDark ? '#1e293b' : '#ffffff',
              borderBottom: isDark ? '1px solid #334155' : '1px solid #fef3c7',
            }}>
              <span style={{ fontSize:16 }}>{p.gender==='male'?'👨':'👩'}</span>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:700, fontSize:12, color: isDark ? '#f1f5f9' : '#1e293b', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.full_name}</div>
                <div style={{ fontSize:10, fontWeight:600, color:'#f59e0b' }}>{fmtDate(p.birth_date)}</div>
              </div>
              {daysUntil(p.birth_date) === 0 && (
                <span style={{ fontSize:10, fontWeight:800, padding:'2px 6px', borderRadius:8, color:'#d97706', background: isDark?'#3d2200':'#fef3c7' }}>Bugun!</span>
              )}
            </div>
          ))}
          {thisMonthBdays.length > 6 && (
            <div style={{ padding:'6px 12px', fontSize:11, fontWeight:700, textAlign:'center', color:'#f59e0b', background: isDark?'#1e293b':'#fff' }}>
              +{thisMonthBdays.length-6} ta ko'proq
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════
   CARD HEADER
══════════════════════════════════════════════════════════ */
function CardHeader({ icon, grad, title, right, iconAnim }) {
  const { isDark } = useThemeStore()
  return (
    <div style={{
      padding: '12px 16px 10px',
      borderBottom: `1px solid ${isDark?'#334155':'#f1f5f9'}`,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:9 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 10, background: grad, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
          animation: iconAnim || 'none',
          boxShadow: `0 4px 12px ${grad.includes('f59e0b')?'rgba(245,158,11,0.35)':'rgba(99,102,241,0.3)'}`,
        }}>{icon}</div>
        <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>{title}</span>
      </div>
      {right}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════
   CHARTS ROW
══════════════════════════════════════════════════════════ */
function ChartsRow({ stats }) {
  const { isDark } = useThemeStore()
  const navigate   = useNavigate()
  const aliveP = stats.total ? Math.round(stats.alive / stats.total * 100) : 0
  const maleP  = stats.total ? Math.round(stats.male  / stats.total * 100) : 0
  const bars = [
    { icon:'💚', label:'Tirik',    value:stats.alive,    pct:aliveP,     bar:'#10b981', bg:'#d1fae5', tc:'#065f46' },
    { icon:'🌿', label:'Vafot',    value:stats.deceased, pct:100-aliveP, bar:'#94a3b8', bg:'#f1f5f9', tc:'#475569' },
    { icon:'👨', label:'Erkaklar', value:stats.male,     pct:maleP,      bar:'#6366f1', bg:'#eef2ff', tc:'#4338ca' },
    { icon:'👩', label:'Ayollar',  value:stats.female,   pct:100-maleP,  bar:'#ec4899', bg:'#fff0f8', tc:'#9d174d' },
  ]

  const [hovCard, setHovCard] = useState(null)

  return (
    <div className="dash-charts-grid" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>

      {/* Jins bo'yicha */}
      <div
        className="admin-card"
        onMouseEnter={() => setHovCard('gender')}
        onMouseLeave={() => setHovCard(null)}
        style={{
          overflow: 'hidden',
          transition: 'transform 0.25s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.25s',
          transform: hovCard==='gender' ? 'translateY(-4px)' : 'none',
          boxShadow: hovCard==='gender'
            ? (isDark?'0 16px 40px rgba(0,0,0,0.4)':'0 16px 40px rgba(99,102,241,0.15)')
            : undefined,
        }}>
        <CardHeader icon="⚥" grad="linear-gradient(135deg,#6366f1,#ec4899)"
          title="Jins bo'yicha" iconAnim="heartbeat 2s ease infinite" />

        <div style={{ display:'flex', alignItems:'center', padding:'10px 12px 4px', gap:8 }}>
          {/* Donut */}
          <div style={{ flexShrink:0, width:130, height:130, position:'relative' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{top:0,right:0,bottom:0,left:0}}>
                <Pie
                  data={[
                    {name:`👨 Erkak ${maleP}%`, value:stats.male||0},
                    {name:`👩 Ayol ${100-maleP}%`, value:stats.female||0},
                    {name:`💚 Tirik ${aliveP}%`, value:0},
                  ]}
                  cx="50%" cy="50%" innerRadius={40} outerRadius={58}
                  dataKey="value" startAngle={90} endAngle={-270}
                  strokeWidth={3} stroke={isDark?'#0f172a':'#fff'}>
                  <Cell fill="#6366f1"/><Cell fill="#ec4899"/>
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: isDark?'#1e293b':'white',
                    border:`1px solid ${isDark?'#334155':'#e2e8f0'}`,
                    borderRadius:12, fontSize:13, fontWeight:700,
                  }}
                  formatter={(v,n)=>[`${v} kishi`,n]}/>
              </PieChart>
            </ResponsiveContainer>
            <div style={{
              position:'absolute', inset:0, display:'flex', flexDirection:'column',
              alignItems:'center', justifyContent:'center', pointerEvents:'none', lineHeight:1.2,
            }}>
              <div style={{ fontSize:20, fontWeight:900, color:'var(--text-primary)' }}>{stats.total}</div>
              <div style={{ fontSize:9, color:'var(--text-secondary)', fontWeight:700 }}>jami</div>
              <div style={{ fontSize:9, color:'#6366f1', fontWeight:800, marginTop:2 }}>{maleP}% ♂</div>
              <div style={{ fontSize:9, color:'#ec4899', fontWeight:800 }}>{100-maleP}% ♀</div>
            </div>
          </div>

          {/* Legend grid */}
          <div style={{ flex:1, display:'flex', flexDirection:'column', gap:6 }}>
            {[
              { c:'#6366f1', icon:'👨', label:'Erkaklar', v:stats.male,     pct:maleP },
              { c:'#ec4899', icon:'👩', label:'Ayollar',  v:stats.female,   pct:100-maleP },
              { c:'#10b981', icon:'💚', label:'Tirik',    v:stats.alive,    pct:aliveP },
              { c:'#94a3b8', icon:'🌿', label:'Vafot',    v:stats.deceased, pct:100-aliveP },
            ].map(({c,icon,label,v,pct}) => (
              <div key={label} style={{
                display:'flex', alignItems:'center', gap:6,
                padding:'5px 10px', borderRadius:10,
                background: isDark ? `${c}15` : `${c}0d`,
                border: `1px solid ${c}30`,
                transition:'transform 0.15s',
              }}
                onMouseEnter={e => e.currentTarget.style.transform='scale(1.03)'}
                onMouseLeave={e => e.currentTarget.style.transform='scale(1)'}>
                <div style={{ width:8, height:8, borderRadius:3, background:c, flexShrink:0 }}/>
                <span style={{ fontSize:11.5, fontWeight:700, color:c, flex:1 }}>{icon} {label}</span>
                <span style={{ fontSize:13, fontWeight:900, color:'var(--text-primary)' }}>{v}</span>
                <span style={{
                  fontSize:10, fontWeight:800, padding:'1px 5px', borderRadius:6,
                  background: isDark?`${c}25`:`${c}15`, color:c, minWidth:36, textAlign:'center',
                }}>{pct}%</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ height:10 }}/>
      </div>

      {/* Oila holati */}
      <div
        className="admin-card"
        onMouseEnter={() => setHovCard('life')}
        onMouseLeave={() => setHovCard(null)}
        style={{
          overflow: 'hidden',
          transition: 'transform 0.25s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.25s',
          transform: hovCard==='life' ? 'translateY(-4px)' : 'none',
          boxShadow: hovCard==='life'
            ? (isDark?'0 16px 40px rgba(0,0,0,0.4)':'0 16px 40px rgba(16,185,129,0.15)')
            : undefined,
        }}>
        <CardHeader icon="📊" grad="linear-gradient(135deg,#10b981,#6366f1)"
          title="Oila holati" iconAnim="pulse-glow 2.5s ease infinite"
          right={
            <button onClick={() => navigate('/statistics')} style={{
              fontSize: 11, fontWeight: 800, color: '#6366f1',
              background: isDark?'#1e1b4b':'#eef2ff',
              border: 'none', borderRadius: 8, padding: '4px 10px', cursor: 'pointer',
              transition: 'all 0.15s',
            }}
              onMouseEnter={e => { e.currentTarget.style.background='#6366f1'; e.currentTarget.style.color='white' }}
              onMouseLeave={e => { e.currentTarget.style.background=isDark?'#1e1b4b':'#eef2ff'; e.currentTarget.style.color='#6366f1' }}>
              Barchasi →
            </button>
          }/>

        <div style={{ padding:'10px 16px', display:'flex', gap:14, alignItems:'center' }}>
          {/* Donut */}
          <div style={{ flexShrink:0, width:88, height:88, position:'relative' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={[{v:stats.alive},{v:stats.deceased}]}
                  cx="50%" cy="50%" innerRadius={26} outerRadius={40}
                  dataKey="v" startAngle={90} endAngle={-270} strokeWidth={0}>
                  <Cell fill="#10b981"/><Cell fill="#94a3b8"/>
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div style={{
              position:'absolute', inset:0, display:'flex', flexDirection:'column',
              alignItems:'center', justifyContent:'center', pointerEvents:'none',
            }}>
              <span style={{ fontSize:15, fontWeight:900, color:'#10b981', lineHeight:1 }}>{aliveP}%</span>
              <span style={{ fontSize:8.5, color:'#94a3b8', fontWeight:700 }}>tirik</span>
            </div>
          </div>

          {/* Bars */}
          <div style={{ flex:1, display:'flex', flexDirection:'column', gap:8 }}>
            {bars.map(b => (
              <div key={b.label}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                  <span style={{ fontSize:12, fontWeight:700, color:'var(--text-secondary)' }}>{b.icon} {b.label}</span>
                  <div style={{ display:'flex', gap:5, alignItems:'center' }}>
                    <span style={{ fontSize:13, fontWeight:900, color:'var(--text-primary)' }}>{b.value}</span>
                    <span style={{
                      fontSize:10, fontWeight:800, padding:'2px 6px', borderRadius:6,
                      background: isDark ? `${b.bar}25` : b.bg, color: isDark ? b.bar : b.tc,
                    }}>{b.pct}%</span>
                  </div>
                </div>
                <div style={{ height:5, borderRadius:4, background:isDark?'#334155':'#f1f5f9', overflow:'hidden' }}>
                  <div style={{
                    height:'100%', width:`${b.pct}%`, background:b.bar, borderRadius:4,
                    transition:'width 1.2s cubic-bezier(0.34,1.56,0.64,1)',
                    boxShadow: `0 1px 6px ${b.bar}60`,
                  }}/>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer mini stats */}
        <div style={{
          padding:'8px 16px 12px',
          display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6,
          borderTop: `1px solid ${isDark?'#334155':'#f1f5f9'}`,
        }}>
          {[
            { icon:'📅', label:"Bu oy",   value:stats.this_month_birthdays, color:'#f59e0b', anim:'wiggle 2s ease infinite' },
            { icon:'👥', label:"Jami",    value:stats.total,                color:'#6366f1', anim:'floatY 3s ease infinite' },
            { icon:'📈', label:"Omon",    value:`${aliveP}%`,               color:'#10b981', anim:'heartbeat 2.5s ease infinite' },
          ].map(s => (
            <div key={s.label} style={{
              textAlign:'center', padding:'7px 4px', borderRadius:12,
              background: isDark?'#1e293b':'#f8fafc',
              transition:'transform 0.2s cubic-bezier(0.34,1.56,0.64,1)',
            }}
              onMouseEnter={e => e.currentTarget.style.transform='scale(1.06)'}
              onMouseLeave={e => e.currentTarget.style.transform='scale(1)'}>
              <div style={{ fontSize:18, animation:s.anim }}>{s.icon}</div>
              <div style={{ fontSize:16, fontWeight:900, color:s.color, lineHeight:1, margin:'3px 0' }}>{s.value}</div>
              <div style={{ fontSize:9.5, color:isDark?'#64748b':'#94a3b8', fontWeight:700 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════
   INTERACTIVE WIDGET (quiz/fact/riddle) — unchanged logic
══════════════════════════════════════════════════════════ */
function InteractiveWidget({ stats, persons }) {
  const { isDark } = useThemeStore()
  const navigate   = useNavigate()
  const [cards, setCards] = useState([])
  const [idx, setIdx]     = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [selected, setSelected] = useState(null)
  const [anim, setAnim]   = useState(false)

  const buildGraph = useCallback((ps) => {
    const pm = {}
    ps.forEach(p => { pm[p.id] = p })
    const childrenOf = {}
    ps.forEach(p => {
      if (p.father_id) { childrenOf[p.father_id] = childrenOf[p.father_id] || []; childrenOf[p.father_id].push(p) }
      if (p.mother_id) { childrenOf[p.mother_id] = childrenOf[p.mother_id] || []; childrenOf[p.mother_id].push(p) }
    })
    const siblingsOf = (p) => {
      const s = new Set()
      if (p.father_id) (childrenOf[p.father_id]||[]).forEach(c => { if (c.id!==p.id) s.add(c) })
      if (p.mother_id) (childrenOf[p.mother_id]||[]).forEach(c => { if (c.id!==p.id) s.add(c) })
      return [...s]
    }
    const grandparentsOf = (p) => {
      const gps = []
      const add = (pid) => { const par = pm[pid]; if (!par) return; if (par.father_id && pm[par.father_id]) gps.push(pm[par.father_id]); if (par.mother_id && pm[par.mother_id]) gps.push(pm[par.mother_id]) }
      if (p.father_id) add(p.father_id)
      if (p.mother_id) add(p.mother_id)
      return gps
    }
    const unclesAuntsOf = (p) => {
      const ua = []
      const addParSibs = (pid) => { const par = pm[pid]; if (par) siblingsOf(par).forEach(s => ua.push(s)) }
      if (p.father_id) addParSibs(p.father_id)
      if (p.mother_id) addParSibs(p.mother_id)
      return ua
    }
    const grandchildrenOf = (p) => {
      const gc = []
      ;(childrenOf[p.id]||[]).forEach(c => { (childrenOf[c.id]||[]).forEach(gc2 => gc.push(gc2)) })
      return gc
    }
    return { pm, childrenOf, siblingsOf, grandparentsOf, unclesAuntsOf, grandchildrenOf }
  }, [])

  const buildCards = useCallback(() => {
    if (!stats || persons.length < 2) return []
    const { pm, childrenOf, siblingsOf, grandparentsOf, unclesAuntsOf, grandchildrenOf } = buildGraph(persons)
    const all = [...persons]
    const res = []
    const name = (p) => p?.full_name || '—'

    const byBirth = all.filter(p=>p.birth_date).sort((a,b)=>new Date(a.birth_date)-new Date(b.birth_date))
    const oldest  = byBirth[0]
    const youngest= all.filter(p=>p.birth_date&&!p.death_date).sort((a,b)=>new Date(b.birth_date)-new Date(a.birth_date))[0]
    const topParent = all.map(p=>({...p,kc:(childrenOf[p.id]||[]).length})).sort((a,b)=>b.kc-a.kc)[0]

    if (oldest) {
      const age = ageFrom(oldest.birth_date, oldest.death_date)
      res.push({ type:'fact', icon:'🧓', title:"Eng katta a'zo", accent:'#f59e0b',
        text:`${name(oldest)} — oilangizning eng katta a'zosi${age!=null?`, ${age} yoshda`:''}!`,
        personId:oldest.id })
    }
    if (youngest) {
      const age = ageFrom(youngest.birth_date, null)
      res.push({ type:'fact', icon:'👶', title:"Eng yosh a'zo", accent:'#10b981',
        text:`${name(youngest)} — oilangizning eng yosh a'zosi${age!=null?`, atigi ${age} yosh`:''}!`,
        personId:youngest.id })
    }
    if (topParent?.kc > 0) {
      res.push({ type:'fact', icon:'👨‍👧‍👦', title:"Eng ko'p farzand", accent:'#6366f1',
        text:`${name(topParent)} — ${topParent.kc} ta farzandning ${topParent.gender==='male'?'otasi':'onasi'}!`,
        personId:topParent.id })
    }
    const withGPs = all.filter(p => grandparentsOf(p).length > 0)
    if (withGPs.length) {
      const p = rnd(withGPs)
      const gps = grandparentsOf(p)
      res.push({ type:'fact', icon:'👴', title:'Bobo/Buvi', accent:'#8b5cf6',
        text:`${name(p)}ning ${gps.length === 1 ? (gps[0].gender==='male'?'bobosi':'buvisi') : 'bobo va buvisi'}: ${gps.map(name).join(' va ')}.`,
        personId: p.id })
    }
    const withParents = all.filter(p => (p.father_id && pm[p.father_id]) || (p.mother_id && pm[p.mother_id]))
    if (withParents.length >= 2) {
      const child = rnd(withParents)
      const isFather = child.father_id && pm[child.father_id]
      const parent   = isFather ? pm[child.father_id] : pm[child.mother_id]
      const role     = isFather ? 'otasi' : 'onasi'
      const wrong    = shuffle(all.filter(p=>p.id!==parent.id&&p.id!==child.id)).slice(0,3)
      if (wrong.length >= 2) {
        res.push({ type:'quiz', icon:'👨‍👧', title:"Qarindoshlik savoli", accent:'#6366f1',
          question:`${name(child)}ning ${role} kim?`,
          options: shuffle([{label:name(parent),correct:true},...wrong.map(p=>({label:name(p),correct:false}))]).slice(0,4),
          explanation:`To'g'ri! ${name(parent)} — ${name(child)}ning ${role}.`,
          relatedId: child.id })
      }
    }
    const withChildren = all.filter(p => (childrenOf[p.id]||[]).length > 0)
    if (withChildren.length) {
      const parent = rnd(withChildren)
      const kids   = childrenOf[parent.id] || []
      const oneKid = rnd(kids)
      const wrong  = shuffle(all.filter(p=>!kids.includes(p)&&p.id!==parent.id)).slice(0,3)
      if (wrong.length >= 2 && oneKid) {
        const role = parent.gender==='male' ? 'otasi' : 'onasi'
        res.push({ type:'quiz', icon:'👶', title:"Farzand savoli", accent:'#10b981',
          question:`${name(oneKid)}ning ${role} kim?`,
          options: shuffle([{label:name(parent),correct:true},...wrong.map(p=>({label:name(p),correct:false}))]).slice(0,4),
          explanation:`To'g'ri! ${name(parent)} — ${name(oneKid)}ning ${role}.`,
          relatedId: oneKid.id })
      }
    }
    const withSibs = all.filter(p => siblingsOf(p).length > 0)
    if (withSibs.length) {
      const p    = rnd(withSibs)
      const sibs = siblingsOf(p)
      const sib  = rnd(sibs)
      const role = p.gender==='male' ? (sib.gender==='male'?'akasi/ukasi':'singlisi/opasi') : (sib.gender==='male'?'akasi/ukasi':'opasi/singlisi')
      res.push({ type:'fact', icon:'👫', title:"Aka-uka / Opa-singil", accent:'#f43f5e',
        text:`${name(p)} va ${name(sib)} — bir-birlarining ${role}!`, personId: p.id })
    }
    const withGrandkids = all.filter(p => grandchildrenOf(p).length > 0)
    if (withGrandkids.length) {
      const gp  = rnd(withGrandkids)
      const gcs = grandchildrenOf(gp)
      const gc  = rnd(gcs)
      const wrong = shuffle(all.filter(p=>!gcs.includes(p)&&p.id!==gp.id)).slice(0,3)
      if (wrong.length >= 2 && gc) {
        const role = gp.gender==='male' ? 'bobosi' : 'buvisi'
        res.push({ type:'quiz', icon:'👴', title:"Bobo/Buvi savoli", accent:'#8b5cf6',
          question:`${name(gc)}ning ${role} kim?`,
          options: shuffle([{label:name(gp),correct:true},...wrong.map(p=>({label:name(p),correct:false}))]).slice(0,4),
          explanation:`To'g'ri! ${name(gp)} — ${name(gc)}ning ${role}.`,
          relatedId: gc.id })
      }
    }
    const withUA = all.filter(p => unclesAuntsOf(p).length > 0)
    if (withUA.length) {
      const p   = rnd(withUA)
      const uas = unclesAuntsOf(p)
      const ua  = rnd(uas)
      const role= ua.gender==='male' ? "tog'asi/amakisi" : "xolasi/ammasi"
      res.push({ type:'fact', icon:'🤝', title:"Tog'a / Xola / Amma", accent:'#0ea5e9',
        text:`${name(ua)} — ${name(p)}ning ${role}!`, personId: p.id })
    }
    const withNephews = all.filter(p => {
      const sibs = siblingsOf(p)
      return sibs.some(s => (childrenOf[s.id]||[]).length > 0)
    })
    if (withNephews.length) {
      const p    = rnd(withNephews)
      const sibs = siblingsOf(p).filter(s => (childrenOf[s.id]||[]).length > 0)
      if (sibs.length) {
        const sib     = rnd(sibs)
        const nephew  = rnd(childrenOf[sib.id]||[])
        const role    = nephew?.gender==='male' ? "jiyani (o'g'il)" : "jiyani (qiz)"
        if (nephew) {
          res.push({ type:'fact', icon:'👦', title:"Jiyan", accent:'#f97316',
            text:`${name(nephew)} — ${name(p)}ning ${role}!`, personId: nephew.id })
        }
      }
    }
    res.push({ type:'riddle', icon:'🧩', title:'Topishmoq', accent:'#0ea5e9',
      question:"Otamning akasining o'g'li menga nima bo'ladi?",
      answer:"Amakivachcha (cousin)! 👨‍👦\nOtangizning aka-ukasining farzandi — amakivachchangiz." })
    res.push({ type:'riddle', icon:'🌳', title:'Shajara bilim', accent:'#10b981',
      question:"Onaning onasi kimga buvi bo'ladi?\nOtaning otasi kimga bobo bo'ladi?",
      answer:"Ikkalasi ham nevaraga buvi va bobo bo'ladi! 👴👵\nNevara — bobo va buvining avlodi." })
    res.push({ type:'riddle', icon:'🤔', title:'Mulohaza', accent:'#7c3aed',
      question:`Agar har bir a'zoning 2 ta farzandi bo'lsa,\n${stats.total} kishili oilangiz\n3 avloddan keyin nechta bo'ladi?`,
      answer:`Taxminan ${stats.total*4}–${stats.total*8} kishi!\nShuning uchun shajara saqlash juda muhim 📚` })
    res.push({ type:'riddle', icon:'❓', title:'Qarindoshlik', accent:'#f43f5e',
      question:"Otamning singlisi menga nima bo'ladi?\nOnaming akasi menga nima bo'ladi?",
      answer:"Otangizning singlisi — ammangiz! 👩\nOnangizning akasi — tog'angiz! 👨" })
    if (stats.total > 1) {
      res.push({ type:'quiz', icon:'🎯', title:"Statistika savoli", accent:'#7c3aed',
        question:`Oilangizda jami nechta a'zo bor?`,
        options: shuffle([stats.total,Math.max(1,stats.total-2),stats.total+3,Math.max(1,stats.total+1)]
          .filter((v,i,a)=>a.indexOf(v)===i).slice(0,4))
          .map(v=>({label:`${v} ta`,correct:v===stats.total})),
        explanation:`To'g'ri! Oilangizda hozirda ${stats.total} ta a'zo.` })
    }
    if (stats.male > 0 && stats.female > 0) {
      res.push({ type:'quiz', icon:'⚥', title:"Jins nisbati", accent:'#ec4899',
        question:"Oilangizda kimlar ko'proq — erkaklar yoki ayollar?",
        options:[
          {label:`👨 Erkaklar (${stats.male})`, correct:stats.male>stats.female},
          {label:`👩 Ayollar (${stats.female})`,  correct:stats.female>stats.male},
          {label:`🤝 Teng (${stats.male})`,       correct:stats.male===stats.female},
        ],
        explanation:(stats.male>stats.female?'Erkaklar':stats.male===stats.female?'Teng':'Ayollar') + " ko'proq — " + Math.max(stats.male,stats.female) + " ta!" })
    }
    return shuffle(res)
  }, [stats, persons, buildGraph])

  useEffect(() => {
    const c = buildCards()
    setCards(c); setIdx(0); setRevealed(false); setSelected(null)
  }, [buildCards])

  const go = useCallback((dir) => {
    setAnim(true)
    setTimeout(() => {
      setIdx(i => (i+dir+cards.length) % Math.max(cards.length,1))
      setRevealed(false); setSelected(null); setAnim(false)
    }, 170)
  }, [cards.length])

  if (!cards.length) return null
  const card = cards[idx]
  const acc  = card.accent
  const mLabel = {fact:'💡 Qiziqarli fakt', quiz:'🎯 Test savoli', riddle:'🧩 Topishmoq'}[card.type]

  return (
    <div style={{
      borderRadius:18, overflow:'hidden',
      background: isDark ? `linear-gradient(135deg,${acc}18,#1e293b)` : `linear-gradient(135deg,${acc}08,#fff)`,
      border: `1.5px solid ${acc}35`,
      boxShadow: `0 6px 24px ${acc}18`,
    }}>
      {/* Header */}
      <div style={{
        background: `linear-gradient(135deg,${acc},${acc}cc)`,
        padding: '9px 16px',
        display:'flex', alignItems:'center', justifyContent:'space-between',
      }}>
        <span style={{ fontSize:12, fontWeight:900, color:'white', letterSpacing:'.07em', textTransform:'uppercase' }}>
          {mLabel}
        </span>
        <div style={{ display:'flex', gap:5 }}>
          {cards.map((_,i) => (
            <div key={i}
              onClick={() => { if(i!==idx){ setAnim(true); setTimeout(()=>{ setIdx(i); setRevealed(false); setSelected(null); setAnim(false) },150) }}}
              style={{
                width:i===idx?16:6, height:6, borderRadius:4, cursor:'pointer',
                background: i===idx?'white':'rgba(255,255,255,.35)',
                transition:'all .22s cubic-bezier(0.34,1.56,0.64,1)',
              }}/>
          ))}
        </div>
      </div>

      {/* Body */}
      <div style={{
        padding: '16px 18px 10px', minHeight:130,
        transition: 'opacity 0.17s, transform 0.17s',
        opacity: anim ? 0 : 1,
        transform: anim ? 'translateY(5px) scale(0.98)' : 'none',
      }}>
        {card.type==='fact' && (
          <div style={{ display:'flex', gap:13, alignItems:'flex-start' }}>
            <div style={{
              width:48, height:48, borderRadius:14, flexShrink:0,
              background:`${acc}20`, display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:24, border:`1.5px solid ${acc}35`,
              animation:'floatY2 3s ease infinite',
            }}>{card.icon}</div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:10, fontWeight:900, color:acc, textTransform:'uppercase',
                letterSpacing:'.08em', marginBottom:5 }}>{card.title}</div>
              <p style={{ fontSize:14, fontWeight:600, lineHeight:1.55, color:isDark?'#e2e8f0':'#1e293b', margin:0 }}>
                {card.text}
              </p>
              {card.personId && (
                <button onClick={() => navigate(`/persons/${card.personId}`)}
                  style={{
                    marginTop:10, fontSize:11.5, fontWeight:700, color:acc,
                    background:`${acc}14`, border:`1px solid ${acc}30`,
                    borderRadius:9, padding:'5px 13px', cursor:'pointer',
                    display:'inline-flex', alignItems:'center', gap:5,
                    transition:'all 0.18s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background=acc; e.currentTarget.style.color='white' }}
                  onMouseLeave={e => { e.currentTarget.style.background=`${acc}14`; e.currentTarget.style.color=acc }}>
                  👤 Profilni ko'rish →
                </button>
              )}
            </div>
          </div>
        )}

        {card.type==='quiz' && (
          <div>
            <div style={{ display:'flex', gap:11, marginBottom:12 }}>
              <span style={{ fontSize:22, flexShrink:0, animation:'bounceIn 0.4s ease' }}>{card.icon}</span>
              <p style={{ fontSize:14, fontWeight:700, lineHeight:1.5, color:isDark?'#e2e8f0':'#1e293b', margin:0 }}>
                {card.question}
              </p>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
              {(card.options||[]).map((opt, oi) => {
                const done = revealed || selected !== null
                const isSel = selected === oi
                const bg = !done ? (isDark?'#1e293b':'#f8fafc')
                  : opt.correct ? '#d1fae5' : isSel ? '#fee2e2' : (isDark?'#1e293b':'#f8fafc')
                const bdr = !done ? `1.5px solid ${isDark?'#334155':'#e2e8f0'}`
                  : opt.correct ? '1.5px solid #10b981' : isSel ? '1.5px solid #ef4444'
                  : `1.5px solid ${isDark?'#334155':'#e2e8f0'}`
                const clr = !done ? (isDark?'#e2e8f0':'#374151')
                  : opt.correct ? '#065f46' : isSel ? '#991b1b' : (isDark?'#64748b':'#9ca3af')
                return (
                  <button key={oi} disabled={!!done}
                    onClick={() => { setSelected(oi); setRevealed(true) }}
                    style={{
                      background:bg, border:bdr, color:clr, borderRadius:11,
                      padding:'9px 13px', textAlign:'left', fontSize:13, fontWeight:600,
                      display:'flex', alignItems:'center', gap:8, cursor: done?'default':'pointer',
                      transition:'transform 0.15s cubic-bezier(0.34,1.56,0.64,1)',
                    }}
                    onMouseEnter={e => { if (!done) e.currentTarget.style.transform='translateX(4px)' }}
                    onMouseLeave={e => { e.currentTarget.style.transform='none' }}>
                    <span style={{
                      width:22, height:22, borderRadius:6, flexShrink:0, fontSize:10, fontWeight:900,
                      background: opt.correct&&revealed ? '#10b981' : isSel&&!opt.correct ? '#ef4444' : `${acc}20`,
                      color: opt.correct&&revealed ? 'white' : isSel&&!opt.correct ? 'white' : acc,
                      display:'flex', alignItems:'center', justifyContent:'center',
                    }}>
                      {revealed ? (opt.correct?'✓':isSel?'✗':String.fromCharCode(65+oi)) : String.fromCharCode(65+oi)}
                    </span>
                    {opt.label}
                  </button>
                )
              })}
            </div>
            {revealed && (
              <div style={{
                marginTop:10, padding:'9px 13px', borderRadius:12, animation:'revIn 0.28s',
                background: selected!==null&&card.options?.[selected]?.correct ? '#d1fae5' : '#fef3c7',
                border: `1px solid ${selected!==null&&card.options?.[selected]?.correct?'#10b981':'#f59e0b'}`,
                fontSize:12.5, fontWeight:600, display:'flex', gap:7,
                color: selected!==null&&card.options?.[selected]?.correct ? '#065f46' : '#92400e',
              }}>
                <span style={{ flexShrink:0 }}>{selected!==null&&card.options?.[selected]?.correct ? '🎉' : '💡'}</span>
                <span>{card.explanation}</span>
              </div>
            )}
            {!revealed && (
              <p style={{ fontSize:11, color:'#94a3b8', margin:'8px 0 0', fontStyle:'italic' }}>
                Javobni tanlang 👆
              </p>
            )}
          </div>
        )}

        {card.type==='riddle' && (
          <div>
            <div style={{ display:'flex', gap:11, marginBottom:12 }}>
              <span style={{ fontSize:22, flexShrink:0 }}>{card.icon}</span>
              <p style={{
                fontSize:14, fontWeight:700, lineHeight:1.55,
                color:isDark?'#e2e8f0':'#1e293b', margin:0, whiteSpace:'pre-line',
              }}>{card.question}</p>
            </div>
            {!revealed ? (
              <button onClick={() => setRevealed(true)} style={{
                background:`linear-gradient(135deg,${acc},${acc}bb)`, color:'white',
                border:'none', borderRadius:12, padding:'10px 0', fontSize:13, fontWeight:700,
                cursor:'pointer', width:'100%', boxShadow:`0 4px 14px ${acc}40`,
                transition:'all 0.18s',
              }}
                onMouseEnter={e => { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow=`0 8px 20px ${acc}55` }}
                onMouseLeave={e => { e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow=`0 4px 14px ${acc}40` }}>
                🔍 Javobni ko'rish
              </button>
            ) : (
              <div style={{
                padding:'11px 15px', borderRadius:13, animation:'revIn 0.28s',
                background:`${acc}14`, border:`1.5px solid ${acc}30`,
                fontSize:13.5, fontWeight:600, lineHeight:1.55,
                color:isDark?'#e2e8f0':'#1e293b', whiteSpace:'pre-line',
              }}>
                ✨ {card.answer}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding:'8px 16px 13px', display:'flex', alignItems:'center',
        justifyContent:'space-between', borderTop:`1px solid ${acc}20`,
      }}>
        <button onClick={() => go(-1)} style={{
          padding:'6px 14px', borderRadius:9, fontSize:12.5, fontWeight:600, cursor:'pointer',
          background: isDark?'#1e293b':'#f8fafc',
          border:`1px solid ${isDark?'#334155':'#e2e8f0'}`,
          color: isDark?'#94a3b8':'#64748b',
          transition:'all 0.15s',
        }}
          onMouseEnter={e => { e.currentTarget.style.borderColor=acc; e.currentTarget.style.color=acc }}
          onMouseLeave={e => { e.currentTarget.style.borderColor=isDark?'#334155':'#e2e8f0'; e.currentTarget.style.color=isDark?'#94a3b8':'#64748b' }}>
          ← Oldingi
        </button>
        <span style={{ fontSize:11, color:isDark?'#64748b':'#9ca3af', fontWeight:700 }}>
          {idx+1} / {cards.length}
        </span>
        <button onClick={() => go(1)} style={{
          padding:'6px 14px', borderRadius:9, fontSize:12.5, fontWeight:800, cursor:'pointer',
          background:`linear-gradient(135deg,${acc},${acc}bb)`, border:'none',
          color:'white', boxShadow:`0 3px 12px ${acc}40`, transition:'all 0.15s',
        }}
          onMouseEnter={e => { e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.boxShadow=`0 6px 18px ${acc}50` }}
          onMouseLeave={e => { e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow=`0 3px 12px ${acc}40` }}>
          Keyingi →
        </button>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════
   BIRTHDAY ROW
══════════════════════════════════════════════════════════ */
function BdayRow({ p, navigate, isDark }) {
  const [hov, setHov] = useState(false)
  const { user } = useAuthStore()
  const days    = daysUntil(p.birth_date)
  const isToday = days === 0
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={() => navigate(user ? `/persons/${p.id}/edit` : `/persons/${p.id}`)}
      style={{
        display:'flex', alignItems:'center', gap:13, padding:'10px 16px',
        cursor:'pointer', borderBottom:'1px solid var(--border-subtle)',
        background: hov ? (isDark?'rgba(255,255,255,0.04)':'#f8fafc')
          : isToday ? (isDark?'#1c1708':'#fffbeb') : 'transparent',
        transition:'background 0.15s',
      }}>
      <div style={{
        width:40, height:40, borderRadius:'50%', flexShrink:0, overflow:'hidden',
        border:`2.5px solid ${p.gender==='male'?'#6366f1':'#ec4899'}`,
        background: p.gender==='male'?'#eef2ff':'#fff0f8',
        display:'flex', alignItems:'center', justifyContent:'center', fontSize:18,
        transition:'transform 0.25s cubic-bezier(0.34,1.56,0.64,1)',
        transform: hov ? 'scale(1.12)' : 'scale(1)',
      }}>
        {(p.photo_url || p.photo)
          ? <img src={p.photo_url || p.photo} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/>
          : (p.gender==='male'?'👨':'👩')}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontWeight:700, fontSize:13.5, color:'var(--text-primary)', marginBottom:2 }}>{p.full_name}</div>
        <div style={{ fontSize:11.5, color:'var(--text-secondary)' }}>
          {fmtDate(p.birth_date)}{p.age!=null?` · ${p.age+1} yosh bo'ladi`:''}
        </div>
      </div>
      <span style={{
        padding:'3px 10px', borderRadius:16, fontSize:11.5, fontWeight:800, flexShrink:0,
        background: isToday?'#fef08a':days!==null&&days<=7?'#fef3c7':(isDark?'#1e293b':'#f1f5f9'),
        color: isToday?'#854d0e':days!==null&&days<=7?'#b45309':(isDark?'#94a3b8':'#64748b'),
        animation: isToday ? 'heartbeat 1.5s ease infinite' : 'none',
      }}>
        {isToday ? '🎉 Bugun!' : `${days} kun`}
      </span>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════
   QUICK LINKS
══════════════════════════════════════════════════════════ */
function QuickLinks({ navigate }) {
  const { isAdmin } = useAuthStore()
  const allLinks = [
    { l:'🌳 Shajara daraxti', to:'/tree',        g:'linear-gradient(135deg,#4f46e5,#7c3aed)', anim:'floatY 3s ease infinite',       admin:false },
    { l:'👥 Shaxslar',        to:'/persons',      g:'linear-gradient(135deg,#0ea5e9,#3b82f6)', anim:'floatY 3s ease infinite 0.4s',  admin:false },
    { l:'➕ Yangi shaxs',     to:'/persons/add',  g:'linear-gradient(135deg,#10b981,#059669)', anim:'bounceIn 0.5s ease, floatY 3s ease infinite 0.8s', admin:true },
    { l:'🔗 Munosabat',       to:'/relationship', g:'linear-gradient(135deg,#f43f5e,#e11d48)', anim:'floatY 3s ease infinite 1.2s',  admin:false },
  ]
  const links = allLinks.filter(l => !l.admin || isAdmin())
  const [hov, setHov] = useState(null)
  return (
    <div className="dash-quicklinks-grid" style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
      {links.map(({ l, to, g, anim }) => (
        <button key={to}
          onMouseEnter={() => setHov(to)}
          onMouseLeave={() => setHov(null)}
          onClick={() => navigate(to)}
          style={{
            background: g, borderRadius:14, padding:'12px 10px',
            border:'none', cursor:'pointer', color:'white',
            fontSize:12, fontWeight:800,
            display:'flex', alignItems:'center', gap:7,
            boxShadow: hov===to ? '0 12px 30px rgba(0,0,0,0.22)' : '0 4px 14px rgba(0,0,0,0.14)',
            transition:'transform 0.25s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.25s',
            transform: hov===to ? 'translateY(-5px) scale(1.03)' : 'none',
          }}>
          <span style={{ fontSize:22, animation: hov===to ? anim : 'none' }}>
            {l.split(' ')[0]}
          </span>
          <span style={{ lineHeight:1.3 }}>{l.split(' ').slice(1).join(' ')}</span>
        </button>
      ))}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════
   MAIN
══════════════════════════════════════════════════════════ */
export default function DashboardPage() {
  const [stats, setStats]     = useState(null)
  const [bdays, setBdays]     = useState([])
  const [persons, setPersons] = useState([])
  const [importing, setImp]   = useState(false)
  const [onboarding, setOnb]  = useState(false)
  const [loadErr, setLoadErr] = useState(null)
  const fileRef  = useRef(null)
  const navigate = useNavigate()
  const { isDark } = useThemeStore()

  const loadData = useCallback(async () => {
    setLoadErr(null)
    setStats(null)
    try {
      const [sRes, bRes, pRes] = await Promise.all([
        getStatistics(),
        getBirthdays(),
        getPersons({ page_size: 500 }),
      ])
      setStats(sRes.data)
      if (sRes.data?.total === 0 && !localStorage.getItem('onboarding_done')) setOnb(true)
      const sorted = [...bRes.data].sort((a, b) => (daysUntil(a.birth_date) ?? 999) - (daysUntil(b.birth_date) ?? 999))
      setBdays(sorted)
      setPersons(pRes.data.results || pRes.data)
      // Birthday reminder toast — show once per session
      const sessionKey = 'bday_notif_shown'
      if (!sessionStorage.getItem(sessionKey)) {
        sessionStorage.setItem(sessionKey, '1')
        const today  = sorted.filter(p => daysUntil(p.birth_date) === 0)
        const soon   = sorted.filter(p => { const d = daysUntil(p.birth_date); return d > 0 && d <= 3 })
        if (today.length > 0) {
          toast(`🎂 Bugun: ${today.map(p => p.full_name).join(', ')} tug'ilgan kuni!`, {
            duration: 6000, style: { fontWeight: 700, fontSize: 14 },
          })
        } else if (soon.length > 0) {
          const p = soon[0]; const d = daysUntil(p.birth_date)
          toast(`🎂 ${p.full_name} — ${d} kundan keyin tug'ilgan kuni`, {
            duration: 5000, style: { fontWeight: 700, fontSize: 14 },
          })
        }
      }
    } catch {
      setLoadErr("Ma'lumotlarni yuklashda xato. Internet aloqasini tekshiring.")
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const handleExportBackup = async () => {
    const id = toast.loading('📦 Backup...')
    try {
      const res = await exportBackup()
      const url = URL.createObjectURL(new Blob([res.data],{type:'application/zip'}))
      const a = document.createElement('a'); a.href=url; a.download=`shajara-backup-${new Date().toISOString().slice(0,10)}.zip`; a.click(); URL.revokeObjectURL(url)
      toast.success('✅ Backup yuklandi!',{id})
    } catch { toast.error('❌ Xato',{id}) }
  }
  const handleExportCSV = async () => {
    const id = toast.loading('CSV...')
    try {
      const res = await exportCSV()
      const url = URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a'); a.href=url; a.download=`shajara-${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(url)
      toast.success('✅ CSV yuklandi!',{id})
    } catch { toast.error('❌ Xato',{id}) }
  }
  const handleImportCSV = async (e) => {
    const file = e.target.files?.[0]; if(!file) return
    setImp(true); const id = toast.loading('Import...')
    try {
      const res = await importCSV(file)
      const {created,updated,errors} = res.data
      toast.success(`✅ ${created} qo'shildi, ${updated} yangilandi`,{id})
      if(errors?.length) toast.error(`⚠️ ${errors.length} xato`)
      getStatistics().then(r=>setStats(r.data))
    } catch { toast.error('❌ Import xatosi',{id})
    } finally { setImp(false); e.target.value='' }
  }

  if (loadErr) return (
    <div style={{ padding: 24 }}>
      <ErrorCard message={loadErr} onRetry={loadData} />
    </div>
  )
  if (!stats) return <SkeletonDashboard />

  /* ── Top buttons ── */
  const topBtns = [
    { l:'📊 Statistika', fn:()=>navigate('/statistics'), g:'linear-gradient(135deg,#7c3aed,#4f46e5)' },
    { l:'⬇️ CSV',        fn:handleExportCSV,             g:'linear-gradient(135deg,#3b82f6,#6366f1)' },
    { l:importing?'⏳':'⬆️ Import', fn:()=>fileRef.current?.click(), g:'linear-gradient(135deg,#64748b,#475569)', d:importing },
    { l:'📦 Backup',     fn:handleExportBackup,          g:'linear-gradient(135deg,#0ea5e9,#0284c7)' },
  ]

  return (
    <>
      <style>{KEYFRAMES}</style>
      <div style={{ padding:'14px 16px', display:'flex', flexDirection:'column', gap:12, color:'var(--text-primary)' }}>

        {onboarding && <OnboardingWizard onComplete={() => setOnb(false)}/>}

        {/* ── Top bar ── */}
        <div className="dash-topbar">
          <h1 className="dash-title" style={{ fontSize:20, fontWeight:900, margin:0, color:'var(--text-primary)', display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ animation:'floatY 2.5s ease infinite', display:'inline-block' }}>🏠</span>
            Bosh sahifa
          </h1>
          <div className="dash-top-btns">
            {topBtns.map(({ l,fn,g,d }) => (
              <TopBtn key={l} label={l} onClick={fn} grad={g} disabled={d} />
            ))}
            <input ref={fileRef} type="file" accept=".csv" style={{display:'none'}} onChange={handleImportCSV}/>
          </div>
        </div>

        <StatCards stats={stats} persons={persons} bdays={bdays}/>
        <ChartsRow stats={stats}/>

        {/* ── Tug'ilgan kunlar ── */}
        {bdays.length > 0 && (
          <div className="admin-card" style={{ overflow:'hidden' }}>
            <CardHeader
              icon="🎂" iconAnim="wiggle 1.8s ease infinite"
              grad="linear-gradient(135deg,#f59e0b,#d97706)"
              title="Bu oydagi tug'ilgan kunlar"
              right={
                <span style={{
                  fontSize:12, fontWeight:800, padding:'3px 10px', borderRadius:16,
                  background:'#fef3c7', color:'#d97706',
                  animation:'bounceIn 0.4s ease',
                }}>{bdays.length} ta</span>
              }
            />
            {bdays.slice(0,4).map(p => (
              <BdayRow key={p.id} p={p} navigate={navigate} isDark={isDark}/>
            ))}
            {bdays.length>4 && (
              <div style={{
                padding:'9px 16px', fontSize:12.5, color:'#6366f1', fontWeight:700,
                textAlign:'center', cursor:'pointer',
                transition:'color 0.15s',
              }}
                onMouseEnter={e => e.currentTarget.style.color='#4f46e5'}
                onMouseLeave={e => e.currentTarget.style.color='#6366f1'}
                onClick={() => navigate('/persons')}>
                +{bdays.length-4} ta ko'proq →
              </div>
            )}
          </div>
        )}

        <InteractiveWidget stats={stats} persons={persons}/>
        <QuickLinks navigate={navigate}/>
      </div>
    </>
  )
}

/* ── Top button ── */
function TopBtn({ label, onClick, grad, disabled }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: '6px 13px', borderRadius:10, border:'none', cursor: disabled?'default':'pointer',
        fontSize:12, fontWeight:800, color:'white', background:grad,
        opacity: disabled ? 0.5 : 1,
        transition:'transform 0.2s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.2s',
        transform: hov && !disabled ? 'translateY(-2px)' : 'none',
        boxShadow: hov && !disabled ? '0 6px 18px rgba(0,0,0,0.2)' : '0 2px 8px rgba(0,0,0,0.1)',
      }}>
      {label}
    </button>
  )
}
