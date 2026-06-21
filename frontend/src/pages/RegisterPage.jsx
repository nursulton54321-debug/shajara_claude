import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../api/axios'
import useThemeStore from '../store/themeStore'

export default function RegisterPage() {
  const [form, setForm] = useState({ username:'', first_name:'', last_name:'', email:'', password:'' })
  const [loading, setLoading] = useState(false)
  const { isDark } = useThemeStore()
  const navigate   = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await api.post('/auth/register/', form)
      toast.success("Muvaffaqiyatli ro'yxatdan o'tdingiz!")
      navigate('/login')
    } catch {
      toast.error("Xato yuz berdi. Username band bo'lishi mumkin.")
    } finally {
      setLoading(false)
    }
  }

  const fields = [
    { key:'username',   label:"Foydalanuvchi nomi *", placeholder:'username' },
    { key:'first_name', label:'Ism',                  placeholder:'Ismingiz' },
    { key:'last_name',  label:'Familiya',             placeholder:'Familiyangiz' },
    { key:'email',      label:'Email',                placeholder:'email@example.com', type:'email' },
    { key:'password',   label:'Parol *',              placeholder:'••••••••',           type:'password' },
  ]

  const pageBg  = isDark ? 'linear-gradient(135deg,#0f172a 0%,#1e1b4b 100%)' : 'linear-gradient(135deg,#eff6ff 0%,#eef2ff 100%)'
  const cardBg  = isDark ? '#1e293b' : '#ffffff'
  const border  = isDark ? '#334155' : 'transparent'
  const text1   = isDark ? '#f1f5f9' : '#1e293b'
  const text2   = isDark ? '#94a3b8' : '#64748b'
  const inputBg = isDark ? '#0f172a' : '#ffffff'
  const inputBr = isDark ? '#475569' : '#d1d5db'

  return (
    <div style={{ minHeight:'100vh', background:pageBg,
      display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ background:cardBg, borderRadius:24, padding:32, width:'100%', maxWidth:420,
        border:`1px solid ${border}`, boxShadow: isDark
          ? '0 24px 80px rgba(0,0,0,0.5)' : '0 24px 60px rgba(79,70,229,0.12)' }}>

        <div style={{ textAlign:'center', marginBottom:24 }}>
          <div style={{ fontSize:44, marginBottom:8 }}>🌳</div>
          <h1 style={{ fontSize:20, fontWeight:900, color:text1 }}>Ro'yxatdan o'tish</h1>
        </div>

        <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:14 }}>
          {fields.map(({ key, label, placeholder, type='text' }) => (
            <div key={key}>
              <label style={{ display:'block', fontSize:12, fontWeight:700,
                color:text2, marginBottom:5 }}>{label}</label>
              <input type={type} value={form[key]}
                onChange={e => setForm({...form, [key]: e.target.value})}
                placeholder={placeholder}
                required={key==='username'||key==='password'}
                style={{ width:'100%', background:inputBg, border:`1.5px solid ${inputBr}`,
                  borderRadius:11, padding:'10px 14px', fontSize:13, color:text1,
                  outline:'none', boxSizing:'border-box', transition:'border-color 0.2s' }}
                onFocus={e => e.target.style.borderColor='#6366f1'}
                onBlur={e => e.target.style.borderColor=inputBr}
              />
            </div>
          ))}
          <button type="submit" disabled={loading}
            style={{ background:'linear-gradient(135deg,#4f46e5,#7c3aed)',
              color:'white', border:'none', borderRadius:12,
              padding:'12px', fontSize:14, fontWeight:800, cursor:'pointer',
              opacity: loading ? 0.7 : 1, marginTop:4,
              boxShadow:'0 6px 20px rgba(79,70,229,0.4)' }}>
            {loading ? '⏳ Yuborilmoqda...' : "✅ Ro'yxatdan o'tish"}
          </button>
        </form>

        <p style={{ textAlign:'center', fontSize:13, color:text2, marginTop:16 }}>
          Hisobingiz bormi?{' '}
          <Link to="/login" style={{ color:'#6366f1', fontWeight:700, textDecoration:'none' }}>Kirish</Link>
        </p>
      </div>
    </div>
  )
}
