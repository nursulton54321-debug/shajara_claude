import { useEffect, useState } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import useAuthStore from '../../store/authStore'
import useThemeStore from '../../store/themeStore'
import GlobalSearch, { useGlobalSearchTrigger } from '../../components/GlobalSearch'
import AuthModal from '../../components/AuthModal'
import { clearPinSession } from '../../components/PinGate'

const BASE_NAV = [
  { to: '/',              label: 'Daraxt',           icon: '🌳', end: true },
  { to: '/dashboard',     label: 'Bosh sahifa',      icon: '🏠' },
  { to: '/persons',       label: 'Shaxslar',         icon: '👥' },
  { to: '/statistics',    label: 'Statistika',       icon: '📊' },
  { to: '/relationship',  label: 'Munosabat',        icon: '🔗' },
  { to: '/my-profile',    label: 'Mening profilim',  icon: '👤' },
  { to: '/notifications', label: 'Bildirishnomalar', icon: '🔔' },
]

const STYLES = `
@keyframes labelIn {
  from { opacity:0; transform:translateX(-10px) }
  to   { opacity:1; transform:translateX(0) }
}
@keyframes tipIn {
  from { opacity:0; transform:translateX(-8px) }
  to   { opacity:1; transform:translateX(0) }
}

.ul-nav-link {
  display: flex;
  align-items: center;
  text-decoration: none;
  border-radius: 11px;
  transition: background 0.15s, color 0.15s, transform 0.18s;
  position: relative;
}
.ul-nav-link:not(.active):hover {
  transform: translateX(3px);
}
.ul-nav-link.active {
  background: linear-gradient(135deg,#3b82f6,#6366f1) !important;
  color: white !important;
  box-shadow: 0 4px 14px rgba(59,130,246,0.38);
}
`

