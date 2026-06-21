/**
 * 🤖 Shajara AI Chat Widget
 * ─────────────────────────
 * Barcha sahifalarda float ko'rinishda mavjud.
 * - Gemini 1.5 Flash (bepul) orqali kontekst-aware javoblar
 * - Sahifani biladi, oila a'zolarini biladi
 * - Enable/Disable localStorage orqali
 * - Typewriter animatsiya
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { aiChat, getPersons, getStatistics } from '../api/persons'
import useAuthStore from '../store/authStore'
import useThemeStore from '../store/themeStore'
import useChatStore from '../store/chatStore'

// ── Sahifa nomlari ─────────────────────────────────────────────
const PAGE_NAMES = {
  '/':             '🏠 Bosh sahifa',
  '/tree':         '🌲 Shajara daraxti',
  '/persons':      '👥 Shaxslar ro\'yxati',
  '/persons/add':  '➕ Yangi shaxs qo\'shish',
  '/statistics':   '📊 Statistika',
  '/relationship': '🔗 Munosabat hisoblagich',
  '/my-profile':   '👤 Mening profilim',
  '/notifications':'🔔 Bildirishnomalar',
}

// ── Satr bo'yicha markdown-lite render ────────────────────────
function RenderText({ text }) {
  if (!text) return null
  const lines = text.split('\n')
  return (
    <span>
      {lines.map((line, li) => {
        // **bold**
        const parts = line.split(/(\*\*[^*]+\*\*)/)
        return (
          <span key={li}>
            {parts.map((p, pi) =>
              p.startsWith('**') && p.endsWith('**')
                ? <strong key={pi}>{p.slice(2, -2)}</strong>
                : <span key={pi}>{p}</span>
            )}
            {li < lines.length - 1 && <br />}
          </span>
        )
      })}
    </span>
  )
}

// ── Sana formatlash ────────────────────────────────────────────
function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })
}

// ── Suggested questions ────────────────────────────────────────
const SUGGESTIONS = [
  'Qanday yordam bera olasiz?',
  'Yangi shaxs qanday qo\'shiladi?',
  'Oila daraxtini ko\'rish',
  'Munosabatni qanday hisoblayman?',
  'Statistikamni ko\'rsating',
]

// ── Local fallback — API ishlamaganda ─────────────────────────
function localFallback(msg, ctx) {
  const m = msg.toLowerCase()
  const total = ctx?.total_persons || 0
  const persons = ctx?.persons || []

  if (m.includes('salom') || m.includes('assalom') || m.includes('hi') || m.includes('xayr'))
    return `Salom! 👋 Shajara AI yordamchisiman. Hozircha AI serveri ulanmagan, lekin ilovadan foydalanishda yordam bera olaman!`

  if (m.includes('necha') || m.includes('jami') || m.includes('soni') || m.includes('statistik'))
    return `📊 Hozir bazangizda **${total} ta a'zo** mavjud.\n\nBatafsil statistikani ko'rish uchun: Statistika sahifasiga o'ting.`

  if (m.includes('shaxs qo\'sh') || m.includes('yangi') || m.includes('qo\'sh') || m.includes('add'))
    return `➕ **Yangi shaxs qo\'shish:**\n\n1. Yon menyu → "Qo\'shish" tugmasini bosing\n2. Ism, familiya, jins kiriting\n3. Tug\'ilgan sana va joy (ixtiyoriy)\n4. Ota yoki onani tanlang\n5. "Saqlash" ni bosing ✅`

  if (m.includes('daraxt') || m.includes('tree') || m.includes('shajara ko\'r'))
    return `🌳 **Shajara daraxti:**\n\nYon menyu → "Daraxt" sahifasiga o\'ting.\n\n• Tugunlarni sichqoncha bilan torting\n• Kattalashtirish uchun scroll qiling\n• Shaxsni bosing — batafsil ma\'lumot chiqadi\n• Qidiruv orqali toping`

  if (m.includes('munosabat') || m.includes('qarindosh') || m.includes('nima bo\'ladi') || m.includes('kim bo\'ladi'))
    return `🔗 **Munosabat hisoblash:**\n\nYon menyu → "Munosabat" sahifasi.\n\n2 kishini tanlang — dastur ularning qarindoshlik munosabatini avtomatik hisoblab chiqadi.\n\nMasalan: "Aka-uka", "Amakivachcha", "Buviasining nevara" kabi.`

  if (m.includes('rasm') || m.includes('foto') || m.includes('photo'))
    return `📷 **Rasm yuklash:**\n\nShaxs tahrirlash sahifasida chap tomondagi avatar doirasiga bosing yoki rasm faylini tortib tashlang (drag & drop).\n\nQo\'llab-quvvatlanadigan formatlar: JPG, PNG, WebP`

  if (m.includes('o\'chir') || m.includes('delete'))
    return `🗑️ **Shaxsni o\'chirish:**\n\nShaxs tahrirlash sahifasiga o\'ting → yuqoridagi "O\'chirish" tugmasi.\n\n⚠️ Ehtiyot bo\'ling — o\'chirilgan ma\'lumotni tiklash mumkin emas!`

  if (m.includes('parol') || m.includes('kirish') || m.includes('login'))
    return `🔐 **Kirish muammosi:**\n\nAdmin panel → "Foydalanuvchilar" bo\'limida parolni o\'zgartirishingiz mumkin.\n\nYoki administrator bilan bog\'laning.`

  if (m.includes('yordam') || m.includes('help') || m.includes('nima qila'))
    return `🤖 **Mening imkoniyatlarim:**\n\n• Ilovadan foydalanish yo\'riqnomasi\n• Shajara daraxtini tushuntirish\n• Qarindoshlik munosabatlari\n• Shaxs qo\'shish/tahrirlash yo\'riqnomasi\n• Statistika ko\'rsatish\n\n_Hozircha AI serveri ulanmagan — asosiy savollarga javob bera olaman._`

  if (persons.length > 0 && (m.includes('top') || m.includes('kim') || m.includes('qaysi'))) {
    const found = persons.filter(p => p.name && m.includes(p.name.toLowerCase().split(' ')[0]))
    if (found.length > 0)
      return `👤 Topildim! **${found[0].name}**${found[0].birth_year ? ` (${found[0].birth_year})` : ''} — bazangizda mavjud.`
  }

  return `🤖 Tushundim! Lekin hozirda AI serveri ulanmagan.\n\nMen quyidagi savollarga javob bera olaman:\n• Shaxs qo'shish\n• Daraxt ko'rish\n• Munosabat hisoblash\n• Rasm yuklash\n• Statistika\n\nBoshqa savol bering! 😊`
}

// ── Main Widget ────────────────────────────────────────────────
export default function AiChatWidget() {
  const { user }        = useAuthStore()
  const { isDark }      = useThemeStore()
  const location        = useLocation()
  const navigate        = useNavigate()

  // Holat chatStore da saqlanadi — sahifalar orasida yo'qolmaydi
  const {
    open, setOpen,
    messages, addMessage, setMessages,
    enabled, setEnabled,
  } = useChatStore()
  const [input, setInput]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [typing, setTyping]     = useState('')
  const [typingFull, setTypingFull] = useState('')
  const [greeted, setGreeted]   = useState(false)
  const [totalPersons, setTotalPersons] = useState(0)
  const [personsList, setPersonsList]   = useState([])
  const [showSettings, setShowSettings] = useState(false)
  const [pulse, setPulse]       = useState(false)

  /* ── Salomlashuv bubble ── */
  const [bubbleVisible, setBubbleVisible] = useState(false)
  const [bubbleHidden,  setBubbleHidden]  = useState(false)
  const [bubbleText,    setBubbleText]    = useState('')
  const [bubbleTyped,   setBubbleTyped]   = useState('')
  const bubbleDismissedKey = 'shajara_ai_bubble_dismissed'

  const messagesEndRef = useRef(null)
  const inputRef       = useRef(null)
  const typingTimer    = useRef(null)

  // Zustand persist avtomatik saqlaydi — qo'shimcha localStorage kerak emas
  const toggleEnabled = useCallback(() => {
    const next = !enabled
    setEnabled(next)
    if (!next) setOpen(false)
  }, [enabled])

  // Load family data once
  useEffect(() => {
    if (!user) return
    getStatistics().then(r => setTotalPersons(r.data.total || 0)).catch(() => {})
    getPersons().then(r => {
      setPersonsList(
        (r.data || []).slice(0, 50).map(p => ({
          id:         p.id,
          name:       p.full_name,
          gender:     p.gender,
          birth_year: p.birth_date ? new Date(p.birth_date + 'T00:00:00').getFullYear() : null,
        }))
      )
    }).catch(() => {})
  }, [user])

  // Typewriter effect
  useEffect(() => {
    if (!typingFull) return
    setTyping('')
    let i = 0
    clearInterval(typingTimer.current)
    typingTimer.current = setInterval(() => {
      i++
      setTyping(typingFull.slice(0, i))
      if (i >= typingFull.length) {
        clearInterval(typingTimer.current)
        // Replace last "typing" message with full
        setMessages(prev => {
          const arr = [...prev]
          if (arr[arr.length - 1]?.typing) {
            arr[arr.length - 1] = { ...arr[arr.length - 1], text: typingFull, typing: false }
          }
          return arr
        })
        setTypingFull('')
        setTyping('')
      } else {
        setMessages(prev => {
          const arr = [...prev]
          if (arr[arr.length - 1]?.typing) {
            arr[arr.length - 1] = { ...arr[arr.length - 1], text: typingFull.slice(0, i) }
          }
          return arr
        })
      }
    }, 16)
    return () => clearInterval(typingTimer.current)
  }, [typingFull])

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, typing])

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 200)
      // Greet on first open
      if (!greeted && messages.length === 0) {
        setGreeted(true)
        const name = user?.first_name || user?.username || 'Do\'stim'
        const greetText = `Salom, ${name}! 👋 Men Shajara AI yordamchisiman.\n\nOilangizda hozircha **${totalPersons} ta a'zo** bor. Menga quyidagilarda yordam so'rashingiz mumkin:\n• Shaxs topish va ma'lumot olish\n• Qarindoshlik munosabatini hisoblash\n• Ilovadan foydalanish yo'riqnomasi\n• Yangi a'zo qo'shish bo'yicha maslahat\n\nQanday yordam kerak?`
        const aiMsg = { role: 'assistant', text: greetText, ts: Date.now(), typing: true }
        setMessages([aiMsg])
        setTypingFull(greetText)
      }
    }
  }, [open])

  /* ── Sahifa ochilganda salomlashuv bubble ── */
  useEffect(() => {
    if (!enabled || !user) return
    // Bir sessiyada bir marta ko'rsatish
    if (sessionStorage.getItem(bubbleDismissedKey)) return
    if (open) return

    const name = user?.first_name || user?.username || "Do'stim"
    const fullText = `Assalomu alaykum! 👋\nSizga qanday yordam berishim mumkin?`

    const showTimer = setTimeout(() => {
      setBubbleText(fullText)
      setBubbleVisible(true)
      setBubbleTyped('')

      // Typewriter
      let i = 0
      const interval = setInterval(() => {
        i++
        setBubbleTyped(fullText.slice(0, i))
        if (i >= fullText.length) clearInterval(interval)
      }, 28)

      // 8 sekunddan keyin avtomatik yopish
      const hideTimer = setTimeout(() => {
        setBubbleHidden(true)
        setTimeout(() => { setBubbleVisible(false); setBubbleHidden(false) }, 400)
        sessionStorage.setItem(bubbleDismissedKey, '1')
      }, 8000)

      return () => { clearInterval(interval); clearTimeout(hideTimer) }
    }, 1800)

    return () => clearTimeout(showTimer)
  }, [enabled, user])

  /* bubble yopish */
  const dismissBubble = () => {
    setBubbleHidden(true)
    setTimeout(() => { setBubbleVisible(false); setBubbleHidden(false) }, 350)
    sessionStorage.setItem(bubbleDismissedKey, '1')
  }

  /* Pulse when chat closed and new message */
  const triggerPulse = useCallback(() => {
    if (!open) { setPulse(true); setTimeout(() => setPulse(false), 2000) }
  }, [open])

  const currentPage = (() => {
    const path = location.pathname
    if (path.match(/^\/persons\/\d+\/edit/)) return '✏️ Shaxs tahrirlash'
    if (path.match(/^\/persons\/\d+/))       return '👤 Shaxs profili'
    return PAGE_NAMES[path] || path
  })()

  const sendMessage = useCallback(async (text) => {
    const msg = (text || input).trim()
    if (!msg || loading) return
    setInput('')

    const userMsg = { role: 'user', text: msg, ts: Date.now() }
    const aiMsg   = { role: 'assistant', text: '...', ts: Date.now() + 1, typing: true }
    setMessages(prev => [...prev, userMsg, aiMsg])
    setLoading(true)

    try {
      const r = await aiChat({
        message: msg,
        history: messages.filter(m => !m.typing).slice(-10).map(m => ({
          role: m.role, text: m.text,
        })),
        context: {
          page:          currentPage,
          total_persons: totalPersons,
          persons:       personsList,
        },
      })
      const responseText = r.data.text || 'Javob olishda xato.'
      setTypingFull(responseText)
      triggerPulse()
    } catch (err) {
      // Avval local fallback sinab ko'ramiz
      const fallback = localFallback(msg, {
        total_persons: totalPersons,
        persons: personsList,
        page: currentPage,
      })
      if (fallback) {
        setTypingFull(fallback)
      } else {
        const status  = err?.response?.status
        const errText = status === 503
          ? "⚠️ AI serveri sozlanmagan. Admin Gemini API kalitini qo'shishi kerak."
          : status === 401
          ? "🔐 Tizimga qayta kiring."
          : "❌ Javob olishda xato. Internet aloqasini tekshiring."
        setMessages(prev => {
          const arr = [...prev]
          arr[arr.length - 1] = { ...arr[arr.length - 1], text: errText, typing: false }
          return arr
        })
      }
    } finally {
      setLoading(false)
    }
  }, [input, loading, messages, currentPage, totalPersons, personsList, triggerPulse])

  const clearHistory = () => {
    setMessages([])
    setGreeted(false)
    setMessages([])
  }

  // ── Colors ────────────────────────────────────────────────────
  const bg     = isDark ? '#1e293b' : '#ffffff'
  const bgDim  = isDark ? '#0f172a' : '#f8fafc'
  const border = isDark ? '#334155' : '#e2e8f0'
  const text   = isDark ? '#f1f5f9' : '#0f172a'
  const muted  = isDark ? '#64748b' : '#94a3b8'

  if (!user) return null

  if (!enabled) {
    return (
      <button
        onClick={() => setEnabled(true)}
        title="AI yordamchini yoqish"
        style={{
          position: 'fixed', bottom: 80, right: 18, zIndex: 9000,
          width: 38, height: 38, borderRadius: '50%',
          border: `1.5px dashed ${isDark ? '#334155' : '#e2e8f0'}`,
          background: isDark ? '#1e293b' : '#f8fafc',
          cursor: 'pointer', fontSize: 16,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: muted, transition: 'all 0.2s',
          opacity: 0.5,
        }}
        onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.borderStyle = 'solid' }}
        onMouseLeave={e => { e.currentTarget.style.opacity = '0.5'; e.currentTarget.style.borderStyle = 'dashed' }}>
        🤖
      </button>
    )
  }

  return (
    <>
      {/* ── Salomlashuv bubble ── */}
      {bubbleVisible && !open && (
        <div style={{
          position: 'fixed',
          bottom: 90,
          right: 76,
          zIndex: 9002,
          width: 220,
          animation: bubbleHidden
            ? 'bubbleOut 0.3s ease forwards'
            : 'bubbleIn 0.4s cubic-bezier(0.34,1.56,0.64,1) both',
        }}>
          {/* Bubble karta */}
          <div style={{
            background: isDark ? '#1e293b' : '#ffffff',
            border: `1px solid ${isDark ? 'rgba(148,163,184,0.12)' : 'rgba(0,0,0,0.07)'}`,
            borderRadius: 18,
            padding: '13px 16px 13px 14px',
            boxShadow: isDark
              ? '0 8px 30px rgba(0,0,0,0.5)'
              : '0 6px 24px rgba(0,0,0,0.12)',
            position: 'relative',
          }}>
            {/* X tugmasi */}
            <button onClick={dismissBubble} style={{
              position: 'absolute', top: 8, right: 8,
              width: 20, height: 20, borderRadius: '50%', border: 'none',
              background: 'transparent',
              color: isDark ? '#64748b' : '#9ca3af',
              fontSize: 13, cursor: 'pointer', fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              lineHeight: 1, padding: 0,
              transition: 'color 0.15s',
            }}
              onMouseEnter={e => e.currentTarget.style.color = isDark ? '#e2e8f0' : '#374151'}
              onMouseLeave={e => e.currentTarget.style.color = isDark ? '#64748b' : '#9ca3af'}
            >×</button>

            {/* Chat ikonka + matn */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <div style={{
                width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                background: isDark ? 'rgba(99,102,241,0.15)' : '#f0f0ff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, marginTop: 1,
              }}>💬</div>
              <p style={{
                fontSize: 13.5, fontWeight: 500, lineHeight: 1.55,
                color: isDark ? '#e2e8f0' : '#1f2937',
                margin: 0, whiteSpace: 'pre-line', paddingRight: 16,
              }}>
                {bubbleTyped}
                <span style={{
                  display: 'inline-block', width: 1.5, height: 12,
                  background: isDark ? '#818cf8' : '#6366f1',
                  marginLeft: 2, verticalAlign: 'middle',
                  animation: 'cursorBlink 0.7s step-end infinite',
                  opacity: bubbleTyped.length < bubbleText.length ? 1 : 0,
                }}/>
              </p>
            </div>
          </div>

          {/* O'ng tomonga ishora qiluvchi o'q */}
          <div style={{
            position: 'absolute',
            top: '50%',
            right: -8,
            transform: 'translateY(-50%)',
            width: 0, height: 0,
            borderTop: '8px solid transparent',
            borderBottom: '8px solid transparent',
            borderLeft: `8px solid ${isDark ? '#1e293b' : '#ffffff'}`,
            filter: isDark
              ? 'drop-shadow(2px 0 2px rgba(0,0,0,0.3))'
              : 'drop-shadow(2px 0 2px rgba(0,0,0,0.06))',
          }}/>
        </div>
      )}

      {/* ── Floating robot button ── */}
      {!open && (
        <button
          onClick={() => { setOpen(true); setBubbleVisible(false) }}
          title="AI yordamchi"
          style={{
            position: 'fixed', bottom: 80, right: 18, zIndex: 9000,
            width: 56, height: 56, borderRadius: '50%', border: 'none',
            background: 'linear-gradient(145deg,#1a3a5c 0%,#0f2744 100%)',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: bubbleVisible
              ? '0 0 0 3px rgba(99,162,241,0.35), 0 8px 24px rgba(15,39,68,0.6)'
              : pulse
                ? '0 0 0 8px rgba(99,102,241,0.2), 0 8px 24px rgba(15,39,68,0.5)'
                : '0 6px 20px rgba(15,39,68,0.5)',
            transition: 'box-shadow 0.3s, transform 0.2s',
            animation: bubbleVisible && !pulse
              ? 'robotRing 0.55s ease-in-out infinite'
              : pulse ? 'aiPulse 1s ease-in-out 2' : 'none',
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.08)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>

          {/* SVG Robot ikonka */}
          <svg width="30" height="30" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Antenna */}
            <line x1="16" y1="2" x2="16" y2="7" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            <circle cx="16" cy="2" r="1.5" fill="#60a5fa"/>
            {/* Head */}
            <rect x="6" y="7" width="20" height="14" rx="5" fill="white" fillOpacity="0.92"/>
            {/* Eyes */}
            <circle cx="11.5" cy="14" r="3" fill="#1a3a5c"/>
            <circle cx="20.5" cy="14" r="3" fill="#1a3a5c"/>
            <circle cx="12.5" cy="13" r="1" fill="#60a5fa"/>
            <circle cx="21.5" cy="13" r="1" fill="#60a5fa"/>
            {/* Mouth */}
            <rect x="11" y="18" width="10" height="1.5" rx="0.75" fill="#1a3a5c" fillOpacity="0.5"/>
            {/* Body */}
            <rect x="9" y="22" width="14" height="8" rx="4" fill="white" fillOpacity="0.75"/>
            {/* Chest light */}
            <circle cx="16" cy="26" r="2" fill="#60a5fa" fillOpacity="0.8"/>
          </svg>

          {/* Online dot */}
          <span style={{
            position: 'absolute', bottom: 3, right: 3,
            width: 11, height: 11, borderRadius: '50%',
            background: '#22c55e',
            border: `2px solid ${isDark ? '#0f172a' : '#ffffff'}`,
            boxShadow: '0 0 6px rgba(34,197,94,0.6)',
          }}/>

          {/* Unread dot */}
          {messages.length > 0 && (
            <span style={{
              position: 'absolute', top: 2, right: 2,
              width: 12, height: 12, borderRadius: '50%',
              background: '#f97316', border: '2px solid white',
              fontSize: 7, color: 'white', fontWeight: 900,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{messages.length > 9 ? '9+' : messages.length}</span>
          )}
        </button>
      )}

      {/* ── Chat Panel ── */}
      {open && (
        <div style={{
          position: 'fixed', bottom: 80, right: 16, zIndex: 9001,
          width: 360, maxWidth: 'calc(100vw - 32px)',
          height: 520, maxHeight: 'calc(100vh - 120px)',
          borderRadius: 22,
          background: bg,
          border: `1px solid ${border}`,
          boxShadow: isDark
            ? '0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(99,102,241,0.2)'
            : '0 20px 60px rgba(0,0,0,0.15), 0 0 0 1px rgba(99,102,241,0.1)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          animation: 'chatSlideUp 0.25s cubic-bezier(0.34,1.56,0.64,1)',
        }}>

          {/* ── Header ── */}
          <div style={{
            background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
            padding: '14px 16px 12px',
            display: 'flex', alignItems: 'center', gap: 10,
            flexShrink: 0,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 12, flexShrink: 0,
              background: 'rgba(255,255,255,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            }}>🤖</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'white' }}>Shajara AI</div>
              <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.75)', display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ade80', display: 'inline-block' }} />
                Gemini · {currentPage}
              </div>
            </div>

            {/* Settings toggle */}
            <button
              onClick={() => setShowSettings(v => !v)}
              title="Sozlamalar"
              style={{
                width: 30, height: 30, borderRadius: 9, border: 'none', cursor: 'pointer',
                background: showSettings ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.15)',
                color: 'white', fontSize: 14,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>⚙️</button>

            {/* Minimize */}
            <button
              onClick={() => setOpen(false)}
              title="Yopish"
              style={{
                width: 30, height: 30, borderRadius: 9, border: 'none', cursor: 'pointer',
                background: 'rgba(255,255,255,0.15)', color: 'white', fontSize: 16,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>−</button>
          </div>

          {/* ── Settings panel ── */}
          {showSettings && (
            <div style={{
              padding: '10px 14px', borderBottom: `1px solid ${border}`,
              background: isDark ? '#1e1b4b' : '#f5f3ff',
              display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0,
            }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#6366f1', letterSpacing: '0.06em' }}>
                ⚙️ AI SOZLAMALAR
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={clearHistory}
                  style={{
                    flex: 1, padding: '6px 10px', borderRadius: 9, border: '1.5px solid #e2e8f0',
                    background: isDark ? '#1e293b' : 'white', cursor: 'pointer',
                    fontSize: 11.5, fontWeight: 700, color: isDark ? '#94a3b8' : '#64748b',
                  }}>
                  🗑️ Tarixni tozalash
                </button>
                <button
                  onClick={toggleEnabled}
                  style={{
                    flex: 1, padding: '6px 10px', borderRadius: 9, border: '1.5px solid #fca5a5',
                    background: isDark ? '#450a0a' : '#fee2e2', cursor: 'pointer',
                    fontSize: 11.5, fontWeight: 700, color: '#ef4444',
                  }}>
                  ⛔ AI o'chirish
                </button>
              </div>
              <div style={{ fontSize: 10, color: muted }}>
                AI o'chirilganda barcha sahifalarda ko'rinmaydi.
              </div>
            </div>
          )}

          {/* ── Messages ── */}
          <div style={{
            flex: 1, overflowY: 'auto', padding: '12px 12px 8px',
            display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            {messages.length === 0 && !loading && (
              <div style={{ textAlign: 'center', padding: '30px 10px' }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>🤖</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: text, marginBottom: 4 }}>
                  Salom! Men Shajara AI yordamchisiman
                </div>
                <div style={{ fontSize: 12, color: muted }}>Savollaringizni bering</div>
              </div>
            )}

            {messages.map((m, i) => {
              const isUser = m.role === 'user'
              return (
                <div key={i} style={{
                  display: 'flex', flexDirection: isUser ? 'row-reverse' : 'row',
                  gap: 8, alignItems: 'flex-end',
                }}>
                  {/* Avatar */}
                  {!isUser && (
                    <div style={{
                      width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                      background: 'linear-gradient(135deg,#6366f1,#7c3aed)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, boxShadow: '0 2px 6px rgba(99,102,241,0.35)',
                    }}>🤖</div>
                  )}

                  <div style={{
                    maxWidth: '82%',
                    background: isUser
                      ? 'linear-gradient(135deg,#6366f1,#7c3aed)'
                      : (isDark ? '#334155' : '#f1f5f9'),
                    color: isUser ? 'white' : text,
                    borderRadius: isUser ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
                    padding: '9px 13px',
                    fontSize: 13, lineHeight: 1.55,
                    boxShadow: isUser
                      ? '0 3px 10px rgba(99,102,241,0.35)'
                      : '0 1px 4px rgba(0,0,0,0.06)',
                    position: 'relative',
                  }}>
                    {m.typing && m.text === '...' ? (
                      // Loading dots
                      <div style={{ display: 'flex', gap: 4, padding: '2px 4px' }}>
                        {[0,1,2].map(d => (
                          <div key={d} style={{
                            width: 7, height: 7, borderRadius: '50%',
                            background: '#a5b4fc',
                            animation: `dotBounce 1.2s ease-in-out ${d * 0.2}s infinite`,
                          }} />
                        ))}
                      </div>
                    ) : (
                      <RenderText text={m.text} />
                    )}

                    {/* Time */}
                    <div style={{
                      fontSize: 9, marginTop: 4, textAlign: 'right',
                      color: isUser ? 'rgba(255,255,255,0.65)' : muted,
                    }}>
                      {fmtTime(m.ts)}
                    </div>
                  </div>
                </div>
              )
            })}

            {/* Suggested questions — only when no messages from user yet */}
            {messages.filter(m => m.role === 'user').length === 0 && !loading && messages.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                {SUGGESTIONS.map((s, i) => (
                  <button key={i} onClick={() => sendMessage(s)}
                    style={{
                      padding: '5px 11px', borderRadius: 20,
                      border: `1.5px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                      background: 'transparent', cursor: 'pointer',
                      fontSize: 11.5, color: isDark ? '#a5b4fc' : '#6366f1', fontWeight: 600,
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = isDark ? '#1e1b4b' : '#eef2ff' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                    {s}
                  </button>
                ))}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* ── Quick nav shortcuts ── */}
          <div style={{
            padding: '4px 10px 2px', flexShrink: 0,
            borderTop: `1px solid ${border}`,
            display: 'flex', gap: 5, overflowX: 'auto',
          }}>
            {[
              { label: '🌲 Daraxt',    path: '/tree' },
              { label: '👥 Shaxslar', path: '/persons' },
              { label: '🔗 Munosabat',path: '/relationship' },
              { label: '📊 Statistika',path: '/statistics' },
            ].map(({ label, path }) => (
              <button key={path}
                onClick={() => { navigate(path); setOpen(false) }}
                style={{
                  padding: '4px 10px', borderRadius: 8, border: 'none',
                  background: location.pathname === path
                    ? 'linear-gradient(135deg,#6366f1,#7c3aed)'
                    : (isDark ? '#334155' : '#f1f5f9'),
                  color: location.pathname === path ? 'white' : muted,
                  fontSize: 10.5, fontWeight: 600, cursor: 'pointer',
                  flexShrink: 0, transition: 'all 0.15s',
                }}>
                {label}
              </button>
            ))}
          </div>

          {/* ── Input ── */}
          <div style={{
            padding: '8px 10px 10px', borderTop: `1px solid ${border}`,
            display: 'flex', gap: 8, alignItems: 'flex-end', flexShrink: 0,
            background: bg,
          }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
              }}
              placeholder="Savol yozing... (Enter — yuborish)"
              rows={1}
              style={{
                flex: 1, padding: '9px 12px', borderRadius: 14,
                border: `1.5px solid ${input ? '#6366f1' : border}`,
                background: isDark ? '#0f172a' : '#f8fafc',
                color: text, fontSize: 13, outline: 'none',
                resize: 'none', fontFamily: 'inherit', lineHeight: 1.4,
                maxHeight: 90, overflowY: 'auto',
                transition: 'border-color 0.15s',
              }}
              onInput={e => {
                e.target.style.height = 'auto'
                e.target.style.height = Math.min(e.target.scrollHeight, 90) + 'px'
              }}
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading}
              style={{
                width: 40, height: 40, borderRadius: 12, border: 'none',
                cursor: !input.trim() || loading ? 'default' : 'pointer',
                background: !input.trim() || loading
                  ? (isDark ? '#334155' : '#e2e8f0')
                  : 'linear-gradient(135deg,#6366f1,#7c3aed)',
                color: !input.trim() || loading ? muted : 'white',
                fontSize: 16, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: !input.trim() || loading ? 'none' : '0 3px 10px rgba(99,102,241,0.4)',
                transition: 'all 0.15s',
              }}>
              {loading ? '⏳' : '➤'}
            </button>
          </div>
        </div>
      )}

      {/* ── Animations ── */}
      <style>{`
        @keyframes chatSlideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes dotBounce {
          0%,80%,100% { transform: scale(0.6); opacity: 0.5; }
          40%          { transform: scale(1);   opacity: 1; }
        }
        @keyframes aiPulse {
          0%,100% { box-shadow: 0 6px 20px rgba(99,102,241,0.45); }
          50%      { box-shadow: 0 0 0 12px rgba(99,102,241,0.2), 0 6px 20px rgba(99,102,241,0.6); }
        }
        @keyframes bubbleIn {
          0%   { opacity: 0; transform: translateY(12px) scale(0.9); }
          70%  { transform: translateY(-3px) scale(1.02); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes bubbleOut {
          from { opacity: 1; transform: translateY(0) scale(1); }
          to   { opacity: 0; transform: translateY(8px) scale(0.92); }
        }
        @keyframes robotRing {
          0%,100% { transform: rotate(0deg); }
          15%     { transform: rotate(-12deg); }
          30%     { transform: rotate(12deg); }
          45%     { transform: rotate(-8deg); }
          60%     { transform: rotate(8deg); }
          75%     { transform: rotate(-4deg); }
          90%     { transform: rotate(4deg); }
        }
        @keyframes cursorBlink {
          0%,100% { opacity: 1; }
          50%      { opacity: 0; }
        }
      `}</style>
    </>
  )
}
