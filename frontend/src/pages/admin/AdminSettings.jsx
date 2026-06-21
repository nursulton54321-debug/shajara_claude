import { useState } from 'react'
import toast from 'react-hot-toast'
import useAuthStore from '../../store/authStore'
import useThemeStore from '../../store/themeStore'
import api from '../../api/axios'

export default function AdminSettings() {
  const { user }  = useAuthStore()
  const { isDark } = useThemeStore()
  const [form, setForm] = useState({
    first_name: user?.first_name || '',
    last_name:  user?.last_name  || '',
    email:      user?.email      || '',
  })

  const saveProfile = async (e) => {
    e.preventDefault()
    await api.patch(`/auth/users/${user.id}/`, form)
    toast.success('Profil yangilandi')
  }

  const bg     = isDark ? '#1e293b' : '#ffffff'
  const border = isDark ? '#334155' : '#f1f5f9'
  const text1  = isDark ? '#f1f5f9' : '#1e293b'
  const text2  = isDark ? '#94a3b8' : '#64748b'
  const inputBg= isDark ? '#0f172a' : '#ffffff'
  const inputBr= isDark ? '#475569' : '#d1d5db'

  return (
    <div style={{ padding:24, maxWidth:520 }}>
      <h1 style={{ fontSize:22, fontWeight:900, color:text1, marginBottom:24 }}>⚙️ Sozlamalar</h1>

      {/* Profil */}
      <div style={{ background:bg, borderRadius:16, border:`1px solid ${border}`,
        padding:24, marginBottom:16, boxShadow:'0 2px 12px rgba(0,0,0,0.06)' }}>
        <h2 style={{ fontWeight:800, color:text1, marginBottom:16, fontSize:15 }}>
          👤 Profil ma'lumotlari
        </h2>
        <form onSubmit={saveProfile} style={{ display:'flex', flexDirection:'column', gap:14 }}>
          {[['first_name','Ism'],['last_name','Familiya'],['email','Email']].map(([k,l]) => (
            <div key={k}>
              <label style={{ display:'block', fontSize:12, fontWeight:700, color:text2, marginBottom:5 }}>{l}</label>
              <input type="text" value={form[k]}
                onChange={e => setForm({...form, [k]: e.target.value})}
                style={{ width:'100%', background:inputBg, border:`1px solid ${inputBr}`,
                  borderRadius:10, padding:'9px 14px', fontSize:13, color:text1,
                  outline:'none', boxSizing:'border-box',
                  transition:'border-color 0.2s' }}
                onFocus={e => e.target.style.borderColor='#6366f1'}
                onBlur={e => e.target.style.borderColor=inputBr}
              />
            </div>
          ))}
          <button type="submit" style={{
            background:'linear-gradient(135deg,#4f46e5,#7c3aed)',
            color:'white', border:'none', borderRadius:10,
            padding:'10px 20px', fontSize:13, fontWeight:700, cursor:'pointer',
            alignSelf:'flex-start', boxShadow:'0 4px 12px rgba(79,70,229,0.35)',
          }}>
            💾 Saqlash
          </button>
        </form>
      </div>

      {/* Tizim haqida */}
      <div style={{ background:bg, borderRadius:16, border:`1px solid ${border}`,
        padding:24, boxShadow:'0 2px 12px rgba(0,0,0,0.06)' }}>
        <h2 style={{ fontWeight:800, color:text1, marginBottom:14, fontSize:15 }}>ℹ️ Tizim haqida</h2>
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {[
            ['Versiya', '1.0.0'],
            ['Stack', 'Django + React + React Flow'],
            ['Foydalanuvchi', `@${user?.username}`],
          ].map(([k,v]) => (
            <div key={k} style={{ display:'flex', alignItems:'center', gap:8, fontSize:13 }}>
              <span style={{ color:text2, minWidth:120 }}>{k}:</span>
              <span style={{ fontWeight:700, color:text1 }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
