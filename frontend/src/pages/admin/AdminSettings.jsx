import { useState } from 'react'
import toast from 'react-hot-toast'
import useAuthStore from '../../store/authStore'
import useThemeStore from '../../store/themeStore'
import useDesignStore, { THEMES, FONTS, FONT_SIZES } from '../../store/designStore'
import api from '../../api/axios'

export default function AdminSettings() {
  const { user }   = useAuthStore()
  const { isDark } = useThemeStore()
  const { themeId, fontId, fontSizeId, setTheme, setFont, setFontSize } = useDesignStore()

  const [profile, setProfile] = useState({
    first_name: user?.first_name || '',
    last_name:  user?.last_name  || '',
    email:      user?.email      || '',
  })
  const [pwd, setPwd] = useState({ old: '', new1: '', new2: '' })
  const [pwdLoading, setPwdLoading] = useState(false)

  const bg      = isDark ? '#1e293b' : '#ffffff'
  const pageBg  = isDark ? '#0f172a' : '#f8fafc'
  const border  = isDark ? '#334155' : '#e2e8f0'
  const text1   = isDark ? '#f1f5f9' : '#1e293b'
  const text2   = isDark ? '#94a3b8' : '#64748b'
  const inputBg = isDark ? '#0f172a' : '#f8fafc'
  const inputBr = isDark ? '#475569' : '#d1d5db'

  const curTheme = THEMES.find(t => t.id === themeId) || THEMES[0]

  const saveProfile = async (e) => {
    e.preventDefault()
    try {
      await api.patch(`/auth/users/${user.id}/`, profile)
      toast.success('✅ Profil yangilandi')
    } catch { toast.error('❌ Xato yuz berdi') }
  }

  const savePassword = async (e) => {
    e.preventDefault()
    if (pwd.new1 !== pwd.new2) { toast.error('❌ Yangi parollar mos kelmadi'); return }
    if (pwd.new1.length < 6)   { toast.error('❌ Parol kamida 6 ta belgi bo\'lishi kerak'); return }
    setPwdLoading(true)
    try {
      await api.post('/auth/me/change-password/', { old_password: pwd.old, new_password: pwd.new1 })
      toast.success('🔐 Parol muvaffaqiyatli o\'zgartirildi')
      setPwd({ old: '', new1: '', new2: '' })
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.response?.data?.old_password?.[0] || 'Xato yuz berdi'
      toast.error('❌ ' + msg)
    } finally { setPwdLoading(false) }
  }

  const Section = ({ title, children }) => (
    <div style={{ background: bg, borderRadius: 20, border: `1px solid ${border}`,
      padding: 24, marginBottom: 20, boxShadow: isDark
        ? '0 4px 24px rgba(0,0,0,0.3)'
        : '0 4px 24px rgba(0,0,0,0.06)' }}>
      <h2 style={{ fontWeight: 800, color: text1, marginBottom: 20, fontSize: 15,
        display: 'flex', alignItems: 'center', gap: 8 }}>{title}</h2>
      {children}
    </div>
  )

  const Input = ({ label, type = 'text', value, onChange, placeholder }) => (
    <div>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: text2,
        marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</label>
      <input type={type} value={value} onChange={onChange} placeholder={placeholder}
        style={{ width: '100%', background: inputBg, border: `1.5px solid ${inputBr}`,
          borderRadius: 10, padding: '10px 14px', fontSize: 13, color: text1,
          outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s' }}
        onFocus={e => e.target.style.borderColor = curTheme.p}
        onBlur={e => e.target.style.borderColor = inputBr}
      />
    </div>
  )

  const SaveBtn = ({ label = '💾 Saqlash', loading }) => (
    <button type="submit" disabled={loading} style={{
      background: curTheme.grad, color: 'white', border: 'none', borderRadius: 12,
      padding: '10px 22px', fontSize: 13, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
      alignSelf: 'flex-start', opacity: loading ? 0.7 : 1,
      boxShadow: `0 4px 14px ${curTheme.p}55`,
      transition: 'opacity 0.2s, transform 0.1s',
    }}>{loading ? '⏳ Saqlanmoqda...' : label}</button>
  )

  return (
    <div style={{ padding: 24, maxWidth: 620, background: pageBg, minHeight: '100%' }}>
      <h1 style={{ fontSize: 22, fontWeight: 900, color: text1, marginBottom: 24,
        display: 'flex', alignItems: 'center', gap: 10 }}>
        ⚙️ Sozlamalar
      </h1>

      {/* ── 1. Profil ─────────────────────────────────────────── */}
      <Section title="👤 Profil ma'lumotlari">
        <form onSubmit={saveProfile} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Input label="Ism"      value={profile.first_name} onChange={e => setProfile({...profile, first_name: e.target.value})} />
            <Input label="Familiya" value={profile.last_name}  onChange={e => setProfile({...profile, last_name:  e.target.value})} />
          </div>
          <Input label="Email" type="email" value={profile.email} onChange={e => setProfile({...profile, email: e.target.value})} />
          <SaveBtn />
        </form>
      </Section>

      {/* ── 2. Parol ──────────────────────────────────────────── */}
      <Section title="🔐 Parolni almashtirish">
        <form onSubmit={savePassword} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input label="Joriy parol"   type="password" value={pwd.old}  onChange={e => setPwd({...pwd, old:  e.target.value})} placeholder="••••••••" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Input label="Yangi parol"        type="password" value={pwd.new1} onChange={e => setPwd({...pwd, new1: e.target.value})} placeholder="••••••••" />
            <Input label="Yangi parol (takror)" type="password" value={pwd.new2} onChange={e => setPwd({...pwd, new2: e.target.value})} placeholder="••••••••" />
          </div>
          {pwd.new1 && pwd.new2 && pwd.new1 !== pwd.new2 && (
            <div style={{ fontSize: 12, color: '#ef4444', fontWeight: 600 }}>⚠️ Parollar mos kelmadi</div>
          )}
          <SaveBtn label="🔑 Parolni o'zgartirish" loading={pwdLoading} />
        </form>
      </Section>

      {/* ── 3. Tema rangi ─────────────────────────────────────── */}
      <Section title="🎨 Rang temasi">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {THEMES.map(t => (
            <button key={t.id} onClick={() => setTheme(t.id)} style={{
              background: t.id === themeId
                ? (isDark ? '#1e293b' : '#f0f0ff')
                : 'transparent',
              border: `2px solid ${t.id === themeId ? t.p : (isDark ? '#334155' : '#e2e8f0')}`,
              borderRadius: 14, padding: '12px 8px', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
              transition: 'all 0.2s',
              boxShadow: t.id === themeId ? `0 0 0 3px ${t.p}30` : 'none',
            }}>
              {/* Gradient preview circle */}
              <div style={{ width: 36, height: 36, borderRadius: '50%',
                background: t.grad, boxShadow: `0 4px 10px ${t.p}55`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16 }}>{t.emoji}</div>
              <span style={{ fontSize: 11, fontWeight: 700, color: t.id === themeId ? t.p : text2 }}>
                {t.name}
              </span>
              {t.id === themeId && (
                <span style={{ fontSize: 9, color: t.p, fontWeight: 800 }}>✓ Aktiv</span>
              )}
            </button>
          ))}
        </div>
      </Section>

      {/* ── 4. Shrift ─────────────────────────────────────────── */}
      <Section title="🔤 Shrift turi">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {FONTS.map(f => (
            <button key={f.id} onClick={() => setFont(f.id)} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 16px', borderRadius: 12, cursor: 'pointer',
              background: f.id === fontId
                ? (isDark ? curTheme.p + '22' : curTheme.p + '11')
                : 'transparent',
              border: `1.5px solid ${f.id === fontId ? curTheme.p : (isDark ? '#334155' : '#e2e8f0')}`,
              transition: 'all 0.2s',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontFamily: f.family, fontSize: 18, fontWeight: 700,
                  color: f.id === fontId ? curTheme.p : text1 }}>Aa</span>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 13, fontWeight: 700,
                    color: f.id === fontId ? curTheme.p : text1, fontFamily: f.family }}>
                    {f.name}
                  </div>
                  <div style={{ fontSize: 11, color: text2, fontFamily: f.family }}>
                    Shajara — oila daraxti
                  </div>
                </div>
              </div>
              {f.id === fontId && (
                <span style={{ fontSize: 18, color: curTheme.p }}>✓</span>
              )}
            </button>
          ))}
        </div>
      </Section>

      {/* ── 5. Shrift o'lchami ────────────────────────────────── */}
      <Section title="📐 Shrift o'lchami">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {FONT_SIZES.map((s, i) => (
            <button key={s.id} onClick={() => setFontSize(s.id)} style={{
              padding: '16px 12px', borderRadius: 14, cursor: 'pointer',
              background: s.id === fontSizeId
                ? (isDark ? curTheme.p + '22' : curTheme.p + '11')
                : 'transparent',
              border: `1.5px solid ${s.id === fontSizeId ? curTheme.p : (isDark ? '#334155' : '#e2e8f0')}`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
              boxShadow: s.id === fontSizeId ? `0 0 0 3px ${curTheme.p}25` : 'none',
              transition: 'all 0.2s',
            }}>
              <span style={{ fontSize: [16, 22, 30][i], fontWeight: 800,
                color: s.id === fontSizeId ? curTheme.p : text1 }}>A</span>
              <span style={{ fontSize: 11, fontWeight: 700,
                color: s.id === fontSizeId ? curTheme.p : text2 }}>{s.name}</span>
              <span style={{ fontSize: 10, color: text2 }}>{s.base}</span>
            </button>
          ))}
        </div>
      </Section>

      {/* ── 6. Joriy dizayn preview ───────────────────────────── */}
      <div style={{ background: curTheme.grad, borderRadius: 20, padding: 20,
        marginBottom: 20, boxShadow: `0 8px 32px ${curTheme.p}40` }}>
        <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
          Joriy dizayn
        </div>
        <div style={{ color: 'white', fontWeight: 800, fontSize: 16, marginBottom: 4 }}>
          {curTheme.emoji} {curTheme.name} · {FONTS.find(f=>f.id===fontId)?.name} · {FONT_SIZES.find(s=>s.id===fontSizeId)?.name}
        </div>
        <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12 }}>
          Barcha o'zgarishlar darhol qo'llaniladi va saqlanadi
        </div>
      </div>

      {/* ── 7. Tizim haqida ───────────────────────────────────── */}
      <Section title="ℹ️ Tizim haqida">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            ['Versiya', '1.0.0'],
            ['Stack', 'Django + React + React Flow'],
            ['Foydalanuvchi', `@${user?.username}`],
            ['Rol', user?.is_superuser ? 'Super Admin' : (user?.role || 'Admin')],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 12,
              padding: '8px 12px', borderRadius: 10,
              background: isDark ? '#0f172a' : '#f8fafc', fontSize: 13 }}>
              <span style={{ color: text2, minWidth: 130, fontWeight: 600 }}>{k}</span>
              <span style={{ fontWeight: 700, color: text1 }}>{v}</span>
            </div>
          ))}
        </div>
      </Section>
    </div>
  )
}
