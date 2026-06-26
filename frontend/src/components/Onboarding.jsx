/**
 * Onboarding — yangi foydalanuvchi uchun birinchi marta ko'rsatiladigan qo'llanma.
 * localStorage'da 'onboarding_done' kaliti bo'lsa — ko'rsatilmaydi.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useThemeStore from '../store/themeStore'

const STEPS = [
  {
    icon: '🌳',
    title: 'Shajara ilovasiga xush kelibsiz!',
    text: 'Bu ilova oilangizning shajara daraxtini yaratish va saqlash uchun mo\'ljallangan. Barcha oila a\'zolaringizni bir joyga to\'plang.',
    accent: '#6366f1',
  },
  {
    icon: '👤',
    title: 'Birinchi shaxsni qo\'shing',
    text: '"Shaxslar" bo\'limiga o\'tib, + tugmasini bosing. Ism, tug\'ilgan sana va rasm kiriting. Ota-ona va er-xotinni bog\'lash mumkin.',
    accent: '#10b981',
  },
  {
    icon: '🔗',
    title: 'Shajara daraxtini ko\'ring',
    text: '"Daraxt" bo\'limida barcha oila a\'zolari vizual tarzda ko\'rinadi. Ikkita shaxs o\'rtasidagi qarindoshlikni "Munosabat" bo\'limida hisoblang.',
    accent: '#f59e0b',
  },
  {
    icon: '🤖',
    title: 'AI yordamchi',
    text: 'Har qanday sahifada pastdagi AI chat belgisini bosib, savol bering. Tug\'ilgan kunlar uchun eslatmalar ham o\'rnatishingiz mumkin.',
    accent: '#ec4899',
  },
]

export default function Onboarding({ onDone }) {
  const [step, setStep] = useState(0)
  const { isDark } = useThemeStore()
  const navigate = useNavigate()
  const current = STEPS[step]

  const finish = (goAdd = false) => {
    localStorage.setItem('onboarding_done', '1')
    onDone()
    if (goAdd) navigate('/persons/add')
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      background: 'rgba(0,0,0,0.65)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(6px)',
      padding: 16,
    }}>
      <div style={{
        background: isDark ? '#1e293b' : 'white',
        borderRadius: 28, padding: '36px 32px', maxWidth: 420, width: '100%',
        boxShadow: '0 24px 80px rgba(0,0,0,0.4)',
        border: `2px solid ${current.accent}40`,
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Gradient stripe */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 4,
          background: `linear-gradient(90deg,${current.accent},${current.accent}88)`,
        }} />

        {/* Dots indicator */}
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 28 }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{
              width: i === step ? 20 : 7, height: 7, borderRadius: 4,
              background: i === step ? current.accent : (isDark ? '#334155' : '#e2e8f0'),
              transition: 'all 0.3s',
            }} />
          ))}
        </div>

        {/* Icon */}
        <div style={{
          fontSize: 56, textAlign: 'center', marginBottom: 20,
          animation: 'obPop 0.4s cubic-bezier(.16,1,.3,1) both',
        }}>
          <style>{`
            @keyframes obPop {
              from { opacity:0; transform:scale(0.5) }
              to   { opacity:1; transform:scale(1) }
            }
          `}</style>
          {current.icon}
        </div>

        {/* Text */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            fontSize: 20, fontWeight: 900, color: isDark ? '#f1f5f9' : '#0f172a',
            marginBottom: 12, lineHeight: 1.3,
          }}>
            {current.title}
          </div>
          <div style={{
            fontSize: 14, color: isDark ? '#94a3b8' : '#64748b',
            lineHeight: 1.7,
          }}>
            {current.text}
          </div>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 10 }}>
          {step > 0 && (
            <button
              onClick={() => setStep(s => s - 1)}
              style={{
                flex: 1, padding: '11px', borderRadius: 14, border: isDark ? '1.5px solid #334155' : '1.5px solid #e2e8f0',
                background: 'transparent', cursor: 'pointer', fontSize: 14, fontWeight: 700,
                color: isDark ? '#94a3b8' : '#64748b',
              }}>
              ← Orqaga
            </button>
          )}
          {step < STEPS.length - 1 ? (
            <button
              onClick={() => setStep(s => s + 1)}
              style={{
                flex: 2, padding: '11px', borderRadius: 14, border: 'none',
                background: `linear-gradient(135deg,${current.accent},${current.accent}cc)`,
                color: 'white', fontWeight: 800, fontSize: 14, cursor: 'pointer',
                boxShadow: `0 4px 16px ${current.accent}44`,
              }}>
              Keyingisi →
            </button>
          ) : (
            <button
              onClick={() => finish(true)}
              style={{
                flex: 2, padding: '11px', borderRadius: 14, border: 'none',
                background: 'linear-gradient(135deg,#6366f1,#7c3aed)',
                color: 'white', fontWeight: 800, fontSize: 14, cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(99,102,241,0.45)',
              }}>
              🚀 Boshlash
            </button>
          )}
        </div>

        {/* Skip */}
        <button
          onClick={() => finish(false)}
          style={{
            width: '100%', marginTop: 14, padding: '7px', border: 'none',
            background: 'transparent', cursor: 'pointer', fontSize: 12,
            color: isDark ? '#475569' : '#94a3b8',
          }}>
          O'tkazib yuborish
        </button>
      </div>
    </div>
  )
}
