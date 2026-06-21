import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import useAuthStore from '../../store/authStore'
import useThemeStore from '../../store/themeStore'
import { getReminderStats } from '../../api/reminders'
import { clearPinSession } from '../../components/PinGate'

const ALL_NAV = [
  { to: '/',                  label: 'Daraxt',             icon: '🌳', end: true,  adminOnly: false },
  { to: '/admin',             label: 'Dashboard',          icon: '📊', end: true,  adminOnly: false },
  { to: '/admin/persons',     label: 'Shaxslar',           icon: '👥',             adminOnly: false },
  { to: '/admin/persons/add', label: "Yangi qo'shish",     icon: '➕',             adminOnly: false },
  { to: '/admin/link',        label: "Ota-ona bog'lash",   icon: '🔗',             adminOnly: false },
  { to: '/admin/reminders',   label: 'Eslatmalar',         icon: '🔔',             adminOnly: false },
  { to: '/admin/stats',       label: 'Statistika',         icon: '📈',             adminOnly: false },
  { to: '/admin/invites',     label: 'Invitlar',           icon: '📨',             adminOnly: false },
  { to: '/admin/users',       label: 'Foydalanuvchilar',   icon: '👤',             adminOnly: true  },
  { to: '/admin/settings',    label: 'Sozlamalar',         icon: '⚙️',             adminOnly: true  },
  { to: '/admin/audit',       label: 'Audit Log',          icon: '🕵️',             adminOnly: true  },
]

const SIDEBAR_KEYFRAMES = `
@keyframes sidebarSlide {
  from { opacity: 0; transform: translateX(-8px) }
  to   { opacity: 1; transform: translateX(0) }
}
@keyframes tooltipFade {
  from { opacity: 0; transform: translateX(-6px) }
  to   { opacity: 1; transform: translateX(0) }
}
@media (max-width: 640px) {
  .admin-sidebar { display: none !important; }
  .admin-mobile-nav { display: flex !important; }
  .admin-main { padding-bottom: 70px !important; }
}
`

const MOBILE_NAV_ITEMS = [
  { to: '/',                  label: 'Daraxt',    icon: '🌳', end: true },
  { to: '/admin',             label: 'Dashboard', icon: '📊', end: true },
  { to: '/admin/persons',     label: 'Shaxslar',  icon: '👥' },
  { to: '/admin/persons/add', label: "Qo'shish",  icon: '➕' },
  { to: '/admin/stats',       label: 'Statistika',icon: '📈' },
]

