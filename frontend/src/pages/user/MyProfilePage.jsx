/**
 * Mening profilim — hisob ma'lumotlari va parol almashtirish
 */
import { useState } from 'react'
import { updateMe } from '../../api/users'
import useAuthStore from '../../store/authStore'
import useThemeStore from '../../store/themeStore'
import toast from 'react-hot-toast'

export default function MyProfilePage() {
  const { user, login } = useAuthStore()
  const { isDark }      = useThemeStore()

  const [form, setForm] = useState({
    first_name: user?.first_name || '',
    last_name:  user?.last_name  || '',
    email:      user?.email      || '',
    phone:      user?.phone      || '',
  })
  const [pw, setPw] = useState({ password: '', password2: '' })
  const [saving, setSaving] = useState(false)
  const [pwSaving, setPwSaving] = useState(false)

  const card = {
    background: isDark ? '#1e293b' : '#ffffff',
    borderRadius: 20,
    border: `1px solid ${isDark ? '#334155' : '#f1f5f9'}`,
    boxShadow: isDark ? '0 4px 24px rgba(0,0,0,0.3)' : '0 4px 24px rgba(0,0,0,0.06)',
  }
  const inputStyle = {
    width: '100%', padding: '10px 13px', fontSize: 14,
    borderRadius: 11, outline: 'none',
    background: isDark ? '#0f172a' : '#f8fafc',
    border: `1.5px solid ${isDark ? '#334155' : '#e2e8f0'}`,
    color: 'var(--text-primary)',
    boxSizing: 'border-box',
  }
  const labelStyle = {
    fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)',
    display: 'block', marginBottom: 5,
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await updateMe(form)
      login(res.data, useAuthStore.getState().token)
      toast.success('✅ Ma\'lumotlar saqlandi!')
    } catch { toast.error('Xato yuz berdi') }
    finally { setSaving(false) }
  }

  const handlePwSave = async () => {
    if (!pw.password) { toast.error('Yangi parol kiriting'); return }
    if (pw.password !== pw.password2) { toast.error('Parollar mos emas'); return }
    if (pw.password.length < 6) { toast.error('Parol kamida 6 ta belgi'); return }
    setPwSaving(true)
    try {
      const res = await updateMe({ password: pw.password })
      login(res.data, useAuthStore.getState().token)
      setPw({ password: '', password2: '' })
      toast.success('🔒 Parol yangilandi!')
    } catch { toast.error('Xato yuz berdi') }
    finally { setPwSaving(false) }
  }

  return (
    <div style={{
      padding: '20px 16px', paddingBottom: 88,
      maxWidth: 560, margin: '0 auto',
      color: 'var(--text-primary)',
    }}>

      {/* ── Avatar + ismi ── */}
      <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:24 }}>
        <div style={{
          width:60, height:60, borderRadius:'50%', flexShrink:0,
          background:'linear-gradient(135deg,#6366f1,#7c3aed)',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:26, color:'white', fontWeight:800,
          boxShadow:'0 4px 16px rgba(99,102,241,0.4)',
        }}>
          {user?.first_name?.[0]?.toUpperCase() || user?.username?.[0]?.toUpperCase() || 'U'}
        </div>
        <div>
          <div style={{ fontSize:20, fontWeight:900, letterSpacing:'-0.3px' }}>
            {user?.first_name || ''} {user?.last_name || ''}
          </div>
          <div style={{ fontSize:13, color:'var(--text-secondary)', marginTop:2 }}>
            @{user?.username}
            {user?.is_staff && (
              <span style={{ marginLeft:8, fontSize:10, fontWeight:800, color:'#6366f1',
                background: isDark?'#1e1b4b':'#eef2ff', padding:'2px 8px', borderRadius:20 }}>
                Admin
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Asosiy ma'lumotlar ── */}
      <div style={{ ...card, padding:20, marginBottom:16 }}>
        <div style={{ fontSize:14, fontWeight:800, marginBottom:16, display:'flex', alignItems:'center', gap:8 }}>
          <span style={{
            width:28, height:28, borderRadius:8,
            background:'linear-gradient(135deg,#3b82f6,#6366f1)',
            display:'flex', alignItems:'center', justifyContent:'center', fontSize:13,
          }}>👤</span>
          Shaxsiy ma'lumotlar
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          {[
            ['first_name', 'Ism'],
            ['last_name',  'Familiya'],
          ].map(([k, label]) => (
            <div key={k}>
              <label style={labelStyle}>{label}</label>
              <input
                type="text" value={form[k]}
                onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
                style={inputStyle}
                placeholder={label}
              />
            </div>
          ))}
        </div>

        <div style={{ marginTop:12 }}>
          <label style={labelStyle}>Email</label>
          <input
            type="email" value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            style={inputStyle}
            placeholder="email@example.com"
          />
        </div>

        <div style={{ marginTop:12 }}>
          <label style={labelStyle}>Telefon</label>
          <input
            type="tel" value={form.phone}
            onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
            style={inputStyle}
            placeholder="+998 90 000 00 00"
          />
        </div>

        <button
          onClick={handleSave} disabled={saving}
          style={{
            marginTop:16, width:'100%', padding:'11px', borderRadius:12, border:'none',
            background: saving ? '#a5b4fc' : 'linear-gradient(135deg,#4f46e5,#7c3aed)',
            color:'white', fontWeight:800, fontSize:14, cursor: saving ? 'default' : 'pointer',
            boxShadow:'0 4px 14px rgba(99,102,241,0.35)',
          }}>
          {saving ? '⏳ Saqlanmoqda...' : '💾 Saqlash'}
        </button>
      </div>

      {/* ── Parol almashtirish ── */}
      <div style={{ ...card, padding:20 }}>
        <div style={{ fontSize:14, fontWeight:800, marginBottom:16, display:'flex', alignItems:'center', gap:8 }}>
          <span style={{
            width:28, height:28, borderRadius:8,
            background:'linear-gradient(135deg,#ef4444,#dc2626)',
            display:'flex', alignItems:'center', justifyContent:'center', fontSize:13,
          }}>🔒</span>
          Parolni almashtirish
        </div>

        <div style={{ marginBottom:12 }}>
          <label style={labelStyle}>Yangi parol</label>
          <input
            type="password" value={pw.password}
            onChange={e => setPw(p => ({ ...p, password: e.target.value }))}
            style={inputStyle}
            placeholder="Kamida 6 ta belgi"
          />
        </div>

        <div>
          <label style={labelStyle}>Parolni tasdiqlang</label>
          <input
            type="password" value={pw.password2}
            onChange={e => setPw(p => ({ ...p, password2: e.target.value }))}
            style={{
              ...inputStyle,
              borderColor: pw.password2 && pw.password !== pw.password2
                ? '#ef4444'
                : (isDark ? '#334155' : '#e2e8f0'),
            }}
            placeholder="Parolni qayta kiriting"
          />
          {pw.password2 && pw.password !== pw.password2 && (
            <div style={{ fontSize:11, color:'#ef4444', marginTop:4 }}>
              ⚠️ Parollar mos emas
            </div>
          )}
        </div>

        <button
          onClick={handlePwSave} disabled={pwSaving}
          style={{
            marginTop:16, width:'100%', padding:'11px', borderRadius:12, border:'none',
            background: pwSaving ? '#fca5a5' : 'linear-gradient(135deg,#ef4444,#dc2626)',
            color:'white', fontWeight:800, fontSize:14, cursor: pwSaving ? 'default' : 'pointer',
            boxShadow:'0 4px 14px rgba(239,68,68,0.35)',
          }}>
          {pwSaving ? '⏳ Yangilanmoqda...' : '🔒 Parolni yangilash'}
        </button>
      </div>
    </div>
  )
}
