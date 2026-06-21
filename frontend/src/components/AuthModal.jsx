import { useState, useRef, useEffect } from 'react'
import useAuthStore from '../store/authStore'
import useThemeStore from '../store/themeStore'
import api from '../api/axios'

function newCaptcha() {
  const ops = ['+', '-', '×']
  const op  = ops[Math.floor(Math.random() * ops.length)]
  let a, b, answer
  if (op === '+') {
    a = Math.floor(Math.random() * 20) + 1
    b = Math.floor(Math.random() * 20) + 1
    answer = a + b
  } else if (op === '-') {
    a = Math.floor(Math.random() * 20) + 10
    b = Math.floor(Math.random() * a) + 1
    answer = a - b
  } else {
    a = Math.floor(Math.random() * 9) + 2
    b = Math.floor(Math.random() * 9) + 2
    answer = a * b
  }
  return { question: `${a} ${op} ${b} = ?`, answer }
}

function formatPhone(digits) {
  const d = digits.replace(/\D/g, '').slice(0, 12)
  if (!d) return ''
  const n = d.startsWith('998') ? d : ('998' + d).slice(0, 12)
  let r = '+998'
  if (n.length > 3)  r += ' ' + n.slice(3, 5)
  if (n.length > 5)  r += ' ' + n.slice(5, 8)
  if (n.length > 8)  r += '-' + n.slice(8, 10)
  if (n.length > 10) r += '-' + n.slice(10, 12)
  return r
}

const translateErr = (msg) => {
  if (!msg) return msg
  if (msg.includes('already exists'))        return "Bu foydalanuvchi nomi band."
  if (msg.includes('at least 8 characters')) return "Parol kamida 8 belgidan iborat bo'lishi kerak."
  if (msg.includes('too common'))            return "Parol juda oddiy. Murakkamroq parol kiriting."
  if (msg.includes('entirely numeric'))      return "Parol faqat raqamlardan iborat bo'lmasligi kerak."
  return msg
}