export default function AdminLayout() {
  const { user, logout, isAdmin: checkAdmin } = useAuthStore()
  const isAdmin = checkAdmin()
  const { isDark }        = useThemeStore()
  const navigate          = useNavigate()
  const location          = useLocation()
  const [birthdayCount, setBirthdayCount] = useState(0)
  const [collapsed, setCollapsed]         = useState(false)
  const [tooltip, setTooltip]             = useState(null)

  const roleLabel   = user?.is_superuser ? 'Super Admin' : user?.role === 'admin' ? 'Admin' : 'Foydalanuvchi'
  const navItems    = ALL_NAV.filter(n => !n.adminOnly || isAdmin)

  useEffect(() => {
    getReminderStats().then(r => setBirthdayCount(r.data.next_30_days || 0)).catch(() => {})
  }, [])

  // Admin paneldan chiqish = faqat foydalanuvchi sahifasiga qaytish (logout emas)
  const handleBack = () => navigate('/')

  const sideW   = collapsed ? 64 : 232
  const mainBg  = isDark ? '#0f172a' : '#f1f5f9'
  const sideBg  = 'linear-gradient(180deg, #0f172a 0%, #1e1b4b 100%)'

  return (
    <>
      <style>{SIDEBAR_KEYFRAMES}</style>
      <div style={{ display:'flex', height:'100vh', overflow:'hidden', background: mainBg }}>

        {/* ── Sidebar ── */}
        <aside className="admin-sidebar" style={{
          width: sideW,
          minWidth: sideW,
          display: 'flex',
          flexDirection: 'column',
          background: sideBg,
          borderRight: '1px solid rgba(255,255,255,0.07)',
          transition: 'width 0.28s cubic-bezier(0.4,0,0.2,1), min-width 0.28s cubic-bezier(0.4,0,0.2,1)',
          overflow: 'hidden',
          position: 'relative',
          zIndex: 10,
          flexShrink: 0,
        }}>

          {/* ── Logo + Toggle ── */}
          <div style={{ padding: collapsed ? '16px 0' : '16px 16px',
            borderBottom: '1px solid rgba(255,255,255,0.07)',
            display: 'flex', alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'space-between',
            minHeight: 64, transition: 'padding 0.28s' }}>

            {!collapsed && (
              <div style={{ display:'flex', alignItems:'center', gap:10,
                animation:'sidebarSlide 0.25s ease both' }}>
                <div style={{ width:36, height:36, borderRadius:12, flexShrink:0,
                  background:'linear-gradient(135deg,#3b82f6,#6366f1)',
                  display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>🌳</div>
                <div>
                  <div style={{ color:'white', fontWeight:800, fontSize:15, lineHeight:1.2 }}>Admin Panel</div>
                  <div style={{ color:'#64748b', fontSize:12, marginTop:1 }}>
                    Matayev & Abdumannonovlar
                  </div>
                </div>
              </div>
            )}

            {collapsed && (
              <div style={{ width:36, height:36, borderRadius:12,
                background:'linear-gradient(135deg,#3b82f6,#6366f1)',
                display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>🌳</div>
            )}

            {/* Toggle tugmasi */}
            <button
              onClick={() => setCollapsed(c => !c)}
              title={collapsed ? 'Panelni ochish' : 'Panelni yopish'}
              style={{
                width: 28, height: 28, borderRadius: 8, border: 'none', cursor: 'pointer',
                background: 'rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.7)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, flexShrink: 0,
                transition: 'background 0.2s, transform 0.3s',
                transform: collapsed ? 'rotate(180deg)' : 'rotate(0deg)',
                marginLeft: collapsed ? 0 : 4,
              }}
              onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.2)'}
              onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.1)'}
            >
              {collapsed ? '›' : '‹'}
            </button>
          </div>

          {/* ── Nav ── */}
          <nav style={{ flex:1, padding: collapsed ? '12px 0' : '12px 8px',
            overflowY:'auto', overflowX:'hidden',
            display:'flex', flexDirection:'column', gap:2,
            transition:'padding 0.28s' }}>

            {navItems.map(({ to, label, icon, end }) => (
              <div key={to} style={{ position:'relative' }}
                onMouseEnter={() => collapsed && setTooltip(to)}
                onMouseLeave={() => setTooltip(null)}>

                <NavLink to={to} end={end}
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                  style={{
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    padding: collapsed ? '10px 0' : undefined,
                    borderRadius: 10,
                  }}>
                  <span className="nav-icon" style={{ fontSize: 18, flexShrink:0 }}>{icon}</span>
                  {!collapsed && (
                    <span style={{ animation:'sidebarSlide 0.2s ease both', whiteSpace:'nowrap' }}>
                      {label}
                    </span>
                  )}
                  {!collapsed && label === 'Eslatmalar' && birthdayCount > 0 && (
                    <span className="ml-auto" style={{
                      fontSize:12, fontWeight:800, padding:'2px 7px', borderRadius:20,
                      background:'#ef4444', color:'white', minWidth:18, textAlign:'center'
                    }}>{birthdayCount}</span>
                  )}
                  {collapsed && label === 'Eslatmalar' && birthdayCount > 0 && (
                    <span style={{
                      position:'absolute', top:4, right:8, width:8, height:8,
                      borderRadius:'50%', background:'#ef4444',
                    }} />
                  )}
                </NavLink>

                {/* Tooltip — faqat collapsed holda */}
                {collapsed && tooltip === to && (
                  <div style={{
                    position:'absolute', left:68, top:'50%', transform:'translateY(-50%)',
                    background:'rgba(15,23,42,0.95)',
                    backdropFilter:'blur(8px)',
                    border:'1px solid rgba(255,255,255,0.12)',
                    color:'white', fontSize:13, fontWeight:700,
                    padding:'7px 13px', borderRadius:10, whiteSpace:'nowrap',
                    zIndex:999, pointerEvents:'none',
                    animation:'tooltipFade 0.15s ease both',
                    boxShadow:'0 8px 24px rgba(0,0,0,0.3)',
                  }}>
                    {icon} {label}
                    {label === 'Eslatmalar' && birthdayCount > 0 && (
                      <span style={{ marginLeft:6, background:'#ef4444', borderRadius:20,
                        padding:'1px 5px', fontSize:10 }}>{birthdayCount}</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </nav>

          {/* ── User + actions ── */}
          <div style={{ padding: collapsed ? '12px 0' : '12px 8px',
            borderTop:'1px solid rgba(255,255,255,0.07)',
            display:'flex', flexDirection:'column', gap:2,
            transition:'padding 0.28s' }}>

            {/* Avatar + ism */}
            <div style={{ display:'flex', alignItems:'center',
              gap: collapsed ? 0 : 10,
              padding: collapsed ? '8px 0' : '8px 10px',
              justifyContent: collapsed ? 'center' : 'flex-start' }}>
              <div style={{ width:32, height:32, borderRadius:'50%', flexShrink:0,
                background:'linear-gradient(135deg,#3b82f6,#6366f1)',
                display:'flex', alignItems:'center', justifyContent:'center',
                color:'white', fontSize:13, fontWeight:800 }}>
                {user?.first_name?.[0] || user?.username?.[0] || 'A'}
              </div>
              {!collapsed && (
                <div style={{ animation:'sidebarSlide 0.2s ease both', minWidth:0 }}>
                  <div style={{ color:'white', fontSize:13, fontWeight:700,
                    overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {user?.first_name} {user?.last_name}
                  </div>
                  <div style={{ color:'#818cf8', fontSize:11 }}>{roleLabel}</div>
                </div>
              )}
            </div>

            {/* Akkauntdan chiqish — logout, PIN saqlanadi, mehmon sifatida qoladi */}
            <div style={{ position:'relative' }}
              onMouseEnter={() => collapsed && setTooltip('home')}
              onMouseLeave={() => setTooltip(null)}>
              <button onClick={() => { logout(); navigate('/') }}
                className="nav-item" style={{ width:'100%',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  padding: collapsed ? '10px 0' : undefined }}>
                <span className="nav-icon" style={{ fontSize:18 }}>👤</span>
                {!collapsed && <span style={{ animation:'sidebarSlide 0.2s ease both' }}>Akkauntdan chiqish</span>}
              </button>
              {collapsed && tooltip === 'home' && (
                <div style={{ position:'absolute', left:68, top:'50%', transform:'translateY(-50%)',
                  background:'rgba(15,23,42,0.95)', backdropFilter:'blur(8px)',
                  border:'1px solid rgba(255,255,255,0.12)',
                  color:'white', fontSize:12, fontWeight:700,
                  padding:'6px 12px', borderRadius:10, whiteSpace:'nowrap',
                  zIndex:999, pointerEvents:'none',
                  animation:'tooltipFade 0.15s ease both',
                  boxShadow:'0 8px 24px rgba(0,0,0,0.3)' }}>
                  👤 Akkauntdan chiqish
                </div>
              )}
            </div>

            {/* Saytni qulflash — logout + PIN tozalanadi, PIN gate ko'rinadi */}
            <div style={{ position:'relative' }}
              onMouseEnter={() => collapsed && setTooltip('lock')}
              onMouseLeave={() => setTooltip(null)}>
              <button onClick={() => { logout(); clearPinSession() }}
                className="nav-item" style={{ width:'100%', color:'#f87171',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  padding: collapsed ? '10px 0' : undefined }}>
                <span className="nav-icon" style={{ fontSize:18 }}>🔒</span>
                {!collapsed && <span style={{ animation:'sidebarSlide 0.2s ease both' }}>Saytni qulflash</span>}
              </button>
              {collapsed && tooltip === 'lock' && (
                <div style={{ position:'absolute', left:68, top:'50%', transform:'translateY(-50%)',
                  background:'rgba(15,23,42,0.95)', backdropFilter:'blur(8px)',
                  border:'1px solid rgba(255,255,255,0.12)',
                  color:'#f87171', fontSize:12, fontWeight:700,
                  padding:'6px 12px', borderRadius:10, whiteSpace:'nowrap',
                  zIndex:999, pointerEvents:'none',
                  animation:'tooltipFade 0.15s ease both',
                  boxShadow:'0 8px 24px rgba(0,0,0,0.3)' }}>
                  🔒 Saytni qulflash
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* ── Main content ── */}
        <main className="admin-main" style={{ flex:1, overflowY:'auto', overflowX:'hidden',
          background: isDark ? '#0f172a' : '#f1f5f9' }}>
          <Outlet />
        </main>
      </div>

      {/* ── Mobile bottom nav ── */}
      <nav className="admin-mobile-nav" style={{
        display: 'none',
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1000,
        background: isDark ? '#1e293b' : '#ffffff',
        borderTop: `1px solid ${isDark ? '#334155' : '#f1f5f9'}`,
        padding: '8px 4px env(safe-area-inset-bottom)',
        boxShadow: '0 -4px 20px rgba(0,0,0,0.12)',
        justifyContent: 'space-around',
      }}>
        {MOBILE_NAV_ITEMS.map(({ to, label, icon, end }) => {
          const isActive = end ? location.pathname === to : location.pathname.startsWith(to)
          return (
            <NavLink key={to} to={to} end={end} style={{ textDecoration: 'none' }}>
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                padding: '6px 10px', borderRadius: 12, minWidth: 52,
                color: isActive ? '#6366f1' : isDark ? '#64748b' : '#94a3b8',
                transition: 'all 0.15s',
              }}>
                <span style={{ fontSize: 20 }}>{icon}</span>
                <span style={{ fontSize: 9, fontWeight: 700 }}>{label}</span>
                {label === 'Eslatma' && birthdayCount > 0 && (
                  <span style={{
                    position: 'absolute', top: 4, width: 8, height: 8,
                    borderRadius: '50%', background: '#ef4444',
                  }} />
                )}
              </div>
            </NavLink>
          )
        })}
        <div onClick={() => { logout(); navigate('/') }} style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
          padding: '6px 10px', borderRadius: 12, minWidth: 52, cursor: 'pointer',
          color: '#94a3b8',
        }}>
          <span style={{ fontSize: 20 }}>👤</span>
          <span style={{ fontSize: 9, fontWeight: 700 }}>Akkount</span>
        </div>
        <div onClick={() => { logout(); clearPinSession() }} style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
          padding: '6px 10px', borderRadius: 12, minWidth: 52, cursor: 'pointer',
          color: '#ef4444',
        }}>
          <span style={{ fontSize: 20 }}>🔒</span>
          <span style={{ fontSize: 9, fontWeight: 700 }}>Qulflash</span>
        </div>
      </nav>
    </>
  )
}
