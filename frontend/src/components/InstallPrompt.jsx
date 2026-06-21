/**
 * 6.3 — PWA Install Prompt Banner
 * Brauzer "beforeinstallprompt" eventini ushlab qoladi
 * va foydalanuvchiga ilovani o'rnatish taklifini ko'rsatadi.
 */
import { useEffect, useState } from 'react'
import useThemeStore from '../store/themeStore'

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [show, setShow]                     = useState(false)
  const [installed, setInstalled]           = useState(false)
  const { isDark } = useThemeStore()

  useEffect(() => {
    // Agar allaqachon o'rnatilgan yoki ko'rsatilmagan bo'lsa
    if (localStorage.getItem('pwa_install_dismissed')) return
    if (window.matchMedia('(display-mode: standalone)').matches) return

    const handler = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      // 3 soniyadan keyin ko'rsatamiz
      setTimeout(() => setShow(true), 3000)
    }

    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', () => { setInstalled(true); setShow(false) })

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') setInstalled(true)
    setShow(false)
    setDeferredPrompt(null)
  }

  const handleDismiss = () => {
    setShow(false)
    localStorage.setItem('pwa_install_dismissed', '1')
  }

  if (!show || installed) return null

  return (
    <div style={{
      position: 'fixed',
      bottom: 24, left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 99999,
      width: 'min(92vw, 380px)',
      background: isDark
        ? 'linear-gradient(135deg,#1e1b4b,#1e293b)'
        : 'linear-gradient(135deg,#6366f1,#7c3aed)',
      borderRadius: 20,
      padding: '16px 18px',
      boxShadow: '0 12px 48px rgba(99,102,241,0.45)',
      display: 'flex', alignItems: 'center', gap: 14,
      border: '1.5px solid rgba(255,255,255,0.2)',
      animation: 'slideUp 0.4s cubic-bezier(0.34,1.56,0.64,1)',
    }}>
      <style>{`
        @keyframes slideUp {
          from { opacity:0; transform:translateX(-50%) translateY(30px) }
          to   { opacity:1; transform:translateX(-50%) translateY(0) }
        }
      `}</style>

      {/* Icon */}
      <div style={{
        width: 52, height: 52, borderRadius: 14, flexShrink: 0,
        background: 'rgba(255,255,255,0.18)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 26,
      }}>🌳</div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 800, color: 'white', lineHeight: 1.3, marginBottom: 3 }}>
          Ilovani o'rnating
        </div>
        <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.75)', lineHeight: 1.4 }}>
          Telefonga o'rnating — offline ham ishlaydi
        </div>
      </div>

      {/* Buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
        <button onClick={handleInstall} style={{
          padding: '7px 14px', borderRadius: 10,
          background: 'white', color: '#6366f1',
          border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 800,
          boxShadow: '0 2px 10px rgba(0,0,0,0.15)', whiteSpace: 'nowrap',
        }}>
          📲 O'rnatish
        </button>
        <button onClick={handleDismiss} style={{
          padding: '5px 14px', borderRadius: 10,
          background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.8)',
          border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer', fontSize: 11, fontWeight: 600,
        }}>
          Keyinroq
        </button>
      </div>
    </div>
  )
}
