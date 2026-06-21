/**
 * OnboardingWizard — yangi foydalanuvchi uchun 4 bosqichli yo'llanma
 * Bosqichlar:
 *   0 — Xush kelibsiz (imkoniyatlar + statistika)
 *   1 — O'zingizni qo'shing (asosiy shaxs)
 *   2 — Birinchi qarindoshni qo'shing (ixtiyoriy)
 *   3 — Tabriklaymiz + keyingi qadamlar
 */
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { createPersonJSON } from '../api/persons'
import toast from 'react-hot-toast'
import useThemeStore from '../store/themeStore'
import { validatePersonForm, firstApiError } from '../utils/errorMessages'

/* ── Doimiy ma'lumotlar ──────────────────────────────────── */
const FEATURES = [
  { icon:'🌳', color:'#6366f1', title:'Shajara daraxti',     desc:'Oilangizni vizual, interaktiv ko\'rinishda ko\'ring' },
  { icon:'👥', color:'#10b981', title:'Shaxs profillari',    desc:'Har bir a\'zo uchun tarix, rasm, sanalar' },
  { icon:'🔗', color:'#f59e0b', title:'Qarindoshlik yo\'li', desc:'Ikki shaxs orasidagi aloqani avtomatik hisoblang' },
  { icon:'📊', color:'#ec4899', title:'Statistika',          desc:'Avlodlar, yosh piramidasi, xarita' },
  { icon:'💍', color:'#8b5cf6', title:'Ko\'p oila',          desc:'Bir nechta nikoh va murakkab oila tuzilmalari' },
  { icon:'📱', color:'#0ea5e9', title:'PWA — telefonga o\'rnat', desc:'Oflayn ishlaydi, uyga ekranga qo\'shing' },
]

const TIPS = [
  { icon:'💡', text:"Daraxtda bir shaxsni bosing — to'liq profil ochiladi" },
  { icon:'🔍', text:"Persons sahifasida istalgan a'zoni qidiring" },
  { icon:'📅', text:"Bosh sahifada shu oy tug'ilgan kunlar ko'rinadi" },
  { icon:'🗺️', text:"Statistika → Xarita: tug'ilgan joylar xaritada" },
]

/* ── Maydon komponenti ───────────────────────────────────── */
function Inp({ label, required, children }) {
  return (
    <div>
      <label style={{ fontSize:11, fontWeight:700, letterSpacing:'.05em',
        textTransform:'uppercase', display:'block', marginBottom:5,
        color:'var(--ow-secondary)' }}>
        {label}{required && <span style={{ color:'#ef4444', marginLeft:2 }}>*</span>}
      </label>
      {children}
    </div>
  )
}

