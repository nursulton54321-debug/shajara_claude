/**
 * 4.1 — Invite orqali ro'yxatdan o'tish sahifasi
 * Route: /invite/:token
 */
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getInviteInfo } from '../api/persons'
import { inviteRegister } from '../api/users'
import useAuthStore from '../store/authStore'
import toast from 'react-hot-toast'

export default function InvitePage() {
  const { token } = useParams()
  const navigate  = useNavigate()
  const { login } = useAuthStore()

  const [inviteInfo, setInviteInfo] = useState(null)
  const [inviteErr,  setInviteErr]  = useState('')
  const [loading,    setLoading]    = useState(true)

  const [form, setForm] = useState({
    first_name: '', last_name: '', username: '', password: '', password2: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    getInviteInfo(token)
      .then(r => setInviteInfo(r.data))
      .catch(e => setInviteErr(e?.response?.data?.error || 'Invite topilmadi'))
      .finally(() => setLoading(false))
  }, [token])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.password !== form.password2) { toast.error('Parollar mos emas!'); return }
    if (form.password.length < 6) { toast.error('Parol kamida 6 ta belgi bo\'lishi kerak!'); return }
    setSubmitting(true)
    try {
      const res = await inviteRegister({
        token, username: form.username, password: form.password,
        first_name: form.first_name, last_name: form.last_name,
      })
      login(res.data.user, res.data.access)
      localStorage.setItem('refresh', res.data.refresh)
      toast.success('🎉 Xush kelibsiz!')
      navigate('/')
    } catch (err) {
      const msg = err?.response?.data?.error || 'Xato yuz berdi'
      toast.error(`❌ ${msg}`)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0f172a' }}>
      <div style={{ color: 'white', fontSize: 18 }}>⏳ Yuklanmoqda...</div>
    </div>
  )

  if (inviteErr) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#0f172a,#1e1b4b)' }}>
      <div style={{
        background: 'white', borderRadius: 24, padding: '48px 40px',
        maxWidth: 400, width: '90%', textAlign: 'center',
      }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>❌</div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>
          Invite yaroqsiz
        </h2>
        <p style={{ color: '#64748b', marginBottom: 24 }}>{inviteErr}</p>
        <button onClick={() => navigate('/login')}
          style={{ background: '#6366f1', color: 'white', border: 'none', padding: '10px 24px',
            borderRadius: 10, cursor: 'pointer', fontWeight: 700 }}>
          Kirish sahifasiga o'tish
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'linear-gradient(135deg,#0f172a 0%,#1e1b4b 50%,#0f172a 100%)' }}>

      <div style={{
        background: 'white', borderRadius: 28, padding: '40px',
        maxWidth: 460, width: '100%', boxShadow: '0 32px 80px rgba(0,0,0,0.4)',
      }}>
        {/* Header */}
        <div className="text-center mb-6">
          <div style={{ fontSize: 48, marginBottom: 8 }}>🌳</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a' }}>
            Oila Shajarasiga xush kelibsiz!
          </h1>
          {inviteInfo?.person_name && (
            <div style={{
              marginTop: 12, padding: '10px 16px', borderRadius: 12,
              background: 'linear-gradient(135deg,#eff6ff,#eef2ff)',
              border: '1px solid #c7d2fe',
            }}>
              <p style={{ fontSize: 13, color: '#4338ca', fontWeight: 600 }}>
                👤 Sizning profilingiz: <strong>{inviteInfo.person_name}</strong>
              </p>
              <p style={{ fontSize: 12, color: '#6366f1', marginTop: 2 }}>
                Ro'yxatdan o'tgandan so'ng avtomatik bog'lanadi
              </p>
            </div>
          )}
          {inviteInfo?.note && (
            <p style={{ fontSize: 13, color: '#64748b', marginTop: 8 }}>
              📝 {inviteInfo.note}
            </p>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>
                FAMILIYA
              </label>
              <input type="text" value={form.last_name} onChange={e => set('last_name', e.target.value)}
                placeholder="Karimov"
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e2e8f0',
                  fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>
                ISM
              </label>
              <input type="text" value={form.first_name} onChange={e => set('first_name', e.target.value)}
                placeholder="Abdulloh"
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e2e8f0',
                  fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>
              LOGIN (USERNAME) *
            </label>
            <input type="text" required value={form.username} onChange={e => set('username', e.target.value)}
              placeholder="karimov_abdulloh"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e2e8f0',
                fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>
              PAROL * (kamida 6 belgi)
            </label>
            <input type="password" required value={form.password} onChange={e => set('password', e.target.value)}
              placeholder="••••••••"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e2e8f0',
                fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>
              PAROLNI TASDIQLANG *
            </label>
            <input type="password" required value={form.password2} onChange={e => set('password2', e.target.value)}
              placeholder="••••••••"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10,
                border: `1.5px solid ${form.password2 && form.password !== form.password2 ? '#ef4444' : '#e2e8f0'}`,
                fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
            {form.password2 && form.password !== form.password2 && (
              <p style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>Parollar mos emas</p>
            )}
          </div>

          <button type="submit" disabled={submitting}
            style={{
              width: '100%', padding: '13px', borderRadius: 12, border: 'none',
              background: submitting ? '#a5b4fc' : 'linear-gradient(135deg,#4f46e5,#7c3aed)',
              color: 'white', fontSize: 15, fontWeight: 700, cursor: submitting ? 'default' : 'pointer',
              marginTop: 8,
            }}>
            {submitting ? '⏳ Ro\'yxatdan o\'tilmoqda...' : '🚀 Kirish'}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: 12, color: '#94a3b8', marginTop: 16 }}>
          Allaqachon hisobingiz bormi?{' '}
          <button onClick={() => navigate('/login')}
            style={{ color: '#6366f1', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}>
            Kirish
          </button>
        </p>
      </div>
    </div>
  )
}
