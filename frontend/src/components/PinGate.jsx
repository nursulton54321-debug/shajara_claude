import { useState, useRef, useEffect, useCallback, memo } from 'react'
import { useNavigate } from 'react-router-dom'
import useThemeStore from '../store/themeStore'
import api from '../api/axios'

const KEY_EXP  = 'pin_expires_at'
const PIN_TTL  = 5 * 60 * 1000

export function touchPinSession() {
  if (sessionStorage.getItem(KEY_EXP)) {
    sessionStorage.setItem(KEY_EXP, String(Date.now() + PIN_TTL))
  }
}

function isValid() {
  const exp = parseInt(sessionStorage.getItem(KEY_EXP) || '0')
  return exp > 0 && Date.now() < exp
}

export function clearPinSession() {
  sessionStorage.removeItem(KEY_EXP)
  window.dispatchEvent(new Event('pin-relock'))
}

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart']

/* ─── Tree nodes (erkak/ayol belgilangan) ────────────────── */
const NODES = [
  { x:500, y:80,  r:22, delay:'0s',    gender:'m' },
  { x:300, y:190, r:17, delay:'0.2s',  gender:'f' },
  { x:700, y:190, r:17, delay:'0.3s',  gender:'m' },
  { x:160, y:310, r:14, delay:'0.55s', gender:'m' },
  { x:380, y:310, r:14, delay:'0.65s', gender:'f' },
  { x:620, y:310, r:14, delay:'0.7s',  gender:'f' },
  { x:840, y:310, r:14, delay:'0.8s',  gender:'m' },
  { x: 90, y:415, r:11, delay:'1.0s',  gender:'f' },
  { x:220, y:415, r:11, delay:'1.05s', gender:'m' },
  { x:310, y:415, r:11, delay:'1.1s',  gender:'f' },
  { x:440, y:415, r:11, delay:'1.15s', gender:'m' },
  { x:560, y:415, r:11, delay:'1.2s',  gender:'f' },
  { x:700, y:415, r:11, delay:'1.25s', gender:'m' },
  { x:820, y:415, r:11, delay:'1.3s',  gender:'f' },
  { x:930, y:415, r:11, delay:'1.35s', gender:'m' },
]
const EDGES = [
  [500,80, 300,190], [500,80, 700,190],
  [300,190, 160,310],[300,190, 380,310],
  [700,190, 620,310],[700,190, 840,310],
  [160,310,  90,415],[160,310, 220,415],
  [380,310, 310,415],[380,310, 440,415],
  [620,310, 560,415],[620,310, 700,415],
  [840,310, 820,415],[840,310, 930,415],
]

/* ─── Floating particles ─────────────────────────────────── */
const PARTICLES = Array.from({ length: 26 }, (_, i) => ({
  id: i,
  left:  `${5 + Math.random() * 90}%`,
  size:  Math.random() * 3 + 1.2,
  delay: `${Math.random() * 10}s`,
  dur:   `${7 + Math.random() * 9}s`,
  opacity: Math.random() * 0.45 + 0.12,
}))

/* ─── Network canvas (mouse hover) ──────────────────────────
   memo: props yo'q → PinGate re-render bo'lganda qayta mount
   qilinmaydi, rAF loop to'xtatilmaydi.                       */