/* ── Asosiy komponent ────────────────────────────────────── */
export default function OnboardingWizard({ onComplete }) {
  const [step,    setStep]    = useState(0)
  const [animDir, setAnimDir] = useState(1)   // 1=forward, -1=back
  const [visible, setVisible] = useState(true)

  // Step 1 — o'zim
  const [me, setMe] = useState({
    last_name:'', first_name:'', gender:'male', birth_date:'', birth_place:''
  })
  // Step 2 — birinchi qarindosh (ixtiyoriy)
  const [rel, setRel] = useState({
    last_name:'', first_name:'', gender:'male', relation:'father'
  })

  const [loading, setLoading] = useState(false)
  const [myId,    setMyId]    = useState(null)
  const [featIdx, setFeatIdx] = useState(0)
  const featTimer = useRef(null)

  const navigate   = useNavigate()
  const { isDark } = useThemeStore()

  /* ── Feature carousel ─────────────────── */
  useEffect(() => {
    if (step !== 0) return
    featTimer.current = setInterval(() => setFeatIdx(i => (i+1) % FEATURES.length), 2200)
    return () => clearInterval(featTimer.current)
  }, [step])

  /* ── CSS vars ─────────────────────────── */
  const bg        = isDark ? '#1e293b' : '#ffffff'
  const bgDeep    = isDark ? '#0f172a' : '#f8fafc'
  const border    = isDark ? '#334155' : '#e2e8f0'
  const primary   = isDark ? '#f1f5f9' : '#0f172a'
  const secondary = isDark ? '#94a3b8' : '#64748b'
  const inputBg   = isDark ? '#0f172a' : '#f8fafc'

  /* ── Navigatsiya ─────────────────────── */
  const go = (dir) => {
    setAnimDir(dir)
    setVisible(false)
    setTimeout(() => { setStep(s => s + dir); setVisible(true) }, 180)
  }

  /* ── Step 1: O'zimni saqlash ─────────── */
  const saveSelf = async () => {
    const err = validatePersonForm(me)
    if (err) { toast.error(err); return }
    setLoading(true)
    try {
      const res = await createPersonJSON({
        first_name:  me.first_name.trim(),
        last_name:   me.last_name.trim(),
        gender:      me.gender,
        birth_date:  me.birth_date || null,
        birth_place: me.birth_place.trim() || '',
      })
      setMyId(res.data.id)
      toast.success("✅ O'zingiz qo'shildingiz!")
      go(1)
    } catch (e) {
      toast.error(firstApiError(e))
    } finally { setLoading(false) }
  }

  /* ── Step 2: Qarindoshni saqlash ─────── */
  const saveRelative = async () => {
    if (!rel.first_name.trim() || !rel.last_name.trim()) {
      toast.error('Ism va familiya to\'ldirilishi kerak')
      return
    }
    setLoading(true)
    try {
      // Munosabatga qarab ota/ona bog'lash
      const isFather = rel.relation === 'father'
      const isMother = rel.relation === 'mother'
      const isChild  = rel.relation === 'child'

      const payload = {
        first_name: rel.first_name.trim(),
        last_name:  rel.last_name.trim(),
        gender:     rel.gender,
        birth_date: null,
        father: (isChild && myId) ? myId : null,   // agar farzand bo'lsa men ota bo'laman
        mother: null,
      }

      const res = await createPersonJSON(payload)
      const relId = res.data.id

      // Agar ota/ona bo'lsa — meni ularning farzandi qilib yangilash kerak
      if ((isFather || isMother) && myId) {
        const { updatePersonJSON } = await import('../api/persons')
        const patch = isFather ? { father: relId } : { mother: relId }
        await updatePersonJSON(myId, patch).catch(() => {})
      }

      toast.success('✅ Qarindosh qo\'shildi!')
      go(1)
    } catch (e) {
      toast.error(firstApiError(e))
    } finally { setLoading(false) }
  }

  const finish = (dest) => {
    localStorage.setItem('onboarding_done', '1')
    onComplete()
    navigate(dest)
  }

  /* ── Input style ─────────────────────── */
  const inp = {
    width:'100%', padding:'10px 12px', borderRadius:10, fontSize:13,
    border:`1.5px solid ${border}`, background:inputBg, color:primary,
    outline:'none', transition:'border-color .15s', boxSizing:'border-box',
  }
  const inpFocus = e => e.target.style.borderColor = '#6366f1'
  const inpBlur  = e => e.target.style.borderColor = border

  /* ── Gender toggle ───────────────────── */
  const GenderToggle = ({ val, onChange }) => (
    <div style={{ display:'flex', gap:8 }}>
      {[['male','👨 Erkak','#6366f1'],['female','👩 Ayol','#ec4899']].map(([v,l,c]) => (
        <button key={v} type="button" onClick={() => onChange(v)}
          style={{ flex:1, padding:'9px', borderRadius:10, cursor:'pointer',
            fontSize:13, fontWeight:700, border:`2px solid ${val===v ? c : border}`,
            background: val===v ? (isDark ? `${c}22` : `${c}10`) : inputBg,
            color: val===v ? c : secondary, transition:'all .15s' }}>
          {l}
        </button>
      ))}
    </div>
  )

  /* ── Progress bar ────────────────────── */
  const TOTAL = 4
  const pct   = Math.round((step / (TOTAL-1)) * 100)

  /* ── Step gradients ──────────────────── */
  const GRADS = [
    'linear-gradient(135deg,#3b82f6 0%,#6366f1 50%,#7c3aed 100%)',
    'linear-gradient(135deg,#10b981 0%,#059669 100%)',
    'linear-gradient(135deg,#f59e0b 0%,#d97706 100%)',
    'linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%)',
  ]
  const EMOJIS  = ['🌳','👤','👨‍👩‍👦','🎉']
  const TITLES  = [
    'Oila Shajarasiga xush kelibsiz!',
    "O'zingizni qo'shing",
    "Birinchi a'zoni qo'shing",
    'Tabriklaymiz! 🥳',
  ]
  const SUBS = [
    "Oilangizning butun tarixini saqlash va ko'rish uchun eng qulay tizim",
    "Shajarani o'zingizdan boshlang — birinchi shaxs sifatida qo'shing",
    "Ota, ona yoki farzandingizni qo'shing (ixtiyoriy — o'tkazib yuborish mumkin)",
    "Endi oila a'zolarini qo'shib, shajarangizni to'ldiring!",
  ]

  return (
    <div style={{
      position:'fixed', inset:0, zIndex:9999,
      display:'flex', alignItems:'center', justifyContent:'center',
      background: isDark ? 'rgba(2,8,23,0.88)' : 'rgba(15,23,42,0.72)',
      backdropFilter:'blur(14px)', padding:16,
    }}>
      <style>{`
        @keyframes owSlideIn {
          from { opacity:0; transform:translateY(16px) scale(.97) }
          to   { opacity:1; transform:translateY(0)   scale(1)    }
        }
        @keyframes owFadeIn  { from{opacity:0} to{opacity:1} }
        .ow-body { animation: owSlideIn .22s cubic-bezier(.34,1.56,.64,1) }
        .ow-step { transition: opacity .18s, transform .18s }
        .ow-step.hidden { opacity:0; transform:translateY(8px) }
        .ow-btn-primary {
          width:100%; padding:13px; border-radius:14px; border:none; cursor:pointer;
          font-size:14px; font-weight:800; color:white;
          transition: transform .2s cubic-bezier(.34,1.56,.64,1), box-shadow .18s;
        }
        .ow-btn-primary:hover:not(:disabled) { transform:translateY(-2px); box-shadow:0 8px 24px rgba(0,0,0,.22) }
        .ow-btn-primary:disabled { opacity:.55; cursor:default }
        .ow-btn-ghost {
          width:100%; padding:10px; border-radius:12px; border:none; cursor:pointer;
          font-size:12.5px; font-weight:600; background:transparent;
          transition: background .13s;
        }
        .ow-feat-dot { width:6px; height:6px; border-radius:3px; transition:all .22s }
        .ow-tip { animation: owFadeIn .3s }
      `}</style>

      <div className="ow-body" style={{
        background:bg, borderRadius:28, width:'100%', maxWidth:500,
        overflow:'hidden',
        boxShadow:'0 32px 100px rgba(0,0,0,.45), 0 0 0 1px rgba(255,255,255,.07)',
        '--ow-primary':primary, '--ow-secondary':secondary,
      }}>

        {/* ── Progress bar ── */}
        <div style={{ height:4, background:isDark?'#334155':'#f1f5f9' }}>
          <div style={{ height:'100%', width:`${pct}%`, borderRadius:2,
            background:'linear-gradient(90deg,#3b82f6,#6366f1)',
            transition:'width .4s cubic-bezier(.34,1.56,.64,1)' }}/>
        </div>

        {/* ── Hero ── */}
        <div style={{
          background: GRADS[step], padding:'28px 24px 22px',
          textAlign:'center', position:'relative', overflow:'hidden',
          transition:'background .5s',
        }}>
          {[{t:-40,r:-40,s:140},{b:-30,l:-20,s:100}].map((d,i) => (
            <div key={i} style={{
              position:'absolute', borderRadius:'50%', pointerEvents:'none',
              background:'rgba(255,255,255,.08)',
              top:d.t, right:d.r, bottom:d.b, left:d.l,
              width:d.s, height:d.s,
            }}/>
          ))}
          <div style={{ fontSize:52, marginBottom:10,
            filter:'drop-shadow(0 4px 12px rgba(0,0,0,.2))',
            transition:'all .3s', display:'inline-block' }}>
            {EMOJIS[step]}
          </div>
          <div style={{ fontSize:18, fontWeight:900, color:'white',
            textShadow:'0 2px 8px rgba(0,0,0,.2)', marginBottom:5 }}>
            {TITLES[step]}
          </div>
          <div style={{ fontSize:12.5, color:'rgba(255,255,255,.82)',
            maxWidth:360, margin:'0 auto', lineHeight:1.55 }}>
            {SUBS[step]}
          </div>

          {/* Step indicator pills */}
          <div style={{ display:'flex', gap:6, justifyContent:'center', marginTop:14 }}>
            {Array.from({length:TOTAL}).map((_,i) => (
              <div key={i} className="ow-feat-dot"
                style={{ background: i===step ? 'white' : 'rgba(255,255,255,.4)',
                  width: i===step ? 20 : 6 }}/>
            ))}
          </div>
        </div>

        {/* ── Body ── */}
        <div className={`ow-step ${visible?'':'hidden'}`}
          style={{ padding:'22px 22px 20px' }}>

          {/* ══ STEP 0: Xush kelibsiz ══ */}
          {step === 0 && (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {/* Feature carousel */}
              <div style={{ borderRadius:16, overflow:'hidden',
                border:`1.5px solid ${border}`, minHeight:76 }}>
                {FEATURES.map((f, i) => (
                  <div key={i} style={{
                    display: i===featIdx ? 'flex' : 'none',
                    alignItems:'center', gap:13, padding:'14px 16px',
                    background:bgDeep, animation:'owFadeIn .3s',
                  }}>
                    <div style={{ width:44, height:44, borderRadius:13, flexShrink:0,
                      background:`${f.color}18`, display:'flex', alignItems:'center',
                      justifyContent:'center', fontSize:22, border:`1.5px solid ${f.color}30` }}>
                      {f.icon}
                    </div>
                    <div>
                      <div style={{ fontSize:13, fontWeight:800, color:primary, marginBottom:2 }}>{f.title}</div>
                      <div style={{ fontSize:11.5, color:secondary, lineHeight:1.4 }}>{f.desc}</div>
                    </div>
                  </div>
                ))}
                {/* Dots */}
                <div style={{ display:'flex', gap:5, justifyContent:'center',
                  padding:'8px 0', borderTop:`1px solid ${border}` }}>
                  {FEATURES.map((_,i) => (
                    <div key={i} onClick={() => setFeatIdx(i)}
                      style={{ width: i===featIdx?14:5, height:5, borderRadius:3, cursor:'pointer',
                        background: i===featIdx ? '#6366f1' : (isDark?'#334155':'#e2e8f0'),
                        transition:'all .22s' }}/>
                  ))}
                </div>
              </div>

              {/* Quick stats bar */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
                {[['🆓','Bepul','To\'liq imkoniyat'],['🔒','Xavfsiz','Faqat sizniki'],['⚡','Tez','Real-time sinxron']].map(([ic,t,d]) => (
                  <div key={t} style={{ textAlign:'center', padding:'10px 6px',
                    borderRadius:12, background:bgDeep, border:`1px solid ${border}` }}>
                    <div style={{ fontSize:20 }}>{ic}</div>
                    <div style={{ fontSize:12, fontWeight:800, color:primary, marginTop:3 }}>{t}</div>
                    <div style={{ fontSize:9.5, color:secondary, marginTop:1 }}>{d}</div>
                  </div>
                ))}
              </div>

              <button className="ow-btn-primary"
                style={{ background:GRADS[0], boxShadow:'0 6px 22px rgba(99,102,241,.4)' }}
                onClick={() => go(1)}>
                Boshlash →
              </button>
              <button className="ow-btn-ghost" style={{ color:secondary }}
                onClick={() => finish('/')}>
                Hozircha o'tkazib yuborish
              </button>
            </div>
          )}

          {/* ══ STEP 1: O'zimni qo'shish ══ */}
          {step === 1 && (
            <div style={{ display:'flex', flexDirection:'column', gap:11 }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:9 }}>
                <Inp label="Familiya" required>
                  <input autoFocus value={me.last_name}
                    onChange={e => setMe(m=>({...m,last_name:e.target.value}))}
                    placeholder="Karimov" style={inp}
                    onFocus={inpFocus} onBlur={inpBlur}
                    onKeyDown={e => e.key==='Enter' && saveSelf()} />
                </Inp>
                <Inp label="Ism" required>
                  <input value={me.first_name}
                    onChange={e => setMe(m=>({...m,first_name:e.target.value}))}
                    placeholder="Abdulloh" style={inp}
                    onFocus={inpFocus} onBlur={inpBlur}
                    onKeyDown={e => e.key==='Enter' && saveSelf()} />
                </Inp>
              </div>

              <Inp label="Jins" required>
                <GenderToggle val={me.gender} onChange={v => setMe(m=>({...m,gender:v}))} />
              </Inp>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:9 }}>
                <Inp label="Tug'ilgan yil">
                  <input type="date" value={me.birth_date}
                    onChange={e => setMe(m=>({...m,birth_date:e.target.value}))}
                    style={inp} onFocus={inpFocus} onBlur={inpBlur} />
                </Inp>
                <Inp label="Tug'ilgan joy">
                  <input value={me.birth_place}
                    onChange={e => setMe(m=>({...m,birth_place:e.target.value}))}
                    placeholder="Toshkent..." style={inp}
                    onFocus={inpFocus} onBlur={inpBlur} />
                </Inp>
              </div>

              {/* Help hint */}
              <div style={{ padding:'9px 12px', borderRadius:10,
                background: isDark ? '#1c2534' : '#f0fdf4',
                border:`1px solid ${isDark?'#334155':'#bbf7d0'}`,
                fontSize:11.5, color: isDark?'#6ee7b7':'#166534',
                display:'flex', gap:8, alignItems:'flex-start' }}>
                <span style={{ flexShrink:0, marginTop:1 }}>💡</span>
                <span>Keyinroq istalgan vaqtda profil sahifasida to'ldirishingiz mumkin — hozir faqat ism-familiya yetarli.</span>
              </div>

              <div style={{ display:'flex', gap:8, marginTop:4 }}>
                <button className="ow-btn-ghost"
                  style={{ color:secondary, border:`1.5px solid ${border}`, width:'auto', padding:'12px 18px', borderRadius:12 }}
                  onClick={() => go(-1)}>← Orqaga</button>
                <button className="ow-btn-primary" disabled={loading}
                  style={{ background:GRADS[1], boxShadow:'0 6px 20px rgba(16,185,129,.38)' }}
                  onClick={saveSelf}>
                  {loading ? '⏳ Saqlanmoqda...' : '✅ Davom etish →'}
                </button>
              </div>
            </div>
          )}

          {/* ══ STEP 2: Birinchi qarindosh (ixtiyoriy) ══ */}
          {step === 2 && (
            <div style={{ display:'flex', flexDirection:'column', gap:11 }}>
              {/* Munosabat tanlash */}
              <Inp label="Munosabat turi">
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:7 }}>
                  {[
                    {v:'father', l:'👨 Otam',    c:'#6366f1'},
                    {v:'mother', l:'👩 Onam',    c:'#ec4899'},
                    {v:'child',  l:'👶 Farzand', c:'#10b981'},
                  ].map(({v,l,c}) => (
                    <button key={v} type="button" onClick={() => setRel(r=>({...r,relation:v,gender:v==='mother'?'female':'male'}))}
                      style={{ padding:'9px 6px', borderRadius:10, cursor:'pointer',
                        fontSize:12, fontWeight:700, textAlign:'center',
                        border:`2px solid ${rel.relation===v ? c : border}`,
                        background: rel.relation===v ? (isDark?`${c}22`:`${c}10`) : inputBg,
                        color: rel.relation===v ? c : secondary, transition:'all .15s' }}>
                      {l}
                    </button>
                  ))}
                </div>
              </Inp>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:9 }}>
                <Inp label="Familiya" required>
                  <input value={rel.last_name}
                    onChange={e => setRel(r=>({...r,last_name:e.target.value}))}
                    placeholder="Karimov" style={inp}
                    onFocus={inpFocus} onBlur={inpBlur} />
                </Inp>
                <Inp label="Ism" required>
                  <input value={rel.first_name}
                    onChange={e => setRel(r=>({...r,first_name:e.target.value}))}
                    placeholder="Abdulloh" style={inp}
                    onFocus={inpFocus} onBlur={inpBlur}
                    onKeyDown={e => e.key==='Enter' && saveRelative()} />
                </Inp>
              </div>

              <Inp label="Jins">
                <GenderToggle val={rel.gender} onChange={v => setRel(r=>({...r,gender:v}))} />
              </Inp>

              <div style={{ display:'flex', gap:8, marginTop:4 }}>
                <button className="ow-btn-ghost"
                  style={{ color:secondary, border:`1.5px solid ${border}`, width:'auto', padding:'12px 18px', borderRadius:12 }}
                  onClick={() => go(-1)}>← Orqaga</button>
                <div style={{ flex:1, display:'flex', flexDirection:'column', gap:7 }}>
                  <button className="ow-btn-primary" disabled={loading}
                    style={{ background:GRADS[2], boxShadow:'0 6px 20px rgba(245,158,11,.38)' }}
                    onClick={saveRelative}>
                    {loading ? '⏳...' : "➕ Qo'shish →"}
                  </button>
                  <button className="ow-btn-ghost"
                    style={{ color:secondary, fontSize:12 }}
                    onClick={() => go(1)}>O'tkazib yuborish →</button>
                </div>
              </div>
            </div>
          )}

          {/* ══ STEP 3: Tabriklaymiz ══ */}
          {step === 3 && (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {/* Tips */}
              <div style={{ padding:'12px 14px', borderRadius:14,
                background:bgDeep, border:`1.5px solid ${border}`,
                display:'flex', flexDirection:'column', gap:8 }}>
                <div style={{ fontSize:11, fontWeight:800, color:'#6366f1',
                  textTransform:'uppercase', letterSpacing:'.07em', marginBottom:2 }}>
                  💡 Foydali maslahatlar
                </div>
                {TIPS.map((t,i) => (
                  <div key={i} className="ow-tip" style={{
                    display:'flex', gap:9, alignItems:'flex-start',
                    paddingBottom: i<TIPS.length-1 ? 8 : 0,
                    borderBottom: i<TIPS.length-1 ? `1px solid ${border}` : 'none',
                  }}>
                    <span style={{ fontSize:16, flexShrink:0 }}>{t.icon}</span>
                    <span style={{ fontSize:12, color:secondary, lineHeight:1.45 }}>{t.text}</span>
                  </div>
                ))}
              </div>

              {/* Action buttons */}
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                <button className="ow-btn-primary"
                  style={{ background:'linear-gradient(135deg,#4f46e5,#7c3aed)',
                    boxShadow:'0 6px 22px rgba(79,70,229,.4)' }}
                  onClick={() => finish('/persons/add')}>
                  ➕ Oila a'zosi qo'shish
                </button>
                <button className="ow-btn-primary"
                  style={{ background:'linear-gradient(135deg,#10b981,#059669)',
                    boxShadow:'0 6px 22px rgba(16,185,129,.35)' }}
                  onClick={() => finish('/tree')}>
                  🌳 Shajara daraxtini ko'rish
                </button>
                <button className="ow-btn-ghost"
                  style={{ color:secondary, border:`1px solid ${border}` }}
                  onClick={() => finish('/')}>
                  Bosh sahifaga o'tish
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
