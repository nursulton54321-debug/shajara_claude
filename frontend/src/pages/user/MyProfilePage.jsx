/**
 * 4.2 — Mening profilim sahifasi
 * Foydalanuvchi o'zini shaxs bilan bog'laydi yoki o'z ma'lumotlarini ko'radi
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getMyProfile, linkMyProfile, unlinkMyProfile, getPersons } from '../../api/persons'
import { updateMe } from '../../api/users'
import useAuthStore from '../../store/authStore'
import useThemeStore from '../../store/themeStore'
import toast from 'react-hot-toast'
import { fmtDate } from '../../utils/date'

export default function MyProfilePage() {
  const { user, login } = useAuthStore()
  const { isDark } = useThemeStore()
  const navigate   = useNavigate()

  const [person,   setPerson]   = useState(null)
  const [persons,  setPersons]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [tab,      setTab]      = useState('profile')  // 'profile' | 'link' | 'account'
  const [linkId,   setLinkId]   = useState('')
  const [linking,  setLinking]  = useState(false)
  const [accountForm, setAccountForm] = useState({
    first_name: user?.first_name || '',
    last_name:  user?.last_name  || '',
    email:      user?.email      || '',
    phone:      user?.phone      || '',
    password:   '', password2:   '',
  })

  const load = () => {
    setLoading(true)
    Promise.all([
      getMyProfile().catch(() => ({ data: null })),
      getPersons({ page_size: 1000 }),
    ]).then(([prof, prs]) => {
      setPerson(prof.data)
      setPersons(prs.data)
    }).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const handleLink = async () => {
    if (!linkId) { toast.error('Shaxsni tanlang'); return }
    setLinking(true)
    try {
      const res = await linkMyProfile(parseInt(linkId))
      setPerson(res.data)
      toast.success('✅ Profil bog\'landi!')
      setTab('profile')
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Xato')
    } finally { setLinking(false) }
  }

  const handleUnlink = async () => {
    if (!confirm('Profilni uzmoqchimisiz?')) return
    await unlinkMyProfile()
    setPerson(null)
    toast.success('Bog\'liqlik uzildi')
  }

  const handleAccountSave = async () => {
    if (accountForm.password && accountForm.password !== accountForm.password2) {
      toast.error('Parollar mos emas'); return
    }
    try {
      const payload = {
        first_name: accountForm.first_name,
        last_name:  accountForm.last_name,
        email:      accountForm.email,
        phone:      accountForm.phone,
      }
      if (accountForm.password) payload.password = accountForm.password
      const res = await updateMe(payload)
      login(res.data, useAuthStore.getState().token)
      toast.success('✅ Profil yangilandi!')
    } catch { toast.error('Xato') }
  }

  const card = {
    background: isDark ? 'var(--card-bg)' : 'white',
    borderRadius: 20, padding: 24,
    border: '1px solid var(--border-subtle)',
    boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5 page-enter" style={{ color: 'var(--text-primary)' }}>

      {/* Header */}
      <div className="flex items-center gap-4">
        <div style={{
          width: 56, height: 56, borderRadius: '50%', flexShrink: 0,
          background: 'linear-gradient(135deg,#6366f1,#7c3aed)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 24, color: 'white', fontWeight: 700,
        }}>
          {user?.first_name?.[0] || user?.username?.[0] || 'U'}
        </div>
        <div>
          <h1 className="text-2xl font-bold">Mening profilim</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
            {user?.first_name} {user?.last_name} · @{user?.username}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2" style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: 0 }}>
        {[
          { key: 'profile', label: '👤 Shaxs profili' },
          { key: 'link',    label: '🔗 Bog\'lash' },
          { key: 'account', label: '⚙️ Hisob' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{
              padding: '8px 16px', fontSize: 13, fontWeight: 600,
              background: 'none', border: 'none', cursor: 'pointer',
              borderBottom: tab === t.key ? '2.5px solid #6366f1' : '2.5px solid transparent',
              color: tab === t.key ? '#6366f1' : 'var(--text-secondary)',
              marginBottom: -1,
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16" style={{ color: 'var(--text-secondary)' }}>⏳ Yuklanmoqda...</div>
      ) : (
        <>
          {/* TAB: Profile */}
          {tab === 'profile' && (
            person ? (
              <div style={card}>
                {/* Person card */}
                <div className="flex items-center gap-5 mb-6">
                  <div style={{
                    width: 80, height: 80, borderRadius: 16, overflow: 'hidden', flexShrink: 0,
                    background: person.gender === 'male' ? '#eef2ff' : '#fff0f8',
                    border: `3px solid ${person.gender === 'male' ? '#6366f1' : '#ec4899'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36,
                  }}>
                    {person.photo_url
                      ? <img src={person.photo_url} className="w-full h-full object-cover" alt="" />
                      : <span>{person.gender === 'male' ? '👨' : '👩'}</span>}
                  </div>
                  <div>
                    <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>
                      {person.full_name}
                    </h2>
                    {person.birth_date && (
                      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                        🎂 {fmtDate(person.birth_date)}
                        {person.age != null && ` · ${person.age} yosh`}
                      </p>
                    )}
                    {person.birth_place && (
                      <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                        📍 {person.birth_place}
                      </p>
                    )}
                  </div>
                  <div className="ml-auto flex gap-2 flex-wrap">
                    <button onClick={() => navigate(`/persons/${person.id}`)}
                      style={{ padding: '7px 14px', borderRadius: 9, fontSize: 12, fontWeight: 600,
                        background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: 'white',
                        border: 'none', cursor: 'pointer' }}>
                      👁 Ko'rish
                    </button>
                    <button onClick={() => navigate(`/persons/${person.id}/edit`)}
                      style={{ padding: '7px 14px', borderRadius: 9, fontSize: 12, fontWeight: 600,
                        background: '#f1f5f9', color: '#475569',
                        border: '1px solid #e2e8f0', cursor: 'pointer' }}>
                      ✏️ Tahrirlash
                    </button>
                    <button onClick={handleUnlink}
                      style={{ padding: '7px 14px', borderRadius: 9, fontSize: 12, fontWeight: 600,
                        background: '#fee2e2', color: '#dc2626',
                        border: '1px solid #fca5a5', cursor: 'pointer' }}>
                      🔗 Uzish
                    </button>
                  </div>
                </div>

                {/* Public link */}
                {person.slug && (
                  <div style={{
                    padding: '12px 16px', borderRadius: 12,
                    background: isDark ? '#1e293b' : '#f8fafc',
                    border: '1px solid var(--border-subtle)',
                  }}>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                      🔗 Public havola
                    </div>
                    <div className="flex items-center gap-2">
                      <code style={{ fontSize: 13, color: '#6366f1', flex: 1 }}>
                        {window.location.origin}/#/p/{person.slug}
                      </code>
                      <button onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/#/p/${person.slug}`)
                        toast.success('Nusxa olindi!')
                      }} style={{ padding: '4px 10px', borderRadius: 7, fontSize: 11,
                        background: '#eff6ff', color: '#3b82f6', border: '1px solid #bfdbfe', cursor: 'pointer' }}>
                        📋 Nusxa
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ ...card, textAlign: 'center', padding: 40 }}>
                <div style={{ fontSize: 56, marginBottom: 12 }}>🔍</div>
                <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
                  Profil bog'lanmagan
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 20 }}>
                  Hali siz oila shajarasidagi biror shaxs bilan bog'lanmagan edingiz.
                  "Bog'lash" tabida o'zingizni toping.
                </p>
                <button onClick={() => setTab('link')}
                  style={{ padding: '10px 24px', borderRadius: 10, border: 'none',
                    background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
                    color: 'white', fontWeight: 700, cursor: 'pointer' }}>
                  🔗 Profilni bog'lash
                </button>
              </div>
            )
          )}

          {/* TAB: Link */}
          {tab === 'link' && (
            <div style={card} className="space-y-4">
              <h3 style={{ fontWeight: 700, fontSize: 16 }}>🔗 Shaxs profilingizni toping</h3>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                Shajara daraxtida o'zingizni topib, profil bilan bog'lang.
                Shundan so'ng siz o'z ma'lumotlaringizni to'g'ridan-to'g'ri tahrirlashingiz mumkin.
              </p>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                  Shaxsni tanlang
                </label>
                <select value={linkId} onChange={e => setLinkId(e.target.value)}
                  className="input-field"
                  style={{ width: '100%', padding: '10px 12px', fontSize: 13 }}>
                  <option value="">— Tanlang —</option>
                  {persons.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.full_name}
                      {p.birth_date ? ` (${new Date(p.birth_date).getFullYear()})` : ''}
                      {p.gender === 'male' ? ' — Erkak' : ' — Ayol'}
                    </option>
                  ))}
                </select>
              </div>
              <button onClick={handleLink} disabled={linking || !linkId}
                style={{
                  padding: '10px 24px', borderRadius: 10, border: 'none',
                  background: linking || !linkId ? '#a5b4fc' : 'linear-gradient(135deg,#4f46e5,#7c3aed)',
                  color: 'white', fontWeight: 700, cursor: linking || !linkId ? 'default' : 'pointer',
                }}>
                {linking ? '⏳...' : '✅ Bog\'lash'}
              </button>
            </div>
          )}

          {/* TAB: Account */}
          {tab === 'account' && (
            <div style={card} className="space-y-4">
              <h3 style={{ fontWeight: 700, fontSize: 16 }}>⚙️ Hisob ma'lumotlari</h3>
              <div className="grid grid-cols-2 gap-4">
                {[
                  ['first_name', 'Ism', 'text'],
                  ['last_name',  'Familiya', 'text'],
                  ['email',      'Email', 'email'],
                  ['phone',      'Telefon', 'tel'],
                ].map(([k, label, type]) => (
                  <div key={k}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                      {label}
                    </label>
                    <input type={type} value={accountForm[k]}
                      onChange={e => setAccountForm(f => ({ ...f, [k]: e.target.value }))}
                      className="input-field" style={{ width: '100%', padding: '9px 12px', fontSize: 13 }} />
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-4" style={{
                borderTop: '1px solid var(--border-subtle)', paddingTop: 16,
              }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                    Yangi parol (ixtiyoriy)
                  </label>
                  <input type="password" value={accountForm.password}
                    onChange={e => setAccountForm(f => ({ ...f, password: e.target.value }))}
                    className="input-field" placeholder="••••••••"
                    style={{ width: '100%', padding: '9px 12px', fontSize: 13 }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                    Parolni tasdiqlash
                  </label>
                  <input type="password" value={accountForm.password2}
                    onChange={e => setAccountForm(f => ({ ...f, password2: e.target.value }))}
                    className="input-field" placeholder="••••••••"
                    style={{ width: '100%', padding: '9px 12px', fontSize: 13,
                      borderColor: accountForm.password2 && accountForm.password !== accountForm.password2 ? '#ef4444' : undefined }} />
                </div>
              </div>
              <button onClick={handleAccountSave}
                style={{ padding: '10px 24px', borderRadius: 10, border: 'none',
                  background: 'linear-gradient(135deg,#10b981,#059669)',
                  color: 'white', fontWeight: 700, cursor: 'pointer' }}>
                💾 Saqlash
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