const NetworkCanvas = memo(function NetworkCanvas() {
  const canvasRef = useRef(null)
  const mouse     = useRef({ x: -9999, y: -9999 })
  const dotsRef   = useRef([])
  const rafRef    = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    function resize() {
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    // Spawn random dots
    const COUNT = 55
    dotsRef.current = Array.from({ length: COUNT }, () => ({
      x:  Math.random() * window.innerWidth,
      y:  Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
    }))

    const onMove = (e) => {
      const src = e.touches ? e.touches[0] : e
      mouse.current = { x: src.clientX, y: src.clientY }
    }
    window.addEventListener('mousemove', onMove, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: true })

    function draw() {
      const w = canvas.width, h = canvas.height
      ctx.clearRect(0, 0, w, h)
      const dots = dotsRef.current
      const mx = mouse.current.x, my = mouse.current.y

      // Move dots
      dots.forEach(d => {
        d.x += d.vx; d.y += d.vy
        if (d.x < 0 || d.x > w) d.vx *= -1
        if (d.y < 0 || d.y > h) d.vy *= -1
      })

      // Draw connections
      const LINK_D   = 140   // dot–dot max distance
      const MOUSE_D  = 180   // mouse–dot max distance

      for (let i = 0; i < dots.length; i++) {
        const a = dots[i]

        // Dot–dot lines
        for (let j = i + 1; j < dots.length; j++) {
          const b  = dots[j]
          const dx = a.x - b.x, dy = a.y - b.y
          const d  = Math.sqrt(dx*dx + dy*dy)
          if (d > LINK_D) continue
          const alpha = (1 - d / LINK_D) * 0.18
          ctx.beginPath()
          ctx.moveTo(a.x, a.y)
          ctx.lineTo(b.x, b.y)
          ctx.strokeStyle = `rgba(139,92,246,${alpha})`
          ctx.lineWidth = 0.8
          ctx.stroke()
        }

        // Mouse–dot lines (highlighted)
        const mdx = a.x - mx, mdy = a.y - my
        const md  = Math.sqrt(mdx*mdx + mdy*mdy)
        if (md < MOUSE_D) {
          const alpha = (1 - md / MOUSE_D) * 0.65
          ctx.beginPath()
          ctx.moveTo(a.x, a.y)
          ctx.lineTo(mx, my)
          ctx.strokeStyle = `rgba(167,139,250,${alpha})`
          ctx.lineWidth = 1.1
          ctx.stroke()
        }
      }

      // Draw dots
      dots.forEach(d => {
        const mdx = d.x - mx, mdy = d.y - my
        const md  = Math.sqrt(mdx*mdx + mdy*mdy)
        const near = md < MOUSE_D
        ctx.beginPath()
        ctx.arc(d.x, d.y, near ? 2.2 : 1.4, 0, Math.PI * 2)
        ctx.fillStyle = near ? 'rgba(196,181,253,0.75)' : 'rgba(139,92,246,0.35)'
        ctx.fill()
      })

      rafRef.current = requestAnimationFrame(draw)
    }
    draw()

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('touchmove', onMove)
    }
  }, [])

  return (
    <canvas ref={canvasRef} style={{
      position: 'absolute', inset: 0,
      width: '100%', height: '100%',
      pointerEvents: 'none', zIndex: 1,
    }} />
  )
})