export default function AuthModal({ onClose }) {
  const { login } = useAuthStore()
  const { isDark } = useThemeStore()

  const [tab, setTab] = useState('login')
  const [form, setForm] = useState({ username: '', password: '', first_name: '', last_name: '', phone: '' })
  const [phoneDisplay, setPhoneDisplay] = useState('')
  const [showPass, setShowPass] = useState(false)

  const [captcha, setCaptcha]           = useState(newCaptcha)
  const [captchaInput, setCaptchaInput] = useState('')

  const [errors, setErrors] = useState({})  // { field: message }
  const [loading, setLoading] = useState(false)

  const bg    = isDark ? '#0f172a' : '#ffffff'
  const bg2   = isDark ? '#1e293b' : '#f8fafc'
  const brd   = isDark ? '#334155' : '#e2e8f0'
  const txt   = isDark ? '#f1f5f9' : '#0f172a'
  const muted = isDark ? '#94a3b8' : '#64748b'

  const set = (k, v) => {
    setForm(f => ({ ...f, [k]: v }))
    setErrors(e => ({ ...e, [k]: '', general: '' }))
  }

  function switchTab(t) {
    setTab(t)
    setErrors({})
    set('password', '')
    setShowPass(false)
    if (t === 'register') {
      setCaptcha(newCaptcha())
      setCaptchaInput('')
    }
  }

  function handlePhoneInput(e) {
    const digits = e.target.value.replace(/\D/g, '')
    setPhoneDisplay(formatPhone(digits))
    const raw = digits.startsWith('998') ? digits : ('998' + digits).slice(0, 12)
    set('phone', raw.length > 3 ? '+' + raw : '')
    setErrors(e => ({ ...e, phone: '' }))
  }

  // ── Validatsiya (client-side) ──────────────────────────────────
  function validate() {
    const e = {}
    if (tab === 'register') {
      if (!form.first_name.trim()) e.first_name = "Ism kiritilmagan."
      if (!form.username.trim() || form.username.length < 3)
        e.username = "Username kamida 3 belgidan iborat bo'lishi kerak."
      if (form.password.length < 8)
        e.password = "Parol kamida 8 belgidan iborat bo'lishi kerak."
      if (!/\D/.test(form.password))
        e.password = "Parol faqat raqamlardan iborat bo'lmasligi kerak."
      const ans = parseInt(captchaInput.trim(), 10)
      if (isNaN(ans) || ans !== captcha.answer)
        e.captcha = "Javob noto'g'ri."
    } else {
      if (!form.username.trim()) e.username = "Foydalanuvchi nomini kiriting."
      if (!form.password)        e.password  = "Parolni kiriting."
    }
    return e
  }

  // ── Login ──────────────────────────────────────────────────────
  async function handleLogin(e) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setLoading(true)
    try {
      await login(form.username, form.password)
      onClose()
    } catch (err) {
      const d = err?.response?.data
      const msg = typeof d === 'string' ? d
        : d?.detail || d?.non_field_errors?.[0] || "Login yoki parol xato."
      setErrors({ general: translateErr(msg) })
    } finally { setLoading(false) }
  }

  // ── Register ───────────────────────────────────────────────────
  async function handleRegister(e) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) {
      setErrors(errs)
      // Captcha noto'g'ri bo'lsa yangilash
      if (errs.captcha) { setCaptcha(newCaptcha()); setCaptchaInput('') }
      return
    }
    setLoading(true)
    try {
      const res = await api.post('/auth/register/', {
        username:   form.username,
        password:   form.password,
        first_name: form.first_name,
        last_name:  form.last_name,
        phone:      form.phone,
      })
      const { access, refresh, user: u } = res.data
      useAuthStore.getState().loginWithTokens({ access, refresh, user: u })
      onClose()
    } catch (err) {
      const d = err?.response?.data
      if (d?.username) setErrors({ username: translateErr(d.username[0]) })
      else if (d?.password) setErrors({ password: translateErr(d.password[0]) })
      else if (d?.detail) setErrors({ general: translateErr(d.detail) })
      else setErrors({ general: "Xatolik yuz berdi. Qayta urinib ko'ring." })
    } finally { setLoading(false) }
  }

  const isRegister = tab === 'register'

  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16, animation: 'confirmFadeIn 0.2s ease',
      }}
    >
      <div style={{
        width: '100%', maxWidth: 420,
        background: bg, borderRadius: 22,
        border: `1.5px solid ${brd}`,
        boxShadow: isDark
          ? '0 32px 80px rgba(0,0,0,0.65), 0 0 0 1px rgba(99,102,241,0.15)'
          : '0 32px 80px rgba(0,0,0,0.14), 0 0 0 1px rgba(99,102,241,0.12)',
        overflow: 'hidden',
        animation: 'confirmSlideUp 0.25s cubic-bezier(0.34,1.4,0.64,1)',
        maxHeight: '95vh', overflowY: 'auto',
      }}>

        {/* Header */}
        <div style={{ padding: '22px 24px 0', textAlign: 'center' }}>
          <div style={{
            width: 52, height: 52, borderRadius: 15, margin: '0 auto 12px',
            background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 26, boxShadow: '0 8px 24px rgba(99,102,241,0.4)',
          }}>🌳</div>
          <div style={{ fontSize: 19, fontWeight: 900, color: txt, marginBottom: 3 }}>
            Shajara tizimiga kirish
          </div>
          <div style={{ fontSize: 12.5, color: muted }}>
            Daraxtni to'liq boshqarish uchun kiring
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, padding: '16px 24px 0' }}>
          {[['login', 'Kirish'], ['register', "Ro'yxatdan o'tish"]].map(([key, label]) => (
            <button key={key} onClick={() => switchTab(key)}
              style={{
                flex: 1, padding: '9px 0', borderRadius: 10, border: 'none',
                cursor: 'pointer', fontWeight: 700, fontSize: 13, transition: 'all 0.18s',
                background: tab === key
                  ? 'linear-gradient(135deg,#6366f1,#8b5cf6)'
                  : (isDark ? '#1e293b' : '#f1f5f9'),
                color: tab === key ? 'white' : muted,
                boxShadow: tab === key ? '0 4px 14px rgba(99,102,241,0.35)' : 'none',
              }}>
              {label}
            </button>
          ))}
        </div>

        {/* Form */}
        <form
          onSubmit={isRegister ? handleRegister : handleLogin}
          style={{ padding: '16px 24px 0' }}
        >
          {isRegister && (
            <>
              <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <input
                    placeholder="Ism"
                    value={form.first_name}
                    onChange={e => set('first_name', e.target.value)}
                    style={iStyle(isDark, errors.first_name ? '#ef4444' : brd, bg2, txt)}
                  />
                  {errors.first_name && <ErrMsg msg={errors.first_name} isDark={isDark} />}
                </div>
                <div style={{ flex: 1 }}>
                  <input
                    placeholder="Familiya"
                    value={form.last_name}
                    onChange={e => set('last_name', e.target.value)}
                    style={iStyle(isDark, brd, bg2, txt)}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 8 }}>
                <input
                  placeholder="+998 YY XXX-XX-XX"
                  value={phoneDisplay}
                  onChange={handlePhoneInput}
                  type="tel"
                  style={iStyle(isDark, brd, bg2, txt)}
                />
              </div>
            </>
          )}

          {/* Username */}
          <div style={{ marginBottom: 8 }}>
            <input
              placeholder="Foydalanuvchi nomi"
              value={form.username}
              onChange={e => set('username', e.target.value)}
              required
              autoComplete="username"
              style={iStyle(isDark, errors.username ? '#ef4444' : brd, bg2, txt)}
            />
            {errors.username && <ErrMsg msg={errors.username} isDark={isDark} />}
          </div>

          {/* Parol */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ position: 'relative' }}>
              <input
                type={showPass ? 'text' : 'password'}
                placeholder="Parol"
                value={form.password}
                onChange={e => set('password', e.target.value)}
                required
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                style={{ ...iStyle(isDark, errors.password ? '#ef4444' : brd, bg2, txt), paddingRight: 40 }}
              />
              <button
                type="button"
                onClick={() => setShowPass(v => !v)}
                tabIndex={-1}
                style={{
                  position: 'absolute', right: 10, top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: muted, fontSize: 16, padding: 2, lineHeight: 1,
                }}
              >{showPass ? '🙈' : '👁️'}</button>
            </div>
            {errors.password && <ErrMsg msg={errors.password} isDark={isDark} />}
          </div>

          {/* ── INLINE CAPTCHA (faqat ro'yxatdan o'tishda) ── */}
          {isRegister && (
            <div style={{
              marginBottom: 8, borderRadius: 12,
              border: `1.5px solid ${errors.captcha
                ? '#ef4444'
                : (isDark ? 'rgba(99,102,241,0.3)' : '#c7d2fe')}`,
              background: isDark ? 'rgba(99,102,241,0.08)' : '#eef2ff',
              padding: '10px 14px',
            }}>
              <div style={{ fontSize: 11.5, color: muted, marginBottom: 6 }}>
                🔒 Xavfsizlik tekshiruvi — misolni yeching:
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  fontSize: 20, fontWeight: 900,
                  color: isDark ? '#a5b4fc' : '#4338ca',
                  letterSpacing: 1, whiteSpace: 'nowrap',
                  flex: 1,
                }}>
                  {captcha.question}
                </div>
                <input
                  type="number"
                  placeholder="Javob"
                  value={captchaInput}
                  onChange={e => {
                    setCaptchaInput(e.target.value)
                    setErrors(er => ({ ...er, captcha: '' }))
                  }}
                  style={{
                    width: 80, padding: '7px 10px',
                    borderRadius: 9,
                    border: `1.5px solid ${errors.captcha
                      ? '#ef4444'
                      : (isDark ? 'rgba(99,102,241,0.4)' : '#a5b4fc')}`,
                    background: isDark ? '#0f172a' : '#ffffff',
                    color: txt, fontSize: 15, fontWeight: 800,
                    outline: 'none', textAlign: 'center',
                  }}
                />
                {/* Yangilash tugmasi */}
                <button
                  type="button"
                  onClick={() => { setCaptcha(newCaptcha()); setCaptchaInput(''); setErrors(er => ({ ...er, captcha: '' })) }}
                  title="Yangi misol"
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: muted, fontSize: 17, padding: 4, lineHeight: 1,
                  }}
                >🔄</button>
              </div>
              {errors.captcha && <ErrMsg msg={errors.captcha} isDark={isDark} />}
            </div>
          )}

          {/* Umumiy xato */}
          {errors.general && (
            <div style={{
              marginBottom: 10, padding: '9px 12px', borderRadius: 10,
              background: isDark ? '#450a0a' : '#fef2f2',
              border: `1px solid ${isDark ? '#7f1d1d' : '#fecaca'}`,
              color: isDark ? '#f87171' : '#dc2626',
              fontSize: 12.5, fontWeight: 600,
            }}>{errors.general}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', marginTop: 6, padding: '12px',
              borderRadius: 12, border: 'none', cursor: loading ? 'wait' : 'pointer',
              background: loading
                ? (isDark ? '#334155' : '#e2e8f0')
                : 'linear-gradient(135deg,#6366f1,#8b5cf6)',
              color: loading ? muted : 'white',
              fontSize: 14, fontWeight: 800,
              boxShadow: loading ? 'none' : '0 6px 20px rgba(99,102,241,0.4)',
              transition: 'all 0.18s',
            }}>
            {loading
              ? 'Yuklanmoqda...'
              : isRegister ? "✓ Ro'yxatdan o'tish" : '→ Kirish'}
          </button>
        </form>

        {/* Footer */}
        <div style={{ padding: '14px 24px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, height: 1, background: brd }} />
          <span style={{ fontSize: 11.5, color: muted }}>yoki</span>
          <div style={{ flex: 1, height: 1, background: brd }} />
        </div>
        <div style={{ padding: '10px 24px 22px' }}>
          <button
            onClick={onClose}
            style={{
              width: '100%', padding: '10px',
              borderRadius: 12, cursor: 'pointer', fontWeight: 700, fontSize: 13,
              border: `1.5px solid ${brd}`,
              background: 'transparent', color: muted, transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = isDark ? '#1e293b' : '#f8fafc'; e.currentTarget.style.color = txt }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = muted }}
          >
            🌳 Asosiy sahifaga o'tish (mehmon sifatida)
          </button>
        </div>
      </div>
    </div>
  )
}

function ErrMsg({ msg, isDark }) {
  return (
    <div style={{
      marginTop: 4, fontSize: 11.5, fontWeight: 600,
      color: isDark ? '#f87171' : '#dc2626',
      paddingLeft: 2,
    }}>{msg}</div>
  )
}

function iStyle(isDark, brd, bg2, txt) {
  return {
    width: '100%', padding: '10px 13px',
    borderRadius: 11, border: `1.5px solid ${brd}`,
    background: bg2, color: txt,
    fontSize: 13, fontWeight: 500,
    outline: 'none', boxSizing: 'border-box',
    transition: 'border-color 0.15s',
  }
}
