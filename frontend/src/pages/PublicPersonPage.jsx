/**
 * 4.3 — Public shaxs profili sahifasi
 * Route: /p/:slug — autentifikatsiyasiz ko'rish mumkin
 */
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getPublicPerson } from '../api/persons'
import { fmtDate } from '../utils/date'

const ROLE_ICONS = {
  'Otasi':          '👨',
  'Onasi':          '👩',
  'Farzand':        '👶',
  "Turmush o'rtog'i": '💍',
}
const ROLE_COLORS = {
  'Otasi':          { bg: '#dbeafe', color: '#1d4ed8' },
  'Onasi':          { bg: '#fce7f3', color: '#9d174d' },
  'Farzand':        { bg: '#dcfce7', color: '#166534' },
  "Turmush o'rtog'i": { bg: '#fef9c3', color: '#854d0e' },
}

export default function PublicPersonPage() {
  const { slug } = useParams()
  const navigate  = useNavigate()
  const [person,  setPerson]  = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  useEffect(() => {
    getPublicPerson(slug)
      .then(r => setPerson(r.data))
      .catch(e => setError(e?.response?.data?.error || 'Shaxs topilmadi'))
      .finally(() => setLoading(false))
  }, [slug])

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg,#0f172a,#1e1b4b)' }}>
      <div style={{ color: 'white', fontSize: 18 }}>⏳ Yuklanmoqda...</div>
    </div>
  )

  if (error) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg,#0f172a,#1e1b4b)', padding: 16 }}>
      <div style={{ background: 'white', borderRadius: 24, padding: '40px', maxWidth: 380,
        width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: 52, marginBottom: 12 }}>🔍</div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>{error}</h2>
        <button onClick={() => navigate('/')}
          style={{ marginTop: 16, padding: '10px 24px', borderRadius: 10, border: 'none',
            background: '#6366f1', color: 'white', fontWeight: 700, cursor: 'pointer' }}>
          🏠 Bosh sahifaga
        </button>
      </div>
    </div>
  )

  const isMale = person?.gender === 'male'
  const accentColor = isMale ? '#6366f1' : '#ec4899'
  const bgGrad = isMale
    ? 'linear-gradient(135deg,#1e1b4b 0%,#0f172a 100%)'
    : 'linear-gradient(135deg,#2d1b2e 0%,#0f172a 100%)'

  return (
    <div style={{ minHeight: '100vh', background: bgGrad, padding: '32px 16px 64px' }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>

        {/* Top bar */}
        <div className="flex items-center justify-between mb-6">
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            color: 'rgba(255,255,255,0.7)', fontSize: 13,
          }}>
            <span style={{ fontSize: 20 }}>🌳</span>
            <span>Oila Shajarasi</span>
          </div>
          <button onClick={() => navigate('/login')}
            style={{ padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600,
              background: 'rgba(99,102,241,0.3)', color: 'white', border: '1px solid rgba(99,102,241,0.5)',
              cursor: 'pointer' }}>
            🔐 Kirish
          </button>
        </div>

        {/* Main card */}
        <div style={{
          background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(12px)',
          borderRadius: 28, padding: '36px 32px', border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
        }}>
          {/* Avatar + name */}
          <div className="flex flex-col items-center text-center mb-8">
            <div style={{
              width: 100, height: 100, borderRadius: '50%', overflow: 'hidden',
              background: isMale ? '#eef2ff' : '#fff0f8',
              border: `4px solid ${accentColor}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 44, marginBottom: 16,
              boxShadow: `0 0 0 8px ${accentColor}22`,
            }}>
              {person.photo_url
                ? <img src={person.photo_url} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" />
                : <span>{isMale ? '👨' : '👩'}</span>}
            </div>

            <h1 style={{ fontSize: 28, fontWeight: 800, color: 'white', marginBottom: 4 }}>
              {person.full_name}
            </h1>

            {person.is_deceased && (
              <span style={{ fontSize: 12, padding: '3px 12px', borderRadius: 999,
                background: 'rgba(107,114,128,0.3)', color: '#d1d5db', marginBottom: 8 }}>
                🌿 Vafot etgan
              </span>
            )}

            {/* Info pills */}
            <div className="flex flex-wrap justify-center gap-2 mt-3">
              {person.birth_date && (
                <span style={{ padding: '5px 14px', borderRadius: 999, fontSize: 13,
                  background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.85)' }}>
                  🎂 {fmtDate(person.birth_date)}
                  {person.age != null && !person.death_date && ` · ${person.age} yosh`}
                </span>
              )}
              {person.birth_place && (
                <span style={{ padding: '5px 14px', borderRadius: 999, fontSize: 13,
                  background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.85)' }}>
                  📍 {person.birth_place}
                </span>
              )}
              {person.death_date && (
                <span style={{ padding: '5px 14px', borderRadius: 999, fontSize: 13,
                  background: 'rgba(107,114,128,0.2)', color: '#9ca3af' }}>
                  🕯️ {fmtDate(person.death_date)}
                  {person.age != null && ` · ${person.age} yosh yashadi`}
                  {person.age_would_be != null && ` · ${person.age_would_be} yosh bo'lar edi`}
                </span>
              )}
            </div>
          </div>

          {/* Relatives */}
          {person.relatives?.length > 0 && (
            <div>
              <h3 style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 700,
                letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>
                Oila a'zolari
              </h3>
              <div className="space-y-2">
                {person.relatives.map((r, i) => {
                  const rc = ROLE_COLORS[r.role] || { bg: 'rgba(255,255,255,0.1)', color: '#d1d5db' }
                  return (
                    <div key={i}
                      onClick={() => r.slug && navigate(`/p/${r.slug}`)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '10px 14px', borderRadius: 14,
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        cursor: r.slug ? 'pointer' : 'default',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => { if (r.slug) e.currentTarget.style.background = 'rgba(255,255,255,0.12)' }}
                      onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}>

                      {/* Avatar */}
                      <div style={{ width: 40, height: 40, borderRadius: '50%', overflow: 'hidden',
                        flexShrink: 0, background: r.gender === 'male' ? '#e0e7ff' : '#fce7f3',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                        {(r.photo_url || r.photo)
                          ? <img src={r.photo_url || r.photo} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" />
                          : <span>{ROLE_ICONS[r.role] || '👤'}</span>}
                      </div>

                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, color: 'white', fontSize: 14 }}>{r.name}</div>
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999,
                          background: rc.bg + '33', color: rc.color, fontWeight: 600,
                          border: `1px solid ${rc.bg}` }}>
                          {r.role}
                        </span>
                      </div>

                      {r.slug && (
                        <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 14 }}>›</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Share + CTA */}
        <div className="flex gap-3 mt-5 flex-wrap">
          <button onClick={() => { navigator.clipboard.writeText(window.location.href); toast?.success?.('Nusxa olindi!') }}
            style={{ flex: 1, padding: '11px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.2)',
              background: 'rgba(255,255,255,0.08)', color: 'white', fontWeight: 600,
              cursor: 'pointer', fontSize: 13 }}>
            📋 Havolani ulashish
          </button>
          <button onClick={() => navigate('/login')}
            style={{ flex: 1, padding: '11px', borderRadius: 12, border: 'none',
              background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: 'white',
              fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
            🌳 To'liq shajarani ko'rish
          </button>
        </div>
      </div>
    </div>
  )
}