export default function UserLayout() {
  const { user, logout, isAdmin } = useAuthStore()
  const { isDark, toggle, init }  = useThemeStore()
  const navigate   = useNavigate()
  const location   = useLocation()
  const openSearch = useGlobalSearchTrigger()

  // Admin uchun "Qo'shish" nav itemini qo'shish
  const navItems = isAdmin()
    ? [BASE_NAV[0], BASE_NAV[1], BASE_NAV[2],
       { to: '/persons/add', label: "Qo'shish", icon: '➕' },
       ...BASE_NAV.slice(3)]
    : BASE_NAV

  const [collapsed, setCollapsed]        = useState(() => {
    const saved = localStorage.getItem('sidebar_collapsed')
    if (saved !== null) return saved === 'true'
    return !user  // guest: yopiq, login: ochiq
  })
  const [tip, setTip]                    = useState(null)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [fabOpen, setFabOpen]            = useState(false)

  useEffect(() => { init() }, [])

  // collapsed o'zgarganda localStorage ga yoz
  function setCollapsedPersist(val) {
    setCollapsed(val)
    localStorage.setItem('sidebar_collapsed', String(val))
  }

  // Birinchi login da avtomatik oching (agar avval saqlanmagan bo'lsa)
  useEffect(() => {
    if (user && localStorage.getItem('sidebar_collapsed') === null) {
      setCollapsedPersist(false)
    }
  }, [!!user])

  /* ── Rang palitasi ── */
  const sideBg   = isDark ? '#1e293b' : '#ffffff'
  const brd      = isDark ? '#334155' : '#f1f5f9'
  const txt1     = isDark ? '#f1f5f9' : '#1e293b'
  const txt2     = isDark ? '#94a3b8' : '#64748b'
  const txtM     = isDark ? '#64748b' : '#94a3b8'
  const hov      = isDark ? '#334155' : '#f1f5f9'
  const srBg     = isDark ? '#0f172a' : '#f8fafc'
  const srBrd    = isDark ? '#334155' : '#e2e8f0'
  const kbdBg    = isDark ? '#1e293b' : '#f1f5f9'
  const togBg    = isDark ? 'rgba(255,255,255,0.08)' : '#f1f5f9'
  const togHov   = isDark ? 'rgba(255,255,255,0.16)' : '#e2e8f0'

  const W = collapsed ? 64 : 224

  /* ── Tooltip ── */
  function Tip({ id, label, icon, color = txt1 }) {
    return tip !== id ? null : (
      <div style={{
        position: 'absolute',
        left: W + 10,
        top: '50%',
        transform: 'translateY(-50%)',
        background: isDark ? '#0f172a' : '#1e293b',
        color: color,
        fontSize: 14, fontWeight: 700,
        padding: '7px 13px', borderRadius: 11,
        whiteSpace: 'nowrap', zIndex: 9999, pointerEvents: 'none',
        boxShadow: '0 8px 28px rgba(0,0,0,0.3)',
        border: '1px solid rgba(255,255,255,0.1)',
        animation: 'tipIn 0.15s ease both',
      }}>
        {icon} {label}
      </div>
    )
  }

  return (
    <>
      <style>{STYLES}</style>
      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
      <div style={{ display:'flex', height:'100vh', overflow:'hidden', background:'var(--bg-app)' }}>

        {/* ══════════════ SIDEBAR ══════════════ */}
        <aside style={{
          width: W,
          minWidth: W,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          background: sideBg,
          borderRight: `1px solid ${brd}`,
          boxShadow: isDark ? '2px 0 12px rgba(0,0,0,0.3)' : '2px 0 10px rgba(0,0,0,0.05)',
          transition: 'width 0.28s cubic-bezier(0.4,0,0.2,1), min-width 0.28s cubic-bezier(0.4,0,0.2,1)',
          overflow: 'visible',   /* toggle tugma tashqariga chiqishi uchun */
          zIndex: 20,
          position: 'relative',
        }}>

          {/* Inner wrapper — overflow:hidden (toggle tashqarida qoladi) */}
          <div style={{ display:'flex', flexDirection:'column', flex:1, overflow:'hidden', minWidth:0 }}>

          {/* ── Logo satri ── */}
          <div style={{
            padding: '13px 14px',
            borderBottom: `1px solid ${brd}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 60,
          }}>
            {/* Logo — faqat ikonka (har doim, markazda) */}
            <div style={{
              width: 36, height: 36, borderRadius: 11, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19,
              background: 'linear-gradient(135deg,#3b82f6,#6366f1)',
              boxShadow: '0 4px 12px rgba(99,102,241,0.4)',
            }}>🌳</div>
          </div>

          {/* ── Toggle tugmasi — sidebar o'ng chekkasida floating ── */}
          <button
            onClick={() => setCollapsedPersist(!collapsed)}
            title={collapsed ? 'Panelni ochish' : 'Panelni yopish'}
            style={{
              position: 'absolute',
              top: 16,
              right: -14,
              width: 28, height: 28,
              borderRadius: '50%',
              border: `1.5px solid ${brd}`,
              background: isDark ? '#1e293b' : '#ffffff',
              color: txt2,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 900,
              cursor: 'pointer',
              zIndex: 50,
              boxShadow: isDark
                ? '0 2px 10px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)'
                : '0 2px 10px rgba(0,0,0,0.15)',
              transition: 'background 0.2s, transform 0.3s, box-shadow 0.2s',
              transform: collapsed ? 'rotate(180deg)' : 'rotate(0deg)',
              userSelect: 'none',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = isDark ? '#334155' : '#f1f5f9'
              e.currentTarget.style.boxShadow = isDark
                ? '0 4px 16px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.1)'
                : '0 4px 16px rgba(0,0,0,0.2)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = isDark ? '#1e293b' : '#ffffff'
              e.currentTarget.style.boxShadow = isDark
                ? '0 2px 10px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)'
                : '0 2px 10px rgba(0,0,0,0.15)'
            }}
          >
            ‹
          </button>

          {/* ── Qidiruv ── */}
          <div style={{ padding: collapsed ? '8px 0' : '8px 10px',
            display:'flex', justifyContent: collapsed ? 'center' : 'stretch',
            position:'relative' }}
            onMouseEnter={() => collapsed && setTip('search')}
            onMouseLeave={() => setTip(null)}>
            {!collapsed ? (
              <button onClick={openSearch} style={{
                width:'100%', display:'flex', alignItems:'center', gap:8,
                padding:'8px 12px', borderRadius:11,
                background: srBg, border:`1px solid ${srBrd}`,
                cursor:'pointer', color:txtM, fontSize:13,
                transition:'border-color 0.15s, color 0.15s',
                animation: 'labelIn 0.2s ease both',
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor='#6366f1'; e.currentTarget.style.color='#6366f1' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor=srBrd; e.currentTarget.style.color=txtM }}>
                <span style={{ fontSize:13 }}>🔍</span>
                <span style={{ flex:1, textAlign:'left' }}>Qidirish...</span>
                <kbd style={{
                  fontSize:10, padding:'1px 5px', borderRadius:4,
                  background:kbdBg, border:`1px solid ${srBrd}`,
                  fontFamily:'monospace', color:'inherit',
                }}>⌃K</kbd>
              </button>
            ) : (
              <button onClick={openSearch} style={{
                width:38, height:38, borderRadius:11, border:`1px solid ${brd}`,
                background: srBg, cursor:'pointer', fontSize:16,
                display:'flex', alignItems:'center', justifyContent:'center',
                transition:'background 0.15s',
              }}
                onMouseEnter={e => e.currentTarget.style.background = hov}
                onMouseLeave={e => e.currentTarget.style.background = srBg}>
                🔍
              </button>
            )}
            <Tip id="search" label="Qidirish" icon="🔍" />
          </div>

          {/* ── Nav ── */}
          <nav style={{
            flex: 1, overflowY:'auto', overflowX:'hidden',
            padding: collapsed ? '4px 0' : '4px 10px',
            display:'flex', flexDirection:'column', gap:2,
            transition:'padding 0.28s',
          }}>
            {navItems.map(({ to, label, icon, end }) => (
              <div key={to} style={{ position:'relative' }}
                onMouseEnter={() => collapsed && setTip(to)}
                onMouseLeave={() => setTip(null)}>
                <NavLink
                  to={to} end={end}
                  className={({ isActive }) => `ul-nav-link${isActive?' active':''}`}
                  style={({ isActive }) => ({
                    gap: collapsed ? 0 : 10,
                    padding: collapsed ? '10px 0' : '9px 12px',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    color: isActive ? 'white' : txt2,
                    fontSize: 13, fontWeight: isActive ? 700 : 500,
                  })}
                  onMouseEnter={e => {
                    if (!e.currentTarget.classList.contains('active'))
                      e.currentTarget.style.background = hov
                  }}
                  onMouseLeave={e => {
                    if (!e.currentTarget.classList.contains('active'))
                      e.currentTarget.style.background = 'transparent'
                  }}>
                  <span style={{ fontSize:17, width:22, textAlign:'center', flexShrink:0 }}>{icon}</span>
                  {!collapsed && (
                    <span style={{ animation:'labelIn 0.2s ease both', whiteSpace:'nowrap' }}>{label}</span>
                  )}
                </NavLink>
                <Tip id={to} label={label} icon={icon} />
              </div>
            ))}
          </nav>

          {/* ── Quyi qism ── */}
          <div style={{ padding: collapsed ? '10px 0' : '10px', borderTop:`1px solid ${brd}`,
            display:'flex', flexDirection:'column', gap:2 }}>

            {/* Guest: Kirish tugmasi | User: user info */}
            {!user ? (
              /* ── GUEST: Login tugmasi ── */
              <div style={{ position:'relative' }}
                onMouseEnter={() => collapsed && setTip('auth')}
                onMouseLeave={() => setTip(null)}>
                <button onClick={() => setShowAuthModal(true)} style={{
                  display:'flex', alignItems:'center',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  gap: collapsed ? 0 : 8,
                  width:'100%', padding: collapsed ? '10px 0' : '9px 10px',
                  borderRadius: 11, border: 'none', cursor: 'pointer', marginBottom: 4,
                  background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                  color: 'white', fontSize: collapsed ? 17 : 12.5, fontWeight: 700,
                  boxShadow: '0 4px 14px rgba(99,102,241,0.35)',
                  transition: 'opacity 0.15s',
                }}
                  onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
                  onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
                  <span>{collapsed ? '🔑' : '🔑'}</span>
                  {!collapsed && <span style={{ animation:'labelIn 0.2s ease both' }}>Kirish / Ro'yxat</span>}
                </button>
                <Tip id="auth" label="Kirish / Ro'yxatdan o'tish" icon="🔑" color="#a5b4fc" />
              </div>
            ) : !collapsed ? (
              /* ── USER info (kengaytirilgan) ── */
              <div style={{
                display:'flex', alignItems:'center', gap:9,
                padding:'9px 10px', borderRadius:11, marginBottom:4,
                background: srBg, border:`1px solid ${brd}`,
                animation:'labelIn 0.2s ease both',
              }}>
                <div style={{
                  width:32, height:32, borderRadius:'50%', flexShrink:0,
                  background:'linear-gradient(135deg,#3b82f6,#6366f1)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  color:'white', fontSize:12, fontWeight:800,
                }}>
                  {user?.first_name?.[0]?.toUpperCase() || 'U'}
                </div>
                <div style={{ minWidth:0 }}>
                  <div style={{ fontSize:12.5, fontWeight:700, color:txt1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {user?.first_name} {user?.last_name}
                  </div>
                  <div style={{ fontSize:10.5, color:txtM, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    @{user?.username}
                  </div>
                </div>
              </div>
            ) : (
              /* ── USER info (yopiq) ── */
              <div style={{ display:'flex', justifyContent:'center', marginBottom:4, position:'relative' }}
                onMouseEnter={() => setTip('user')}
                onMouseLeave={() => setTip(null)}>
                <div style={{
                  width:36, height:36, borderRadius:'50%',
                  background:'linear-gradient(135deg,#3b82f6,#6366f1)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  color:'white', fontSize:13, fontWeight:800,
                }}>
                  {user?.first_name?.[0]?.toUpperCase() || 'U'}
                </div>
                <Tip id="user" label={`${user?.first_name || ''} · @${user?.username || ''}`} icon="👤" />
              </div>
            )}

            {/* Dark mode toggle */}
            <div style={{ position:'relative' }}
              onMouseEnter={() => collapsed && setTip('theme')}
              onMouseLeave={() => setTip(null)}>
              <button onClick={toggle} style={{
                display:'flex', alignItems:'center',
                justifyContent: collapsed ? 'center' : 'space-between',
                width:'100%', padding: collapsed ? '10px 0' : '8px 10px',
                borderRadius:10, background:'transparent', border:'none',
                cursor:'pointer', color:txt2, fontSize:12, fontWeight:600,
                marginBottom:2, transition:'background 0.15s',
              }}
                onMouseEnter={e => e.currentTarget.style.background = hov}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <span style={{ display:'flex', alignItems:'center', gap: collapsed?0:7 }}>
                  <span style={{ fontSize:17 }}>{isDark ? '☀️' : '🌙'}</span>
                  {!collapsed && (
                    <span style={{ animation:'labelIn 0.2s ease both' }}>
                      {isDark ? "Yorug' rejim" : 'Tungi rejim'}
                    </span>
                  )}
                </span>
                {!collapsed && (
                  <div className={`theme-toggle${isDark?' dark-on':''}`}
                    style={{ background: isDark ? '#3b82f6' : '#e2e8f0' }}>
                    <div className="theme-toggle-thumb"/>
                  </div>
                )}
              </button>
              <Tip id="theme" label={isDark ? "Yorug' rejim" : 'Tungi rejim'} icon={isDark?'☀️':'🌙'} />
            </div>

            {/* Admin panel — barcha login qilganlar uchun */}
            {user && (
              <div style={{ position:'relative' }}
                onMouseEnter={() => collapsed && setTip('admin')}
                onMouseLeave={() => setTip(null)}>
                <button onClick={() => navigate('/admin')} style={{
                  display:'flex', alignItems:'center',
                  gap: collapsed?0:7,
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  width:'100%', padding: collapsed ? '10px 0' : '8px 10px',
                  borderRadius:10, border:'none', cursor:'pointer',
                  background:'transparent', color:'#6366f1',
                  fontSize: collapsed ? 17 : 12, fontWeight:700, marginBottom:2,
                  transition:'background 0.15s',
                }}
                  onMouseEnter={e => e.currentTarget.style.background = isDark?'#1e1b4b':'#eef2ff'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <span>⚙️</span>
                  {!collapsed && <span style={{ animation:'labelIn 0.2s ease both' }}>
                    {isAdmin() ? 'Admin panel' : 'Mening panelim'}
                  </span>}
                </button>
                <Tip id="admin" label={isAdmin() ? 'Admin panel' : 'Mening panelim'} icon="⚙️" color="#a5b4fc" />
              </div>
            )}

            {/* Akkauntdan chiqish — logout, PIN saqlanadi, mehmon sifatida qoladi */}
            {user && (
              <div style={{ position:'relative' }}
                onMouseEnter={() => collapsed && setTip('back')}
                onMouseLeave={() => setTip(null)}>
                <button onClick={() => { logout(); navigate('/') }} style={{
                  display:'flex', alignItems:'center',
                  gap: collapsed?0:7,
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  width:'100%', padding: collapsed ? '10px 0' : '8px 10px',
                  borderRadius:10, border:'none', cursor:'pointer',
                  background:'transparent', color: txt2,
                  fontSize: collapsed ? 17 : 12, fontWeight:600, marginBottom:2,
                  transition:'background 0.15s',
                }}
                  onMouseEnter={e => e.currentTarget.style.background = hov}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <span>👤</span>
                  {!collapsed && <span style={{ animation:'labelIn 0.2s ease both' }}>Akkauntdan chiqish</span>}
                </button>
                <Tip id="back" label="Akkauntdan chiqish" icon="👤" />
              </div>
            )}

            {/* Telegram bot linki */}
            <div style={{ position:'relative' }}
              onMouseEnter={() => collapsed && setTip('tgbot')}
              onMouseLeave={() => setTip(null)}>
              <a href="https://t.me/mening_shajarambot" target="_blank" rel="noreferrer" style={{
                display:'flex', alignItems:'center',
                gap: collapsed ? 0 : 7,
                justifyContent: collapsed ? 'center' : 'flex-start',
                width:'100%', padding: collapsed ? '10px 0' : '8px 10px',
                borderRadius:10, border:'none', textDecoration:'none',
                background:'transparent', color:'#229ED9',
                fontSize: collapsed ? 20 : 12, fontWeight:700, marginBottom:2,
                transition:'background 0.15s',
              }}
                onMouseEnter={e => e.currentTarget.style.background = isDark?'#0c1a2e':'#e0f2fe'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <svg width={collapsed?20:17} height={collapsed?20:17} viewBox="0 0 24 24" fill="#229ED9" style={{ flexShrink:0 }}>
                  <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.17 13.5l-2.95-.924c-.64-.203-.658-.64.136-.954l11.566-4.458c.537-.194 1.006.131.972.957z"/>
                </svg>
                {!collapsed && <span style={{ animation:'labelIn 0.2s ease both' }}>Telegram bot</span>}
              </a>
              <Tip id="tgbot" label="Telegram bot" icon="📱" color="#7dd3fc" />
            </div>

            {/* Saytni qulflash — PIN tozalanadi, PIN gate ko'rinadi */}
            <div style={{ position:'relative' }}
              onMouseEnter={() => collapsed && setTip('lock')}
              onMouseLeave={() => setTip(null)}>
              <button onClick={() => {
                if (user) logout()
                clearPinSession()
              }} style={{
                display:'flex', alignItems:'center',
                gap: collapsed?0:7,
                justifyContent: collapsed ? 'center' : 'flex-start',
                width:'100%', padding: collapsed ? '10px 0' : '8px 10px',
                borderRadius:10, border:'none', cursor:'pointer',
                background:'transparent', color:'#ef4444',
                fontSize: collapsed ? 17 : 12, fontWeight:600,
                transition:'background 0.15s',
              }}
                onMouseEnter={e => e.currentTarget.style.background = isDark?'#450a0a':'#fef2f2'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <span>🔒</span>
                {!collapsed && <span style={{ animation:'labelIn 0.2s ease both' }}>Saytni qulflash</span>}
              </button>
              <Tip id="lock" label="Saytni qulflash" icon="🔒" color="#f87171" />
            </div>
          </div>

          </div>{/* end inner wrapper */}
        </aside>

        {/* ══════════════ MAIN ══════════════ */}
        <main className="mobile-main-pad"
          style={{ flex:1, overflowY:'auto', background:'var(--bg-app)' }}>
          <Outlet />
        </main>

        <GlobalSearch />

        {/* Mobile FAB — action panel */}
        <div className="mobile-fab-wrap">
          {/* Backdrop */}
          {fabOpen && (
            <div onClick={() => setFabOpen(false)} style={{
              position:'fixed', inset:0, zIndex:199, background:'rgba(0,0,0,0.25)',
              backdropFilter:'blur(2px)',
            }}/>
          )}

          {/* Action panel — chapdan chiqadi */}
          {fabOpen && (
            <div style={{
              position:'fixed', bottom:130, left:14, zIndex:200,
              display:'flex', flexDirection:'column', gap:10,
              animation:'fabPanelIn 0.22s cubic-bezier(0.34,1.56,0.64,1) both',
            }}>
              {/* Login / Ro'yxat — faqat guest uchun */}
              {!user && (
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <button onClick={() => { setFabOpen(false); setShowAuthModal(true) }} style={{
                    width:46, height:46, borderRadius:'50%', border:'none', cursor:'pointer',
                    background:'linear-gradient(135deg,#6366f1,#8b5cf6)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    boxShadow:'0 6px 20px rgba(99,102,241,0.55)', fontSize:20, flexShrink:0,
                  }}>🔑</button>
                  <span style={{ fontSize:12, fontWeight:700, color:'white',
                    background:'rgba(0,0,0,0.6)', padding:'5px 11px', borderRadius:20,
                    backdropFilter:'blur(4px)', whiteSpace:'nowrap' }}>
                    Kirish / Ro'yxat
                  </span>
                </div>
              )}

              {/* Admin panel — login bo'lganda */}
              {user && (
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <button onClick={() => { setFabOpen(false); navigate('/admin') }} style={{
                    width:46, height:46, borderRadius:'50%', border:'none', cursor:'pointer',
                    background:'linear-gradient(135deg,#4f46e5,#7c3aed)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    boxShadow:'0 6px 20px rgba(79,70,229,0.55)', fontSize:20, flexShrink:0,
                  }}>⚙️</button>
                  <span style={{ fontSize:12, fontWeight:700, color:'white',
                    background:'rgba(0,0,0,0.6)', padding:'5px 11px', borderRadius:20,
                    backdropFilter:'blur(4px)', whiteSpace:'nowrap' }}>
                    {isAdmin() ? 'Admin panel' : 'Mening panelim'}
                  </span>
                </div>
              )}

              {/* Telegram bot */}
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <a href="https://t.me/mening_shajarambot" target="_blank" rel="noreferrer"
                  onClick={() => setFabOpen(false)}
                  style={{
                    width:46, height:46, borderRadius:'50%', border:'none', cursor:'pointer',
                    background:'linear-gradient(135deg,#229ED9,#0ea5e9)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    boxShadow:'0 6px 20px rgba(34,158,217,0.55)', textDecoration:'none', flexShrink:0,
                  }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
                    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.17 13.5l-2.95-.924c-.64-.203-.658-.64.136-.954l11.566-4.458c.537-.194 1.006.131.972.957z"/>
                  </svg>
                </a>
                <span style={{ fontSize:12, fontWeight:700, color:'white',
                  background:'rgba(0,0,0,0.6)', padding:'5px 11px', borderRadius:20,
                  backdropFilter:'blur(4px)', whiteSpace:'nowrap' }}>
                  Telegram bot
                </span>
              </div>

              {/* Akkauntdan chiqish — login bo'lganda */}
              {user && (
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <button onClick={() => { setFabOpen(false); logout(); navigate('/') }} style={{
                    width:46, height:46, borderRadius:'50%', border:'none', cursor:'pointer',
                    background:'linear-gradient(135deg,#64748b,#475569)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    boxShadow:'0 6px 20px rgba(100,116,139,0.5)', fontSize:20, flexShrink:0,
                  }}>👤</button>
                  <span style={{ fontSize:12, fontWeight:700, color:'white',
                    background:'rgba(0,0,0,0.6)', padding:'5px 11px', borderRadius:20,
                    backdropFilter:'blur(4px)', whiteSpace:'nowrap' }}>
                    Akkauntdan chiqish
                  </span>
                </div>
              )}

              {/* Qulflash */}
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <button onClick={() => { setFabOpen(false); if (user) logout(); clearPinSession() }} style={{
                  width:46, height:46, borderRadius:'50%', border:'none', cursor:'pointer',
                  background:'linear-gradient(135deg,#ef4444,#dc2626)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  boxShadow:'0 6px 20px rgba(239,68,68,0.5)', fontSize:20, flexShrink:0,
                }}>🔒</button>
                <span style={{ fontSize:12, fontWeight:700, color:'white',
                  background:'rgba(0,0,0,0.6)', padding:'5px 11px', borderRadius:20,
                  backdropFilter:'blur(4px)', whiteSpace:'nowrap' }}>
                  Saytni qulflash
                </span>
              </div>
            </div>
          )}

          {/* FAB toggle button — chapda */}
          <button
            onClick={() => setFabOpen(v => !v)}
            style={{
              position:'fixed', bottom:74, left:14, zIndex:201,
              width:48, height:48, borderRadius:'50%', border:'none', cursor:'pointer',
              background: fabOpen
                ? 'linear-gradient(135deg,#ef4444,#dc2626)'
                : 'linear-gradient(135deg,#3b82f6,#6366f1)',
              color:'white', fontSize:22, fontWeight:900,
              display:'flex', alignItems:'center', justifyContent:'center',
              boxShadow: fabOpen
                ? '0 6px 24px rgba(239,68,68,0.55)'
                : '0 6px 24px rgba(99,102,241,0.55)',
              transition:'background 0.25s, box-shadow 0.25s, transform 0.25s',
              transform: fabOpen ? 'rotate(45deg)' : 'rotate(0deg)',
            }}>
            ✦
          </button>
        </div>

        {/* Mobile bottom nav */}
        <nav className="mobile-bottom-nav">
          {navItems.map(({ to, label, icon, end }) => {
            const isActive = end ? location.pathname===to : location.pathname.startsWith(to)
            const shortLabel = label.split(' ')[0].substring(0, 7)
            return (
              <NavLink key={to} to={to} end={end} style={{ textDecoration:'none', flexShrink:0 }}>
                <div style={{
                  display:'flex', flexDirection:'column', alignItems:'center', gap:1,
                  padding:'4px 8px', borderRadius:10,
                  color: isActive ? '#6366f1' : 'var(--text-muted)',
                  background: isActive ? 'rgba(99,102,241,0.1)' : 'transparent',
                  transition:'all 0.15s',
                }}>
                  <span style={{ fontSize:18, lineHeight:1 }}>{icon}</span>
                  <span style={{ fontSize:8, fontWeight:700, whiteSpace:'nowrap' }}>{shortLabel}</span>
                </div>
              </NavLink>
            )
          })}
        </nav>

        {/* Mobile theme toggle — top-right floating, icon only */}
        <button
          onClick={toggle}
          className="mobile-theme-fab"
          style={{
            position:'fixed', top:10, right:10, zIndex:1100,
            width:36, height:36, borderRadius:'50%', border:'none', cursor:'pointer',
            background: isDark ? 'rgba(30,41,59,0.92)' : 'rgba(255,255,255,0.92)',
            backdropFilter:'blur(10px)',
            boxShadow: isDark
              ? '0 2px 14px rgba(0,0,0,0.4), 0 0 0 1px rgba(99,102,241,0.25)'
              : '0 2px 14px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.06)',
            display:'flex', alignItems:'center', justifyContent:'center', fontSize:18,
            transition:'all 0.2s',
          }}>
          {isDark ? '☀️' : '🌙'}
        </button>
      </div>
    </>
  )
}
