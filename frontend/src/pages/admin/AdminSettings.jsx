import { useState } from 'react'
import toast from 'react-hot-toast'
import useAuthStore from '../../store/authStore'
import useThemeStore from '../../store/themeStore'
import useDesignStore, { THEMES, FONTS, FONT_SIZES } from '../../store/designStore'
import api from '../../api/axios'

const TABS = [
  { id: 'profile',  icon: '👤', label: 'Profil' },
  { id: 'password', icon: '🔐', label: 'Parol' },
  { id: 'theme',    icon: '🎨', label: 'Dizayn' },
  { id: 'system',   icon: 'ℹ️',  label: 'Tizim' },
]

export default function AdminSettings() {
  const { user }   = useAuthStore()
  const { isDark } = useThemeStore()
  const { themeId, fontId, fontSizeId, setTheme, setFont, setFontSize } = useDesignStore()

  const [activeTab, setActiveTab] = useState('profile')
  const [profile, setProfile] = useState({
    first_name: user?.first_name || '',
    last_name:  user?.last_name  || '',
    email:      user?.email      || '',
  })
  const [pwd, setPwd] = useState({ old: '', new1: '', new2: '' })
  const [pwdLoading, setPwdLoading] = useState(false)

  const bg      = isDark ? '#1e293b' : '#ffffff'
  const pageBg  = isDark ? '#0f172a' : '#f1f5f9'
  const border  = isDark ? '#334155' : '#e2e8f0'
  const text1   = isDark ? '#f1f5f9' : '#1e293b'
  const text2   = isDark ? '#94a3b8' : '#64748b'
  const inputBg = isDark ? '#0f172a' : '#f8fafc'
  const inputBr = isDark ? '#475569' : '#d1d5db'
  const sidebarBg = isDark ? '#161f2e' : '#e8edf5'

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

  const Input = ({ label, type = 'text', value, onChange, placeholder }) => (
    <div>
      <label style={{ display:'block', fontSize:11, fontWeight:700, color:text2,
        marginBottom:6, textTransform:'uppercase', letterSpacing:'0.08em' }}>{label}</label>
      <input type={type} value={value} onChange={onChange} placeholder={placeholder}
        style={{ width:'100%', background:inputBg, border:`1.5px solid ${inputBr}`,
          borderRadius:12, padding:'11px 14px', fontSize:13, color:text1,
          outline:'none', boxSizing:'border-box', transition:'border-color 0.2s, box-shadow 0.2s' }}
        onFocus={e => { e.target.style.borderColor = curTheme.p; e.target.style.boxShadow = `0 0 0 3px ${curTheme.p}22` }}
        onBlur={e => { e.target.style.borderColor = inputBr; e.target.style.boxShadow = 'none' }}
      />
    </div>
  )

  const Btn = ({ label, loading, onClick, type = 'submit', secondary = false }) => (
    <button type={type} onClick={onClick} disabled={loading} style={{
      background: secondary ? 'transparent' : curTheme.grad,
      color: secondary ? curTheme.p : 'white',
      border: secondary ? `2px solid ${curTheme.p}` : 'none',
      borderRadius:12, padding:'11px 24px', fontSize:13, fontWeight:700,
      cursor: loading ? 'not-allowed' : 'pointer',
      opacity: loading ? 0.7 : 1,
      boxShadow: secondary ? 'none' : `0 4px 14px ${curTheme.p}44`,
      transition:'all 0.2s',
    }}>{loading ? '⏳ Saqlanmoqda...' : label}</button>
  )

  // ── Avatar initials ──────────────────────────────────────────────
  const initials = ((profile.first_name?.[0] || '') + (profile.last_name?.[0] || '')).toUpperCase() || user?.username?.[0]?.toUpperCase() || '?'

  // ── Tab content ──────────────────────────────────────────────────
  const renderContent = () => {
    if (activeTab === 'profile') return (
      <div style={{ display:'flex', flexDirection:'column', gap:28 }}>
        {/* Avatar hero */}
        <div style={{ display:'flex', alignItems:'center', gap:20,
          background: isDark ? '#0f172a' : '#f8fafc',
          borderRadius:20, padding:'20px 24px',
          border:`1px solid ${border}` }}>
          <div style={{ width:72, height:72, borderRadius:'50%',
            background:curTheme.grad, display:'flex', alignItems:'center',
            justifyContent:'center', fontSize:26, fontWeight:900, color:'white',
            boxShadow:`0 8px 24px ${curTheme.p}55`, flexShrink:0 }}>
            {initials}
          </div>
          <div>
            <div style={{ fontSize:18, fontWeight:800, color:text1 }}>
              {profile.first_name || profile.last_name
                ? `${profile.first_name} ${profile.last_name}`.trim()
                : user?.username}
            </div>
            <div style={{ fontSize:12, color:curTheme.p, fontWeight:700, marginTop:2 }}>
              {user?.is_superuser ? '⭐ Super Admin' : (user?.role || 'Admin')}
            </div>
            <div style={{ fontSize:12, color:text2, marginTop:4 }}>{profile.email}</div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={saveProfile} style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
            <Input label="Ism"      value={profile.first_name} onChange={e => setProfile({...profile, first_name: e.target.value})} />
            <Input label="Familiya" value={profile.last_name}  onChange={e => setProfile({...profile, last_name:  e.target.value})} />
          </div>
          <Input label="Email" type="email" value={profile.email} onChange={e => setProfile({...profile, email: e.target.value})} />
          <div style={{ display:'flex', gap:10 }}>
            <Btn label="💾 Saqlash" />
          </div>
        </form>
      </div>
    )

    if (activeTab === 'password') return (
      <div style={{ display:'flex', flexDirection:'column', gap:24 }}>
        {/* Shield banner */}
        <div style={{ background:curTheme.grad, borderRadius:20, padding:'20px 24px',
          display:'flex', alignItems:'center', gap:16,
          boxShadow:`0 8px 24px ${curTheme.p}40` }}>
          <div style={{ fontSize:40 }}>🛡️</div>
          <div>
            <div style={{ color:'white', fontWeight:800, fontSize:16 }}>Xavfsizlik</div>
            <div style={{ color:'rgba(255,255,255,0.75)', fontSize:12, marginTop:2 }}>
              Parolingizni muntazam yangilab turing
            </div>
          </div>
        </div>

        <form onSubmit={savePassword} style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <Input label="Joriy parol" type="password" value={pwd.old}
            onChange={e => setPwd({...pwd, old: e.target.value})} placeholder="••••••••" />
          <div style={{ height:1, background:border }} />
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
            <Input label="Yangi parol" type="password" value={pwd.new1}
              onChange={e => setPwd({...pwd, new1: e.target.value})} placeholder="••••••••" />
            <Input label="Yangi parol (takror)" type="password" value={pwd.new2}
              onChange={e => setPwd({...pwd, new2: e.target.value})} placeholder="••••••••" />
          </div>
          {pwd.new1 && pwd.new2 && pwd.new1 !== pwd.new2 && (
            <div style={{ fontSize:12, color:'#ef4444', fontWeight:600,
              background:'#fef2f2', borderRadius:8, padding:'8px 12px',
              border:'1px solid #fecaca' }}>⚠️ Parollar mos kelmadi</div>
          )}
          {/* Strength bar */}
          {pwd.new1 && (
            <div>
              <div style={{ fontSize:11, color:text2, marginBottom:4, fontWeight:600 }}>Parol kuchi</div>
              <div style={{ height:6, borderRadius:99, background:isDark?'#334155':'#e2e8f0', overflow:'hidden' }}>
                <div style={{ height:'100%', borderRadius:99, transition:'all 0.3s',
                  width: pwd.new1.length >= 10 ? '100%' : pwd.new1.length >= 7 ? '60%' : '30%',
                  background: pwd.new1.length >= 10 ? '#10b981' : pwd.new1.length >= 7 ? '#f59e0b' : '#ef4444',
                }} />
              </div>
            </div>
          )}
          <div style={{ display:'flex', gap:10 }}>
            <Btn label="🔑 Parolni o'zgartirish" loading={pwdLoading} />
          </div>
        </form>
      </div>
    )

    if (activeTab === 'theme') return (
      <div style={{ display:'flex', flexDirection:'column', gap:28 }}>
        {/* Live preview strip */}
        <div style={{ background:curTheme.grad, borderRadius:20, padding:'18px 22px',
          display:'flex', alignItems:'center', justifyContent:'space-between',
          boxShadow:`0 8px 28px ${curTheme.p}50`, flexWrap:'wrap', gap:10 }}>
          <div>
            <div style={{ color:'rgba(255,255,255,0.65)', fontSize:10, fontWeight:800,
              textTransform:'uppercase', letterSpacing:'0.12em' }}>Aktiv dizayn</div>
            <div style={{ color:'white', fontWeight:900, fontSize:18, marginTop:2 }}>
              {curTheme.emoji} {curTheme.name}
            </div>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            {['A', 'Aa', 'AAA'].map((a,i) => (
              <div key={i} style={{ width:36, height:36, borderRadius:10,
                background:'rgba(255,255,255,0.15)', display:'flex',
                alignItems:'center', justifyContent:'center',
                color:'white', fontWeight:900, fontSize:[11,14,18][i],
                border: fontSizeId === ['sm','md','lg'][i] ? '2px solid white' : '2px solid transparent' }}>
                {a}
              </div>
            ))}
          </div>
        </div>

        {/* Color themes — 2 rows x 4 cols */}
        <div>
          <div style={{ fontSize:12, fontWeight:800, color:text2, marginBottom:12,
            textTransform:'uppercase', letterSpacing:'0.08em' }}>🎨 Rang temasi</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
            {THEMES.map(t => {
              const active = t.id === themeId
              return (
                <button key={t.id} onClick={() => setTheme(t.id)} style={{
                  background: active
                    ? (isDark ? `${t.p}18` : `${t.p}12`)
                    : (isDark ? '#0f172a' : '#f8fafc'),
                  border:`2px solid ${active ? t.p : border}`,
                  borderRadius:16, padding:'14px 8px', cursor:'pointer',
                  display:'flex', flexDirection:'column', alignItems:'center', gap:7,
                  transition:'all 0.2s',
                  boxShadow: active ? `0 0 0 3px ${t.p}30, 0 4px 16px ${t.p}30` : 'none',
                  transform: active ? 'scale(1.04)' : 'scale(1)',
                }}>
                  <div style={{ width:38, height:38, borderRadius:'50%',
                    background:t.grad, boxShadow:`0 4px 12px ${t.p}60`,
                    display:'flex', alignItems:'center', justifyContent:'center', fontSize:17 }}>
                    {t.emoji}
                  </div>
                  <span style={{ fontSize:11, fontWeight:800, color: active ? t.p : text2 }}>
                    {t.name}
                  </span>
                  {active && (
                    <div style={{ width:20, height:4, borderRadius:99, background:t.grad }} />
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Font type */}
        <div>
          <div style={{ fontSize:12, fontWeight:800, color:text2, marginBottom:12,
            textTransform:'uppercase', letterSpacing:'0.08em' }}>🔤 Shrift turi</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            {FONTS.map(f => {
              const active = f.id === fontId
              return (
                <button key={f.id} onClick={() => setFont(f.id)} style={{
                  display:'flex', alignItems:'center', gap:12,
                  padding:'12px 14px', borderRadius:14, cursor:'pointer',
                  background: active ? (isDark ? `${curTheme.p}18` : `${curTheme.p}10`) : (isDark ? '#0f172a' : '#f8fafc'),
                  border:`1.5px solid ${active ? curTheme.p : border}`,
                  transition:'all 0.2s',
                  boxShadow: active ? `0 0 0 2px ${curTheme.p}25` : 'none',
                }}>
                  <div style={{ width:40, height:40, borderRadius:10, flexShrink:0,
                    background: active ? curTheme.grad : (isDark ? '#1e293b' : '#e2e8f0'),
                    display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <span style={{ fontFamily:f.family, fontWeight:900, fontSize:17,
                      color: active ? 'white' : text2 }}>Aa</span>
                  </div>
                  <div style={{ textAlign:'left', overflow:'hidden' }}>
                    <div style={{ fontSize:13, fontWeight:700, color: active ? curTheme.p : text1,
                      fontFamily:f.family, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                      {f.name}
                    </div>
                    <div style={{ fontSize:11, color:text2, fontFamily:f.family }}>
                      Shajara daraxti
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Font size */}
        <div>
          <div style={{ fontSize:12, fontWeight:800, color:text2, marginBottom:12,
            textTransform:'uppercase', letterSpacing:'0.08em' }}>📐 Matn o'lchami</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
            {FONT_SIZES.map((s, i) => {
              const active = s.id === fontSizeId
              return (
                <button key={s.id} onClick={() => setFontSize(s.id)} style={{
                  padding:'18px 10px', borderRadius:16, cursor:'pointer',
                  background: active ? (isDark ? `${curTheme.p}18` : `${curTheme.p}10`) : (isDark ? '#0f172a' : '#f8fafc'),
                  border:`1.5px solid ${active ? curTheme.p : border}`,
                  display:'flex', flexDirection:'column', alignItems:'center', gap:6,
                  boxShadow: active ? `0 0 0 2px ${curTheme.p}25, 0 4px 16px ${curTheme.p}20` : 'none',
                  transform: active ? 'scale(1.03)' : 'scale(1)',
                  transition:'all 0.2s',
                }}>
                  <span style={{ fontSize:[18,26,36][i], fontWeight:900, lineHeight:1,
                    color: active ? curTheme.p : text2 }}>A</span>
                  <span style={{ fontSize:11, fontWeight:800, color: active ? curTheme.p : text2 }}>{s.name}</span>
                  <span style={{ fontSize:10, color:text2, background: isDark?'#1e293b':'#e2e8f0',
                    padding:'2px 8px', borderRadius:99 }}>{s.base}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    )

    if (activeTab === 'system') return (
      <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
        {/* App card */}
        <div style={{ background:curTheme.grad, borderRadius:20, padding:'24px',
          boxShadow:`0 8px 28px ${curTheme.p}45` }}>
          <div style={{ fontSize:40, marginBottom:8 }}>🌳</div>
          <div style={{ color:'white', fontWeight:900, fontSize:20 }}>Shajara</div>
          <div style={{ color:'rgba(255,255,255,0.7)', fontSize:12, marginTop:4 }}>
            Oila daraxti boshqaruv tizimi
          </div>
          <div style={{ marginTop:14, display:'flex', gap:8, flexWrap:'wrap' }}>
            {['Django', 'React', 'React Flow', 'Telegram Bot'].map(tag => (
              <span key={tag} style={{ background:'rgba(255,255,255,0.2)',
                color:'white', fontSize:11, fontWeight:700,
                padding:'3px 10px', borderRadius:99 }}>{tag}</span>
            ))}
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          {[
            { icon:'👤', label:'Foydalanuvchi', value:`@${user?.username}` },
            { icon:'⭐', label:'Rol',            value: user?.is_superuser ? 'Super Admin' : (user?.role || 'Admin') },
            { icon:'🏷️', label:'Versiya',        value:'1.0.0' },
            { icon:'📅', label:'Sana',            value: new Date().toLocaleDateString('uz-UZ') },
          ].map(({ icon, label, value }) => (
            <div key={label} style={{ background:isDark?'#0f172a':'#f8fafc',
              border:`1px solid ${border}`, borderRadius:16,
              padding:'16px', display:'flex', flexDirection:'column', gap:6 }}>
              <div style={{ fontSize:22 }}>{icon}</div>
              <div style={{ fontSize:11, color:text2, fontWeight:700,
                textTransform:'uppercase', letterSpacing:'0.06em' }}>{label}</div>
              <div style={{ fontSize:14, fontWeight:800, color:text1 }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Current design summary */}
        <div style={{ background:isDark?'#0f172a':'#f8fafc',
          border:`1px solid ${border}`, borderRadius:16, padding:16 }}>
          <div style={{ fontSize:12, color:text2, fontWeight:700, marginBottom:12,
            textTransform:'uppercase', letterSpacing:'0.08em' }}>Joriy dizayn sozlamalari</div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {[
              ['Rang temasi', `${curTheme.emoji} ${curTheme.name}`],
              ['Shrift',      FONTS.find(f=>f.id===fontId)?.name || '—'],
              ["O'lcham",    FONT_SIZES.find(s=>s.id===fontSizeId)?.name || '—'],
            ].map(([k, v]) => (
              <div key={k} style={{ display:'flex', alignItems:'center',
                justifyContent:'space-between', padding:'6px 0',
                borderBottom:`1px solid ${isDark?'#1e293b':'#e2e8f0'}` }}>
                <span style={{ fontSize:13, color:text2, fontWeight:600 }}>{k}</span>
                <span style={{ fontSize:13, fontWeight:800, color:text1 }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* ── Mobile tabs (top bar) ─────────────────────────────────── */}
      <div style={{ display:'none' }} className="settings-mobile-tabs">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`smt-tab ${activeTab === t.id ? 'smt-active' : ''}`}
            style={{ '--accent': curTheme.p, '--accent-grad': curTheme.grad }}>
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      <style>{`
        @media (max-width: 768px) {
          .settings-mobile-tabs { display:flex !important; }
          .settings-sidebar { display:none !important; }
        }
        .settings-mobile-tabs {
          position: sticky; top: 0; z-index: 10;
          background: ${pageBg};
          border-bottom: 1px solid ${border};
          padding: 8px 12px; gap: 6px; overflow-x: auto;
        }
        .smt-tab {
          display: flex; align-items: center; gap: 5px;
          padding: 7px 14px; border-radius: 99px; border: none;
          font-size: 12px; font-weight: 700; cursor: pointer;
          white-space: nowrap; transition: all 0.2s;
          background: ${isDark ? '#1e293b' : '#e2e8f0'};
          color: ${text2};
        }
        .smt-tab.smt-active {
          background: var(--accent-grad);
          color: white;
          box-shadow: 0 3px 10px var(--accent)44;
        }
        .settings-sidebar-btn {
          display: flex; align-items: center; gap: 12px;
          padding: 13px 16px; border-radius: 14px; border: none;
          font-size: 13px; font-weight: 700; cursor: pointer;
          transition: all 0.2s; width: 100%; text-align: left;
          background: transparent; color: ${text2};
        }
        .settings-sidebar-btn:hover {
          background: ${isDark ? '#1e293b' : '#dde4ef'};
          color: ${text1};
        }
        .settings-sidebar-btn.active {
          background: var(--accent-grad);
          color: white;
          box-shadow: 0 4px 14px var(--accent)44;
        }
        .settings-sidebar-btn .s-icon {
          width: 34px; height: 34px; border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          font-size: 16px; flex-shrink: 0;
          background: rgba(255,255,255,0.18);
          transition: background 0.2s;
        }
        .settings-sidebar-btn:not(.active) .s-icon {
          background: ${isDark ? '#1e293b' : '#dde4ef'};
        }
      `}</style>

      {/* ── Main layout ───────────────────────────────────────────── */}
      <div style={{ display:'flex', height:'100%', minHeight:'calc(100vh - 60px)',
        background:pageBg, overflow:'hidden' }}>

        {/* Sidebar */}
        <div className="settings-sidebar" style={{
          width:220, flexShrink:0, background:sidebarBg,
          borderRight:`1px solid ${border}`,
          display:'flex', flexDirection:'column',
          padding:'24px 12px', gap:4,
        }}>
          {/* User mini card */}
          <div style={{ textAlign:'center', marginBottom:20, padding:'0 4px' }}>
            <div style={{ width:52, height:52, borderRadius:'50%',
              background:curTheme.grad, display:'flex', alignItems:'center',
              justifyContent:'center', fontSize:20, fontWeight:900, color:'white',
              margin:'0 auto 10px', boxShadow:`0 6px 18px ${curTheme.p}55` }}>
              {initials}
            </div>
            <div style={{ fontSize:13, fontWeight:800, color:text1,
              whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
              {profile.first_name || profile.last_name
                ? `${profile.first_name} ${profile.last_name}`.trim()
                : user?.username}
            </div>
            <div style={{ fontSize:11, color:curTheme.p, fontWeight:700, marginTop:2 }}>
              {user?.is_superuser ? '⭐ Super Admin' : 'Admin'}
            </div>
          </div>

          <div style={{ height:1, background:border, margin:'0 4px 12px' }} />

          {TABS.map(t => (
            <button key={t.id}
              className={`settings-sidebar-btn ${activeTab === t.id ? 'active' : ''}`}
              onClick={() => setActiveTab(t.id)}
              style={{ '--accent': curTheme.p, '--accent-grad': curTheme.grad }}>
              <span className="s-icon">{t.icon}</span>
              {t.label}
            </button>
          ))}

          {/* Bottom decoration */}
          <div style={{ marginTop:'auto', padding:'12px 4px 0' }}>
            <div style={{ background:curTheme.grad, borderRadius:14, padding:'12px 14px',
              boxShadow:`0 4px 14px ${curTheme.p}40` }}>
              <div style={{ color:'rgba(255,255,255,0.7)', fontSize:10, fontWeight:700,
                textTransform:'uppercase', letterSpacing:'0.1em' }}>Aktiv tema</div>
              <div style={{ color:'white', fontWeight:900, fontSize:14, marginTop:3 }}>
                {curTheme.emoji} {curTheme.name}
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex:1, overflow:'auto', padding:'28px 32px' }}>
          {/* Header */}
          <div style={{ marginBottom:24, display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ width:44, height:44, borderRadius:14, background:curTheme.grad,
              display:'flex', alignItems:'center', justifyContent:'center', fontSize:20,
              boxShadow:`0 4px 14px ${curTheme.p}44` }}>
              {TABS.find(t => t.id === activeTab)?.icon}
            </div>
            <div>
              <h1 style={{ fontSize:20, fontWeight:900, color:text1, margin:0 }}>
                {TABS.find(t => t.id === activeTab)?.label}
              </h1>
              <div style={{ fontSize:12, color:text2, marginTop:2 }}>
                {activeTab === 'profile'  && 'Shaxsiy ma\'lumotlaringizni tahrirlang'}
                {activeTab === 'password' && 'Hisobingiz xavfsizligini kuchaytiring'}
                {activeTab === 'theme'    && 'Interfeys ko\'rinishini o\'zgartiring'}
                {activeTab === 'system'   && 'Tizim va versiya haqida ma\'lumot'}
              </div>
            </div>
          </div>

          {/* Card */}
          <div style={{ background:bg, borderRadius:24, border:`1px solid ${border}`,
            padding:'28px', boxShadow: isDark
              ? '0 8px 32px rgba(0,0,0,0.35)'
              : '0 8px 32px rgba(0,0,0,0.07)',
            maxWidth: activeTab === 'theme' ? 700 : 560,
          }}>
            {renderContent()}
          </div>
        </div>
      </div>
    </>
  )
}
