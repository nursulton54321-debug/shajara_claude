/**
 * 4.4 — Push Bildirishnomalar sozlamalari sahifasi
 */
import { useState } from 'react'
import usePushNotifications from '../../hooks/usePushNotifications'
import useThemeStore from '../../store/themeStore'
import toast from 'react-hot-toast'

export default function NotificationsPage() {
  const { isDark } = useThemeStore()
  const { supported, permission, subscribed, loading, subscribe, unsubscribe, sendBirthdays } = usePushNotifications()
  const [days, setDays] = useState(7)
  const [sending, setSending] = useState(false)

  const handleSubscribe = async () => {
    try {
      await subscribe()
      toast.success('🔔 Bildirishnomalar yoqildi!')
    } catch (err) {
      toast.error(err.message || '❌ Xato yuz berdi')
    }
  }

  const handleUnsubscribe = async () => {
    await unsubscribe()
    toast.success('🔕 Bildirishnomalar o\'chirildi')
  }

  const handleTestSend = async () => {
    setSending(true)
    try {
      const res = await sendBirthdays(days)
      const { sent, upcoming } = res.data
      if (upcoming.length === 0) {
        toast.success(`🎂 Keyingi ${days} kunda tug'ilgan kun yo'q`)
      } else {
        toast.success(`✅ ${sent} ta bildirishnoma yuborildi (${upcoming.length} ta shaxs)`)
      }
    } catch (err) {
      toast.error('❌ Yuborishda xato')
    } finally {
      setSending(false)
    }
  }

  const card = {
    background: isDark ? 'var(--card-bg)' : 'white',
    borderRadius: 20, padding: 24,
    border: '1px solid var(--border-subtle)',
    boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-5 page-enter" style={{ color: 'var(--text-primary)' }}>

      <div>
        <h1 className="text-2xl font-bold">🔔 Bildirishnomalar</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 2 }}>
          Tug'ilgan kunlar va muhim sanalar haqida xabar oling
        </p>
      </div>

      {/* Browser support check */}
      {!supported && (
        <div style={{ ...card, background: '#fef2f2', border: '1px solid #fecaca' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 24 }}>⚠️</span>
            <div>
              <div style={{ fontWeight: 700, color: '#dc2626' }}>Brauzer qo'llab-quvvatlamaydi</div>
              <p style={{ fontSize: 13, color: '#b91c1c', marginTop: 4 }}>
                Sizning brauzeringiz push bildirishnomalarni qo'llab-quvvatlamaydi.
                Chrome, Firefox yoki Edge brauzerlarini ishlating.
              </p>
            </div>
          </div>
        </div>
      )}

      {supported && (
        <>
          {/* Status card */}
          <div style={card}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div style={{
                  width: 52, height: 52, borderRadius: 14,
                  background: subscribed
                    ? 'linear-gradient(135deg,#10b981,#059669)'
                    : isDark ? '#334155' : '#f1f5f9',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 24,
                }}>
                  {subscribed ? '🔔' : '🔕'}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>
                    {subscribed ? 'Bildirishnomalar yoqilgan' : 'Bildirishnomalar o\'chirilgan'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                    {permission === 'denied'
                      ? '⛔ Brauzer tomonidan bloklangan — sozlamalardan ruxsat bering'
                      : subscribed
                        ? 'Siz tug\'ilgan kun eslatmalarini olasiz'
                        : 'Yoqish uchun tugmani bosing'}
                  </div>
                </div>
              </div>

              {permission !== 'denied' && (
                <button
                  onClick={subscribed ? handleUnsubscribe : handleSubscribe}
                  disabled={loading}
                  style={{
                    padding: '10px 20px', borderRadius: 12, border: 'none',
                    background: subscribed
                      ? '#fee2e2'
                      : 'linear-gradient(135deg,#4f46e5,#7c3aed)',
                    color: subscribed ? '#dc2626' : 'white',
                    fontWeight: 700, fontSize: 13,
                    cursor: loading ? 'default' : 'pointer',
                    opacity: loading ? 0.7 : 1,
                  }}>
                  {loading ? '⏳...' : subscribed ? '🔕 O\'chirish' : '🔔 Yoqish'}
                </button>
              )}
            </div>
          </div>

          {/* Test send */}
          {subscribed && (
            <div style={card} className="space-y-4">
              <h3 style={{ fontWeight: 700, fontSize: 15 }}>🎂 Tug'ilgan kun eslatmalari</h3>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                Belgilangan kunlar ichida tug'ilgan kun bo'ladigan oila a'zolari haqida
                hoziroq bildirishnoma oling.
              </p>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <label style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    Keyingi
                  </label>
                  <select value={days} onChange={e => setDays(Number(e.target.value))}
                    className="input-field" style={{ padding: '7px 12px', fontSize: 13, width: 90 }}>
                    {[1, 3, 7, 14, 30].map(d => (
                      <option key={d} value={d}>{d} kun</option>
                    ))}
                  </select>
                  <label style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    ichida
                  </label>
                </div>
                <button onClick={handleTestSend} disabled={sending}
                  style={{
                    padding: '9px 18px', borderRadius: 10, border: 'none',
                    background: sending ? '#a5b4fc' : 'linear-gradient(135deg,#f59e0b,#d97706)',
                    color: 'white', fontWeight: 700, fontSize: 13,
                    cursor: sending ? 'default' : 'pointer',
                  }}>
                  {sending ? '⏳ Yuborilmoqda...' : '📤 Bildirishnoma yuborish'}
                </button>
              </div>
            </div>
          )}

          {/* How it works */}
          <div style={{ ...card, background: isDark ? '#1e293b' : '#f0fdf4',
            border: '1px solid #bbf7d0' }}>
            <h4 style={{ fontWeight: 700, fontSize: 14, color: isDark ? '#4ade80' : '#16a34a', marginBottom: 10 }}>
              💡 Qanday ishlaydi?
            </h4>
            <div className="space-y-2">
              {[
                ['🔔', 'Bildirishnomalarni yoqing'],
                ['🎂', 'Tug\'ilgan kun yaqinlashganda avtomatik xabar keladi'],
                ['📱', 'Brauzer yopiq bo\'lsa ham xabar keladi (mobil qurilmalarda)'],
                ['⚙️', 'Istalgan vaqt o\'chirib qo\'yishingiz mumkin'],
              ].map(([icon, text]) => (
                <div key={text} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 13,
                  color: isDark ? '#86efac' : '#166534' }}>
                  <span>{icon}</span>
                  <span>{text}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
