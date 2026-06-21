import useThemeStore from '../store/themeStore'

export default function ErrorCard({ message = "Ma'lumotlarni yuklashda xato yuz berdi", onRetry, compact = false }) {
  const { isDark } = useThemeStore()
  const bg  = isDark ? '#1e293b' : '#ffffff'
  const brd = isDark ? '#7f1d1d' : '#fecaca'

  if (compact) return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 14px', borderRadius: 12,
      background: isDark ? '#450a0a' : '#fef2f2',
      border: `1px solid ${brd}`,
    }}>
      <span style={{ fontSize: 18 }}>⚠️</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: isDark ? '#fca5a5' : '#dc2626', flex: 1 }}>{message}</span>
      {onRetry && (
        <button onClick={onRetry} style={{
          padding: '4px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
          background: '#ef4444', color: 'white', fontSize: 12, fontWeight: 700,
        }}>Qayta</button>
      )}
    </div>
  )

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '60px 24px', textAlign: 'center',
      background: bg, borderRadius: 20,
      border: `1px solid ${brd}`,
    }}>
      <div style={{ fontSize: 56, marginBottom: 16 }}>😔</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: isDark ? '#fca5a5' : '#dc2626', marginBottom: 8 }}>
        Xato yuz berdi
      </div>
      <div style={{ fontSize: 14, color: isDark ? '#94a3b8' : '#64748b', maxWidth: 360, marginBottom: 24 }}>
        {message}
      </div>
      {onRetry && (
        <button onClick={onRetry} style={{
          padding: '11px 28px', borderRadius: 12, border: 'none', cursor: 'pointer',
          background: 'linear-gradient(135deg,#3b82f6,#6366f1)',
          color: 'white', fontSize: 14, fontWeight: 700,
          boxShadow: '0 4px 14px rgba(99,102,241,0.35)',
          transition: 'transform 0.15s',
        }}
          onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
        >
          🔄 Qayta urinish
        </button>
      )}
    </div>
  )
}
