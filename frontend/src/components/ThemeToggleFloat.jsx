import { useState } from 'react'
import useThemeStore from '../store/themeStore'
import { useLocation } from 'react-router-dom'

/* Foydalanuvchi layoutida allaqachon toggle bor — u yerda ikkilanmasin */
const SKIP_PATHS = ['/']  // UserLayout sahifalarida sidebar toggle bor

export default function ThemeToggleFloat() {
  const { isDark, toggle } = useThemeStore()
  const [hov, setHov]     = useState(false)
  const [pressed, setPressed] = useState(false)
  const location = useLocation()

  /* UserLayout ichidagi sahifalarda ko'rsatmaymiz (sidebar togglei bor) */
  const isUserLayout = !location.pathname.startsWith('/admin')
    && !location.pathname.startsWith('/login')
    && !location.pathname.startsWith('/register')
    && !location.pathname.startsWith('/invite')
    && !location.pathname.startsWith('/p/')
    && !location.pathname.startsWith('/s/')

  if (isUserLayout) return null  /* UserLayout sidebar toggle yetarli */

  return (
    <>
      <style>{`
        @keyframes tfFloat {
          0%,100% { transform: translateY(0) }
          50%      { transform: translateY(-4px) }
        }
        @keyframes tfSpin {
          from { transform: rotate(0deg) }
          to   { transform: rotate(360deg) }
        }
        @keyframes tfPop {
          0%   { transform: scale(0.8); opacity: 0 }
          60%  { transform: scale(1.15) }
          100% { transform: scale(1); opacity: 1 }
        }
      `}</style>

      <button
        onClick={() => { toggle(); setPressed(true); setTimeout(() => setPressed(false), 300) }}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        title={isDark ? "Yorug' rejimga o'tish" : "Tungi rejimga o'tish"}
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 9999,

          width: hov ? 120 : 48,
          height: 48,
          borderRadius: 24,
          border: 'none',
          cursor: 'pointer',

          background: isDark
            ? 'linear-gradient(135deg,#1e293b,#334155)'
            : 'linear-gradient(135deg,#f8fafc,#e2e8f0)',
          boxShadow: hov
            ? (isDark
              ? '0 8px 32px rgba(0,0,0,0.5), 0 0 0 2px rgba(99,102,241,0.5)'
              : '0 8px 32px rgba(0,0,0,0.18), 0 0 0 2px rgba(99,102,241,0.4)')
            : (isDark
              ? '0 4px 16px rgba(0,0,0,0.4)'
              : '0 4px 16px rgba(0,0,0,0.12)'),

          display: 'flex',
          alignItems: 'center',
          justifyContent: hov ? 'flex-start' : 'center',
          gap: 8,
          paddingLeft: hov ? 14 : 0,
          overflow: 'hidden',

          transition: 'width 0.25s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.2s, padding 0.25s',
          animation: pressed ? 'none' : 'tfFloat 3s ease infinite',
        }}
      >
        {/* Ikonka */}
        <span style={{
          fontSize: 22, flexShrink: 0,
          display: 'inline-block',
          animation: pressed ? 'tfSpin 0.35s ease' : 'none',
          transition: 'transform 0.2s',
          transform: hov ? 'scale(1.15)' : 'scale(1)',
        }}>
          {isDark ? '☀️' : '🌙'}
        </span>

        {/* Matn — faqat hover da */}
        {hov && (
          <span style={{
            fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap',
            color: isDark ? '#e2e8f0' : '#1e293b',
            animation: 'tfPop 0.2s ease both',
          }}>
            {isDark ? "Yorug' rejim" : 'Tungi rejim'}
          </span>
        )}
      </button>
    </>
  )
}
