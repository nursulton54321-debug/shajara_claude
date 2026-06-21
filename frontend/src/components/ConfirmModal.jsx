import { useEffect } from 'react'
import useThemeStore from '../store/themeStore'

export default function ConfirmModal({
  open,
  title    = "Tasdiqlang",
  message  = "Haqiqatan ham davom etmoqchimisiz?",
  danger   = false,
  confirmLabel = "Ha, davom etish",
  cancelLabel  = "Bekor qilish",
  onConfirm,
  onCancel,
  icon     = "🗑️",
}) {
  const { isDark } = useThemeStore()

  // ESC tugmasi bilan yopish
  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (e.key === 'Escape') onCancel?.() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onCancel])

  if (!open) return null

  const bg  = isDark ? '#1e293b' : '#ffffff'
  const brd = isDark ? '#334155' : '#f1f5f9'
  const txt = isDark ? '#f1f5f9' : '#0f172a'
  const mut = isDark ? '#94a3b8' : '#64748b'

  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        background: 'rgba(2,8,23,0.55)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
        animation: 'confirmFadeIn 0.15s ease',
      }}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: bg, borderRadius: 24, width: '100%', maxWidth: 400,
          border: `1px solid ${brd}`,
          boxShadow: isDark
            ? '0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)'
            : '0 24px 80px rgba(0,0,0,0.18)',
          overflow: 'hidden',
          animation: 'confirmSlideUp 0.2s cubic-bezier(0.34,1.56,0.64,1)',
        }}>

        {/* Header strip */}
        <div style={{
          height: 5,
          background: danger
            ? 'linear-gradient(90deg,#ef4444,#f97316)'
            : 'linear-gradient(90deg,#6366f1,#7c3aed)',
        }} />

        {/* Body */}
        <div style={{ padding: '28px 28px 20px', textAlign: 'center' }}>
          <div style={{
            width: 64, height: 64, borderRadius: 20, margin: '0 auto 16px',
            background: danger
              ? (isDark ? '#450a0a' : '#fef2f2')
              : (isDark ? '#1e1b4b' : '#eef2ff'),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28,
            boxShadow: danger
              ? '0 4px 20px rgba(239,68,68,0.2)'
              : '0 4px 20px rgba(99,102,241,0.2)',
          }}>
            {icon}
          </div>

          <div style={{ fontSize: 18, fontWeight: 900, color: txt, marginBottom: 10 }}>
            {title}
          </div>
          <div style={{ fontSize: 14, color: mut, lineHeight: 1.6 }}>
            {message}
          </div>
        </div>

        {/* Buttons */}
        <div style={{ padding: '0 20px 20px', display: 'flex', gap: 10 }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1, padding: '12px', borderRadius: 14, border: `1.5px solid ${brd}`,
              background: 'transparent', cursor: 'pointer',
              fontSize: 14, fontWeight: 700, color: mut,
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = isDark ? '#334155' : '#f8fafc' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            style={{
              flex: 1, padding: '12px', borderRadius: 14, border: 'none',
              cursor: 'pointer', fontSize: 14, fontWeight: 800, color: 'white',
              background: danger
                ? 'linear-gradient(135deg,#ef4444,#dc2626)'
                : 'linear-gradient(135deg,#6366f1,#7c3aed)',
              boxShadow: danger
                ? '0 4px 14px rgba(239,68,68,0.35)'
                : '0 4px 14px rgba(99,102,241,0.35)',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
            {confirmLabel}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes confirmFadeIn {
          from { opacity: 0 }
          to   { opacity: 1 }
        }
        @keyframes confirmSlideUp {
          from { opacity: 0; transform: scale(0.88) translateY(20px) }
          to   { opacity: 1; transform: scale(1) translateY(0) }
        }
      `}</style>
    </div>
  )
}