export default function PinGate({ children }) {
  const { init } = useThemeStore()
  const navigate  = useNavigate()
  const [unlocked, setUnlocked] = useState(isValid)
  const [pin, setPin]     = useState(['', '', '', ''])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [shake, setShake]     = useState(false)
  const [success, setSuccess] = useState(false)
  const inputs   = useRef([])
  const timerRef = useRef(null)

  useEffect(() => { init() }, [])

  // PIN oynasini to'liq tiklash
  const resetToLocked = useCallback(() => {
    sessionStorage.removeItem(KEY_EXP)
    setUnlocked(false)
    setPin(['', '', '', ''])
    setError('')
    setSuccess(false)   // ← BUG FIX: success state ni ham tozalash
    setShake(false)
  }, [])

  useEffect(() => {
    const onRelock = resetToLocked
    function onAuthExpired() {
      import('../store/authStore').then(m => m.default.getState().logout())
      import('react-hot-toast').then(({ default: toast }) => {
        toast.error(
          '🔐 Sessiya tugadi. Qayta login qilishingiz kerak.',
          { duration: 4000 }
        )
        setTimeout(() => {
          toast(
            (t) => (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                <span style={{ fontWeight:700, fontSize:13 }}>Login sahifasiga o'tish</span>
                <button
                  onClick={() => { toast.dismiss(t.id); window.location.href = '/login' }}
                  style={{ background:'#4f46e5', color:'white', border:'none',
                    padding:'8px 14px', borderRadius:8, fontWeight:700,
                    cursor:'pointer', fontSize:13 }}>
                  🔑 Login
                </button>
              </div>
            ),
            { duration: 10000, icon: null }
          )
        }, 500)
      })
    }
    window.addEventListener('pin-relock', onRelock)
    window.addEventListener('auth-expired', onAuthExpired)
    return () => {
      window.removeEventListener('pin-relock', onRelock)
      window.removeEventListener('auth-expired', onAuthExpired)
    }
  }, [resetToLocked])

  /* Inactivity relock + activity listeners.
     unlocked=true da qo'shiladi, false da yoki unmount'da tozalanadi.
     useRef/global o'zgaruvchi kerak emas — useEffect cleanup o'z zimmasiga oladi. */
  useEffect(() => {
    if (!unlocked) return
    ACTIVITY_EVENTS.forEach(ev =>
      window.addEventListener(ev, touchPinSession, { passive: true })
    )
    timerRef.current = setInterval(() => {
      if (!isValid()) {
        clearInterval(timerRef.current)
        resetToLocked()
      }
    }, 10_000)
    return () => {
      ACTIVITY_EVENTS.forEach(ev =>
        window.removeEventListener(ev, touchPinSession)
      )
      clearInterval(timerRef.current)
    }
  }, [unlocked, resetToLocked])

  if (unlocked) return children

  function handleChange(i, val) {
    const v = val.replace(/\D/, '').slice(-1)
    const next = [...pin]; next[i] = v
    setPin(next); setError('')
    if (v && i < 3) inputs.current[i + 1]?.focus()
  }
  function handleKeyDown(i, e) {
    if (e.key === 'Backspace' && !pin[i] && i > 0) inputs.current[i - 1]?.focus()
    if (e.key === 'Enter') submit()
  }
  function handlePaste(e) {
    const t = e.clipboardData.getData('text').replace(/\D/g,'').slice(0,4)
    if (t.length === 4) { setPin(t.split('')); inputs.current[3]?.focus() }
    e.preventDefault()
  }

  async function submit() {
    const code = pin.join('')
    if (code.length < 4) return
    setLoading(true); setError('')
    try {
      await api.post('/auth/verify-pin/', { pin: code })
      sessionStorage.setItem(KEY_EXP, String(Date.now() + PIN_TTL))
      setSuccess(true)
      setTimeout(() => { setUnlocked(true); navigate('/tree') }, 950)
    } catch {
      setError("PIN noto'g'ri. Qayta urinib ko'ring.")
      setShake(true); setPin(['','','',''])
      setTimeout(() => { setShake(false); inputs.current[0]?.focus() }, 520)
    } finally { setLoading(false) }
  }

  const filled = pin.join('').length === 4

  return (
    <div style={{ position:'fixed', inset:0, zIndex:999999, overflow:'hidden' }}>
      <style>{CSS}</style>

      {/* Gradient background */}
      <div className="pg-bg" />
      <div className="pg-orb pg-orb1" />
      <div className="pg-orb pg-orb2" />
      <div className="pg-orb pg-orb3" />
      <div className="pg-orb pg-orb4" />

      {/* Network canvas (mouse hover) */}
      <NetworkCanvas />

      {/* Floating particles */}
      {PARTICLES.map(p => (
        <div key={p.id} className="pg-particle" style={{
          left: p.left, width: p.size, height: p.size,
          opacity: p.opacity, animationDuration: p.dur, animationDelay: p.delay,
        }} />
      ))}

      {/* Animated tree SVG */}
      <div className="pg-tree-wrap">
        <svg viewBox="0 0 1000 500" preserveAspectRatio="xMidYMid meet"
          style={{ width:'100%', height:'100%' }}>
          <defs>
            {/* Erkak glow — ko'k */}
            <filter id="glowM">
              <feGaussianBlur stdDeviation="3" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            {/* Ayol glow — pushti */}
            <filter id="glowF">
              <feGaussianBlur stdDeviation="3" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            {/* Kuchli glow (hover/pulse uchun) */}
            <filter id="glowBig">
              <feGaussianBlur stdDeviation="6" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            {/* Har bir node uchun clipPath (SVG defs ichida) */}
            {NODES.map((n, i) => (
              <clipPath key={`cp${i}`} id={`nc${i}`}>
                <circle cx={n.x} cy={n.y} r={n.r - 0.5} />
              </clipPath>
            ))}
            {/* Erkak gradient */}
            <radialGradient id="gradM" cx="40%" cy="35%" r="65%">
              <stop offset="0%"   stopColor="#818cf8"/>
              <stop offset="100%" stopColor="#3730a3"/>
            </radialGradient>
            {/* Ayol gradient */}
            <radialGradient id="gradF" cx="40%" cy="35%" r="65%">
              <stop offset="0%"   stopColor="#f9a8d4"/>
              <stop offset="100%" stopColor="#be185d"/>
            </radialGradient>
          </defs>

          {/* Base lines */}
          {EDGES.map(([x1,y1,x2,y2], i) => (
            <line key={`b${i}`} x1={x1} y1={y1} x2={x2} y2={y2}
              stroke="rgba(99,102,241,0.22)" strokeWidth="1.5"
              strokeLinecap="round" className="pg-edge-base"
              style={{ animationDelay: `${0.1 + i * 0.08}s` }} />
          ))}

          {/* Flowing dash lines */}
          {EDGES.map(([x1,y1,x2,y2], i) => (
            <line key={`g${i}`} x1={x1} y1={y1} x2={x2} y2={y2}
              stroke="rgba(167,139,250,0.55)" strokeWidth="1.2"
              strokeLinecap="round" strokeDasharray="4 60"
              className="pg-edge-flow"
              style={{ animationDelay: `${i * 0.3}s`, animationDuration: `${2 + (i%4)*0.4}s` }} />
          ))}

          {/* Nodes — shaxs ikonkasi (bosh + gavda, clipPath bilan) */}
          {NODES.map((n, i) => {
            const male    = n.gender === 'm'
            const grad    = male ? 'url(#gradM)' : 'url(#gradF)'
            const haloClr = male ? 'rgba(99,102,241,0.18)' : 'rgba(236,72,153,0.18)'
            const ringClr = male ? 'rgba(129,140,248,0.5)' : 'rgba(244,114,182,0.5)'
            const glowId  = male ? 'url(#glowM)' : 'url(#glowF)'
            const r = n.r

            // Shaxs ikonkasi o'lchovlari
            const headR  = r * 0.30          // bosh radiusi
            const headY  = n.y - r * 0.16    // bosh markazi (yuqoriroq)
            const bodyR  = r * 0.50          // gavda (yelkalar) doirasi radiusi
            const bodyY  = n.y + r * 0.78    // gavda doirasi markazi (pastroq, kesib ko'rsatiladi)

            return (
              <g key={`n${i}`} className="pg-node-g" style={{ animationDelay: n.delay }}>

                {/* Pulsirlovchi halo */}
                <circle cx={n.x} cy={n.y} r={r + 10}
                  fill={haloClr}
                  className="pg-node-halo"
                  style={{ animationDelay: n.delay, animationDuration: `${2.4 + i%3*0.6}s` }} />

                {/* Tashqi halqa (ring) */}
                <circle cx={n.x} cy={n.y} r={r + 2.5}
                  fill="none" stroke={ringClr} strokeWidth="1.2"
                  className="pg-node-ring-small"
                  style={{ animationDelay: n.delay }} />

                {/* Asosiy doira (gradient fon) */}
                <circle cx={n.x} cy={n.y} r={r}
                  fill={grad} filter={glowId}
                  className="pg-node"
                  style={{ animationDelay: n.delay }} />

                {/* Shaxs silueti — clipPath bilan node ichiga kesib ko'rsatiladi */}
                <g clipPath={`url(#nc${i})`}>
                  {/* Yengil ichki glow overlay */}
                  <circle cx={n.x - r*0.25} cy={n.y - r*0.3} r={r * 0.55}
                    fill="rgba(255,255,255,0.06)" />

                  {/* Bosh (head) */}
                  <circle cx={n.x} cy={headY} r={headR}
                    fill="rgba(255,255,255,0.92)" />

                  {/* Gavda / yelkalar — katta doira pastdan kesib ko'rsatiladi */}
                  <circle cx={n.x} cy={bodyY} r={bodyR}
                    fill="rgba(255,255,255,0.88)" />
                </g>

              </g>
            )
          })}

          {/* Root ring */}
          <circle cx="500" cy="80" r="32" fill="none"
            stroke="rgba(167,139,250,0.5)" strokeWidth="2"
            className="pg-node-ring" />
        </svg>
      </div>

      {/* Card */}
      <div style={{
        position:'absolute', inset:0, zIndex:2,
        display:'flex', alignItems:'center', justifyContent:'center',
        padding:20,
      }}>
        <div className={`pg-card${shake ? ' pg-shake' : ''}${success ? ' pg-success-card' : ''}`}>

          {success ? (
            <div style={{ textAlign:'center', padding:'30px 20px' }}>
              <div className="pg-success-icon">✓</div>
              <div style={{
                fontSize:22, fontWeight:900, color:'white', marginTop:18,
                textShadow:'0 0 20px rgba(16,185,129,0.8)',
              }}>Xush kelibsiz!</div>
            </div>
          ) : (
            <>
              <div style={{ textAlign:'center', marginBottom:20 }}>
                <div className="pg-logo">🌳</div>
                <div className="pg-family-name">Matayev & Abdumannonovlar</div>
                <div className="pg-shajarasi">
                  <span className="pg-star">✦</span>
                  <span className="pg-shajarasi-text"> SHAJARASI </span>
                  <span className="pg-star">✦</span>
                </div>
                <div className="pg-divider" />
                <div style={{ fontSize:13, color:'rgba(196,181,253,0.75)', lineHeight:1.55, marginTop:16 }}>
                  Sahifaga kirish uchun{' '}
                  <strong style={{ color:'#c4b5fd' }}>PIN-kodni</strong> kiriting
                </div>
              </div>

              <div style={{ display:'flex', gap:12, justifyContent:'center', marginBottom:20 }}>
                {pin.map((v, i) => (
                  <input key={i} ref={el => inputs.current[i] = el}
                    type="password" inputMode="numeric" maxLength={1} value={v}
                    autoFocus={i === 0}
                    onChange={e => handleChange(i, e.target.value)}
                    onKeyDown={e => handleKeyDown(i, e)}
                    onPaste={i === 0 ? handlePaste : undefined}
                    className={`pg-pin${v ? ' pg-pin-filled' : ''}${error ? ' pg-pin-error' : ''}`}
                  />
                ))}
              </div>

              {error && <div className="pg-error">{error}</div>}

              <button onClick={submit} disabled={loading || !filled}
                className={`pg-btn${filled && !loading ? ' pg-btn-active' : ''}`}>
                {loading ? '⏳ Tekshirilmoqda...' : '🔓 Shajarani ochish'}
              </button>

              <div style={{ marginTop:16, textAlign:'center', fontSize:11, color:'rgba(100,116,139,0.8)' }}>
                5 daqiqa faoliyatsizlikdan keyin qayta so'raladi
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════
   CSS
══════════════════════════════════════════════════════════ */
const CSS = `
.pg-bg {
  position: absolute; inset: 0;
  background: radial-gradient(ellipse at 20% 30%, #1a0a3d 0%, #0a051a 40%, #070412 100%);
  animation: pgBgPulse 8s ease-in-out infinite alternate;
}
@keyframes pgBgPulse {
  from { background: radial-gradient(ellipse at 20% 30%, #1a0a3d 0%, #0a051a 40%, #070412 100%) }
  to   { background: radial-gradient(ellipse at 75% 65%, #0d1a3d 0%, #0a0c1a 40%, #060410 100%) }
}

.pg-orb { position: absolute; border-radius: 50%; filter: blur(60px); pointer-events: none; }
.pg-orb1 {
  width:480px; height:480px; top:-120px; left:-100px;
  background: radial-gradient(circle, rgba(79,46,220,0.28) 0%, transparent 70%);
  animation: orbDrift1 12s ease-in-out infinite alternate;
}
.pg-orb2 {
  width:380px; height:380px; bottom:-80px; right:-80px;
  background: radial-gradient(circle, rgba(139,92,246,0.22) 0%, transparent 70%);
  animation: orbDrift2 10s ease-in-out infinite alternate;
}
.pg-orb3 {
  width:260px; height:260px; top:30%; right:12%;
  background: radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 70%);
  animation: orbDrift3 14s ease-in-out infinite alternate;
}
.pg-orb4 {
  width:200px; height:200px; bottom:20%; left:8%;
  background: radial-gradient(circle, rgba(99,102,241,0.18) 0%, transparent 70%);
  animation: orbDrift1 9s 2s ease-in-out infinite alternate;
}
@keyframes orbDrift1 { from{transform:translate(0,0) scale(1)} to{transform:translate(60px,40px) scale(1.15)} }
@keyframes orbDrift2 { from{transform:translate(0,0) scale(1)} to{transform:translate(-50px,-30px) scale(1.1)} }
@keyframes orbDrift3 { from{transform:translate(0,0) scale(1)} to{transform:translate(-40px,50px) scale(1.2)} }

.pg-particle {
  position: absolute; bottom: -10px; border-radius: 50%;
  background: rgba(167,139,250,0.6);
  animation: pgFloat linear infinite;
  box-shadow: 0 0 6px 1px rgba(167,139,250,0.4);
}
@keyframes pgFloat {
  0%   { transform: translateY(0) scale(1);        opacity: 0 }
  10%  { opacity: 1 }
  90%  { opacity: 0.3 }
  100% { transform: translateY(-100vh) scale(0.3); opacity: 0 }
}

.pg-tree-wrap {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  opacity: 0.5; pointer-events: none; z-index: 0;
}
.pg-edge-base {
  stroke-dasharray: 300; stroke-dashoffset: 300;
  animation: drawLine 1.2s ease forwards;
}
@keyframes drawLine { to { stroke-dashoffset: 0 } }
.pg-edge-flow { animation: flowDash linear infinite; }
@keyframes flowDash { from{stroke-dashoffset:64} to{stroke-dashoffset:0} }
.pg-node-halo { animation: haloPulse ease-in-out infinite alternate; }
@keyframes haloPulse { from{opacity:0.15} to{opacity:0.6} }

/* Node group fade-in */
.pg-node-g {
  animation: nodeFadeIn 0.6s cubic-bezier(0.34,1.5,0.64,1) both;
}
@keyframes nodeFadeIn {
  from { opacity:0; transform: scale(0.4) }
  to   { opacity:1; transform: scale(1)   }
}

/* Node circle pulse (erkak = indigo, ayol = pink) */
.pg-node {
  animation: nodeGlow 2.8s ease-in-out infinite alternate;
}
@keyframes nodeGlow {
  from { opacity:0.75 }
  to   { opacity:1; filter:url(#glow2) }
}

/* Icon text fade-in with node */
.pg-icon-text {
  animation: iconAppear 0.7s ease both;
}
@keyframes iconAppear {
  from { opacity:0 }
  to   { opacity:0.92 }
}

.pg-node-ring { animation: ringPulse 2.2s ease-in-out infinite; }
@keyframes ringPulse {
  0%,100%{ opacity:0.3; r:32px }
  50%    { opacity:0.85; r:43px }
}
/* Kichik nodes uchun aylanuvchi ring */
.pg-node-ring-small { animation: ringSmall 3s ease-in-out infinite alternate; }
@keyframes ringSmall {
  from { opacity:0.25; transform:scale(0.95) }
  to   { opacity:0.7;  transform:scale(1.08) }
}

/* ── Card ── */
.pg-card {
  position: relative; z-index: 2;
  width: 100%; max-width: 420px;
  background: rgba(10,8,30,0.85);
  border-radius: 28px; padding: 32px 30px 28px;
  border: 1px solid rgba(167,139,250,0.2);
  box-shadow: 0 0 0 1px rgba(99,102,241,0.15), 0 40px 80px rgba(0,0,0,0.7),
              inset 0 1px 0 rgba(255,255,255,0.05);
  backdrop-filter: blur(28px);
  animation: cardIn 0.4s cubic-bezier(0.34,1.4,0.64,1);
  transition: box-shadow 0.3s;
}
.pg-card:hover {
  box-shadow: 0 0 0 1px rgba(139,92,246,0.3), 0 40px 90px rgba(0,0,0,0.75),
              inset 0 1px 0 rgba(255,255,255,0.06), 0 0 40px rgba(99,102,241,0.12);
}
@keyframes cardIn {
  from { opacity:0; transform: translateY(30px) scale(0.93) }
  to   { opacity:1; transform: translateY(0) scale(1) }
}
.pg-shake { animation: pgShake 0.45s ease !important }
@keyframes pgShake {
  0%,100%{transform:translateX(0)} 18%{transform:translateX(-12px)}
  38%{transform:translateX(12px)}  58%{transform:translateX(-8px)}
  78%{transform:translateX(8px)}
}
.pg-success-card {
  animation: successScale 0.85s cubic-bezier(0.34,1.4,0.64,1) forwards !important;
  background: rgba(5,40,25,0.9) !important;
  border-color: rgba(16,185,129,0.4) !important;
}
@keyframes successScale {
  0%  { transform:scale(1);    opacity:1 }
  50% { transform:scale(1.07); opacity:1 }
  100%{ transform:scale(0.88); opacity:0 }
}

/* ── Logo ── */
.pg-logo {
  width:72px; height:72px; border-radius:22px; margin:0 auto 16px;
  background:linear-gradient(135deg,#4f46e5,#7c3aed,#6366f1);
  display:flex; align-items:center; justify-content:center; font-size:36px;
  box-shadow:0 8px 32px rgba(99,102,241,0.55),0 0 0 1px rgba(167,139,250,0.2);
  animation:logoFloat 3s ease-in-out infinite;
}
@keyframes logoFloat {
  0%,100%{transform:translateY(0) rotate(-1deg)}
  50%    {transform:translateY(-6px) rotate(1deg)}
}

.pg-family-name {
  font-size:22px; font-weight:900; letter-spacing:-0.3px; line-height:1.2;
  background:linear-gradient(135deg,#c4b5fd 0%,#a78bfa 30%,#818cf8 60%,#c4b5fd 100%);
  background-size:200% 100%;
  -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text;
  animation:nameShimmer 3.5s linear infinite; margin-bottom:6px;
}
@keyframes nameShimmer {
  0%  {background-position:200% center}
  100%{background-position:-200% center}
}

.pg-shajarasi { display:flex; align-items:center; justify-content:center; gap:6px; margin-bottom:4px; }
.pg-shajarasi-text {
  font-size:11px; font-weight:800; letter-spacing:4px;
  color:rgba(167,139,250,0.7); text-transform:uppercase;
}
.pg-star {
  color:#a78bfa; font-size:10px; animation:starSpin 4s linear infinite; display:inline-block;
}
.pg-star:last-child { animation-direction:reverse }
@keyframes starSpin {
  from{transform:rotate(0deg) scale(1)} 50%{transform:rotate(180deg) scale(1.3)}
  to{transform:rotate(360deg) scale(1)}
}

.pg-divider {
  height:1px; margin:14px auto 0; width:70%;
  background:linear-gradient(90deg,transparent,rgba(139,92,246,0.5),transparent);
  animation:divGlow 2.5s ease-in-out infinite alternate;
}
@keyframes divGlow { from{opacity:0.4;width:50%} to{opacity:1;width:80%} }

/* ── PIN inputs ── */
.pg-pin {
  width:58px; height:66px; text-align:center; font-size:28px; font-weight:900;
  border-radius:16px; outline:none; border:2px solid rgba(99,102,241,0.2);
  background:rgba(15,10,40,0.8); color:#f1f5f9;
  transition:border-color 0.15s,box-shadow 0.15s,transform 0.15s;
  box-shadow:inset 0 1px 3px rgba(0,0,0,0.3);
}
.pg-pin:focus {
  border-color:rgba(139,92,246,0.7);
  box-shadow:0 0 0 3px rgba(99,102,241,0.2),inset 0 1px 3px rgba(0,0,0,0.3);
  transform:scale(1.06);
}
.pg-pin-filled {
  border-color:rgba(139,92,246,0.85) !important;
  box-shadow:0 0 0 4px rgba(99,102,241,0.22),0 0 12px rgba(139,92,246,0.4),inset 0 1px 3px rgba(0,0,0,0.3) !important;
}
.pg-pin-error { border-color:rgba(239,68,68,0.7) !important }

.pg-error {
  margin-bottom:14px; padding:9px 14px; border-radius:12px;
  background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.3);
  color:#f87171; font-size:13px; font-weight:600; text-align:center;
}

/* ── Button ── */
.pg-btn {
  width:100%; padding:14px; border-radius:16px; border:none; cursor:default;
  background:rgba(30,20,60,0.8); color:rgba(100,116,139,0.6);
  font-size:15px; font-weight:800; transition:all 0.2s; letter-spacing:0.02em;
  position:relative; overflow:hidden;
}
.pg-btn-active {
  cursor:pointer;
  background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 50%,#6366f1 100%);
  background-size:200% 100%; color:white;
  box-shadow:0 6px 28px rgba(99,102,241,0.55);
  animation:btnGradShift 3s linear infinite;
}
.pg-btn-active:hover { transform:translateY(-2px); box-shadow:0 10px 36px rgba(99,102,241,0.7); }
.pg-btn-active:active { transform:translateY(0) }
@keyframes btnGradShift {
  0%,100%{background-position:0% center} 50%{background-position:100% center}
}
.pg-btn-active::after {
  content:''; position:absolute; inset:0;
  background:linear-gradient(105deg,transparent 30%,rgba(255,255,255,0.12) 50%,transparent 70%);
  background-size:200% 100%; animation:btnShimmer 2.5s linear infinite;
}
@keyframes btnShimmer {
  0%  {background-position:200% center}
  100%{background-position:-200% center}
}

.pg-success-icon {
  width:80px; height:80px; border-radius:50%; margin:0 auto;
  background:linear-gradient(135deg,#10b981,#059669);
  display:flex; align-items:center; justify-content:center;
  font-size:40px; color:white; font-weight:900;
  box-shadow:0 0 0 20px rgba(16,185,129,0.15),0 8px 32px rgba(16,185,129,0.5);
  animation:successPop 0.5s cubic-bezier(0.34,1.6,0.64,1);
}
@keyframes successPop {
  from{transform:scale(0);opacity:0}
  to{transform:scale(1);opacity:1}
}
`
