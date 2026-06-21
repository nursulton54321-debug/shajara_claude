import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import useAuthStore from '../store/authStore'
import useThemeStore from '../store/themeStore'

export default function LoginPage() {
  const [form, setForm]   = useState({ username: '', password: '' })
  const [loading, setLoading] = useState(false)
  const { login }   = useAuthStore()
  const { isDark }  = useThemeStore()
  const navigate    = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const user = await login(form.username, form.password)
      toast.success('Xush kelibsiz!')
      navigate(user.role === 'admin' ? '/admin' : '/tree')
    } catch {
      toast.error('Login yoki parol xato!')
    } finally {
      setLoading(false)
    }
  }

  const pageBg   = isDark ? 'linear-gradient(135deg,#0f172a 0%,#1e1b4b 100%)' : 'linear-gradient(135deg,#eff6ff 0%,#eef2ff 100%)'
  const cardBg   = isDark ? '#1e293b' : '#ffffff'
  const border   = isDark ? '#334155' : 'transparent'
  const text1    = isDark ? '#f1f5f9' : '#1e293b'
  const text2    = isDark ? '#94a3b8' : '#64748b'
  const inputBg  = isDark ? '#0f172a' : '#ffffff'
  const inputBr  = isDark ? '#475569' : '#d1d5db'

  return (
    <div style={{ minHeight:'100vh', background:pageBg,
      display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ background:cardBg, borderRadius:24, padding:36, width:'100%', maxWidth:420,
        border:`1px solid ${border}`, boxShadow: isDark
          ? '0 24px 80px rgba(0,0,0,0.5)' : '0 24px 60px rgba(79,70,229,0.12)' }}>

        <div style={{ textAlign:'center', marginBottom:28 }}>
          <div style={{ fontSize:52, marginBottom:10 }}>🌳</div>
          <h1 style={{ fontSize:20, fontWeight:900, color:text1, lineHeight:1.3 }}>
            Matayev & Abdumannonovlar shajarasi
          </h1>
          <p style={{ color:text2, fontSize:13, marginTop:6 }}>Tizimga kirish</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:16 }}>
          {[
            { key:'username', label:'Foydalanuvchi nomi', type:'text', placeholder:'username kiriting' },
            { key:'password', label:'Parol',              type:'password', placeholder:'••••••••' },
          ].map(({ key, label, type, placeholder }) => (
            <div key={key}>
              <label style={{ display:'block', fontSize:12, fontWeight:700,
                color:text2, marginBottom:6 }}>{label}</label>
              <input type={type} value={form[key]}
                onChange={e => setForm({...form, [key]: e.target.value})}
                placeholder={placeholder} required
                style={{ width:'100%', background:inputBg, border:`1.5px solid ${inputBr}`,
                  borderRadius:12, padding:'11px 16px', fontSize:14, color:text1,
                  outline:'none', boxSizing:'border-box', transition:'border-color 0.2s' }}
                onFocus={e => e.target.style.borderColor='#6366f1'}
                onBlur={e => e.target.style.borderColor=inputBr}
              />
            </div>
          ))}
          <button type="submit" disabled={loading}
            style={{ background:'linear-gradient(135deg,#4f46e5,#7c3aed)',
              color:'white', border:'none', borderRadius:12,
              padding:'12px', fontSize:15, fontWeight:800, cursor:'pointer',
              opacity: loading ? 0.7 : 1,
              boxShadow:'0 6px 20px rgba(79,70,229,0.4)', marginTop:4 }}>
            {loading ? '⏳ Kirish...' : '🚀 Kirish'}
          </button>
        </form>

        <p style={{ textAlign:'center', fontSize:13, color:text2, marginTop:20 }}>
          Hisobingiz yo'qmi?{' '}
          <Link to="/register" style={{ color:'#6366f1', fontWeight:700, textDecoration:'none' }}>
            Ro'yxatdan o'tish
          </Link>
        </p>
      </div>
    </div>
  )
}
