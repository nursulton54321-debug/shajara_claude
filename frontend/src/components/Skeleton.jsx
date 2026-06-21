import useThemeStore from '../store/themeStore'

/* Bitta shimmer blok */
export function SkeletonBlock({ width = '100%', height = 16, radius = 8, style = {} }) {
  const { isDark } = useThemeStore()
  return (
    <div style={{
      width, height, borderRadius: radius,
      background: isDark
        ? 'linear-gradient(90deg,#1e293b 25%,#334155 50%,#1e293b 75%)'
        : 'linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%)',
      backgroundSize: '200% 100%',
      animation: 'skeletonShimmer 1.4s ease infinite',
      flexShrink: 0,
      ...style,
    }} />
  )
}

/* Karta skeleton — stat cards uchun */
export function SkeletonCard({ height = 90 }) {
  const { isDark } = useThemeStore()
  const bg = isDark ? '#1e293b' : '#ffffff'
  const brd = isDark ? '#334155' : '#f1f5f9'
  return (
    <div style={{
      background: bg, borderRadius: 16, padding: '16px 18px',
      border: `1px solid ${brd}`,
      display: 'flex', alignItems: 'center', gap: 14, height,
    }}>
      <SkeletonBlock width={44} height={44} radius={12} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <SkeletonBlock width="60%" height={13} />
        <SkeletonBlock width="40%" height={10} />
      </div>
      <SkeletonBlock width={48} height={32} radius={8} />
    </div>
  )
}

/* Ro'yxat satri skeleton */
export function SkeletonRow({ count = 5 }) {
  const { isDark } = useThemeStore()
  const brd = isDark ? '#334155' : '#f1f5f9'
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: 14,
          padding: '14px 18px',
          borderTop: i ? `1px solid ${brd}` : 'none',
        }}>
          <SkeletonBlock width={42} height={42} radius={12} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
            <SkeletonBlock width={`${55 + (i % 3) * 15}%`} height={13} />
            <SkeletonBlock width={`${35 + (i % 2) * 20}%`} height={10} />
          </div>
          <SkeletonBlock width={60} height={24} radius={20} />
        </div>
      ))}
    </>
  )
}

/* To'liq sahifa skeleton — DashboardPage uchun */
export function SkeletonDashboard() {
  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <SkeletonBlock width={220} height={28} radius={10} />
        <SkeletonBlock width={160} height={14} radius={8} />
      </div>
      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} style={{ borderRadius: 20, overflow: 'hidden', height: 90 }}>
            <SkeletonBlock width="100%" height={90} radius={20} />
          </div>
        ))}
      </div>
      {/* 2-col grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <SkeletonBlock height={200} radius={16} />
        <SkeletonBlock height={200} radius={16} />
      </div>
      <SkeletonBlock height={140} radius={16} />
    </div>
  )
}
