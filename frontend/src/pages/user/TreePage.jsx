import { useEffect, useState, useCallback, useRef, useMemo, createContext, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { createShareLink, getShareLinks, deleteShareLink } from '../../api/persons'
import {
  ReactFlow, Background, MiniMap,
  useNodesState, useEdgesState, useReactFlow, useNodesInitialized,
  ReactFlowProvider, Handle, Position, Panel,
} from '@xyflow/react'
import dagre from 'dagre'
import { toPng } from 'html-to-image'
import jsPDF from 'jspdf'
import { createPortal } from 'react-dom'
import '@xyflow/react/dist/style.css'
import { getTree, getStatistics, getPerson } from '../../api/persons'
import useThemeStore from '../../store/themeStore'
import useAuthStore from '../../store/authStore'
import toast from 'react-hot-toast'
import { fmtDate as globalFmtDate } from '../../utils/date'
import AnimCount from '../../components/AnimCount'
import AuthModal from '../../components/AuthModal'

// ── Node position persistence (localStorage) ──────────────────
const POS_KEY = 'shajara_node_positions'
const loadSavedPos = () => { try { return JSON.parse(localStorage.getItem(POS_KEY) || '{}') } catch { return {} } }
const savePosToLS  = (pos) => { try { localStorage.setItem(POS_KEY, JSON.stringify(pos)) } catch {} }

// ── Constants ─────────────────────────────────────────────────
const PW          = 210
const PH          = 88
const CW          = 28
const RANK_SEP    = 18
const NODE_SEP    = 22
const CC_GAP      = 6

const fmtDate = (d) => globalFmtDate(d) === '—' ? '' : globalFmtDate(d)
const calcAge = (birth, death) => {
  if (!birth) return null
  const e = death ? new Date(death + 'T00:00:00') : new Date()
  return Math.floor((e - new Date(birth + 'T00:00:00')) / (365.25 * 86400000))
}

// ── Hover context — ReactFlow node memo'ni chetlab o'tish ──────
const HoverCtx = createContext({ hoveredId: null, connectedIds: null })

// ── StatPanel — tirik/vafot etgan statistika paneli ───────────
function StatPanel({ accent, title, count, pct, sub1label, sub1val, sub2label, sub2val, extra, isDark }) {
  const bg = isDark ? 'rgba(15,23,42,0.95)' : 'rgba(255,255,255,0.97)'
  const border = `2px solid ${accent}`
  const divider = isDark ? '#1e293b' : '#f1f5f9'
  return (
    <div style={{
      background: bg, border, borderRadius: 20, padding: '18px 22px',
      minWidth: 158, boxShadow: `0 8px 32px ${accent}44`,
      backdropFilter: 'blur(18px)', textAlign: 'center',
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
        textTransform: 'uppercase', color: isDark ? '#94a3b8' : '#64748b', marginBottom: 8 }}>
        {title}
      </div>
      <div style={{
        fontSize: 52, fontWeight: 900, lineHeight: 1,
        background: `linear-gradient(135deg,${accent},${accent}aa)`,
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        letterSpacing: '-2px',
      }}>
        {count}
      </div>
      <div style={{ fontSize: 11, color: isDark ? '#64748b' : '#94a3b8', marginTop: 4, fontWeight: 600 }}>nafar</div>
      <div style={{
        margin: '10px 0 8px', padding: '8px 0',
        borderTop: `1px solid ${divider}`,
        fontSize: 26, fontWeight: 900, color: accent,
      }}>
        {pct}%
      </div>
      <div style={{ fontSize: 10, color: isDark ? '#64748b' : '#94a3b8', fontWeight: 600, marginBottom: 10 }}>
        jami oiladan
      </div>
      <div style={{ borderTop: `1px solid ${divider}`, paddingTop: 10, display: 'flex', justifyContent: 'space-around' }}>
        <div>
          <div style={{ fontSize: 10, color: isDark ? '#64748b' : '#94a3b8', marginBottom: 3 }}>{sub1label}</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: accent }}>{sub1val}</div>
        </div>
        <div style={{ width: 1, background: divider }} />
        <div>
          <div style={{ fontSize: 10, color: isDark ? '#64748b' : '#94a3b8', marginBottom: 3 }}>{sub2label}</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: accent }}>{sub2val}</div>
        </div>
      </div>
      {extra && (
        <div style={{ marginTop: 10, fontSize: 11, color: accent, fontWeight: 700,
          background: `${accent}18`, borderRadius: 8, padding: '4px 8px' }}>
          {extra}
        </div>
      )}
    </div>
  )
}

// ── PersonNode ─────────────────────────────────────────────────
function PersonNode({ data }) {
  const male      = data.gender === 'male'
  const dead      = !!data.death_date || !!data.deceased || !!data.is_deceased   // barcha deceased belgilari
  const dimmed    = data.dimDeceased && dead
  const showGray  = dimmed   // faqat dimmed rejimda kulrang ko'rsatiladi
  const isFocused = data.isFocused
  // Hover-highlight: Context orqali o'qiladi (ReactFlow node memo'ni chetlab o'tadi)
  const { hoveredId, connectedIds } = useContext(HoverCtx)
  const dimByHover = !!(hoveredId && !connectedIds?.has(String(data.id)))
  const { isDark } = useThemeStore()
  const [hoverPos, setHoverPos] = useState(null)

  // Odatda barcha kartalar bir xil ko'rinadi (jins bo'yicha rang)
  // Faqat "Vafot etgan" rejimida vafot etganlar kulrang bo'ladi
  const accent  = showGray ? '#94a3b8' : male ? '#818cf8' : '#f472b6'
  const accent2 = showGray ? '#64748b' : male ? '#6366f1' : '#ec4899'
  const gFrom   = showGray
    ? (isDark ? '#1e293b' : '#f8fafc')
    : male
      ? (isDark ? '#1e1b4b' : '#eef2ff')
      : (isDark ? '#2d1b2e' : '#fff0f8')
  const gTo     = isDark ? '#0f172a' : '#ffffff'

  const ageNow     = calcAge(data.birth_date, null)
  const ageAtDeath = dead ? calcAge(data.birth_date, data.death_date) : null
  const PHOTO      = 48

  // Name: split to first+last
  const nameParts  = (data.full_name || '').trim().split(' ')
  const lastName   = nameParts[0] || ''
  const firstName  = nameParts.slice(1).join(' ')

  return (
    <div
      style={{
        position: 'relative', width: PW, userSelect: 'none', cursor: 'pointer',
        opacity: dimByHover ? 0.18 : 1,
        filter: dimByHover ? 'brightness(0.5) grayscale(40%)' : 'none',
        transition: 'opacity 0.2s, filter 0.2s',
      }}
      onClick={() => data.onPersonClick && data.onPersonClick(data.id)}
      onMouseEnter={e => {
        const rect = e.currentTarget.getBoundingClientRect()
        const x = rect.right + 10 > window.innerWidth - 240 ? rect.left - 250 : rect.right + 10
        setHoverPos({ x, y: Math.max(8, Math.min(rect.top, window.innerHeight - 300)) })
      }}
      onMouseLeave={() => setHoverPos(null)}
    >
      {/* ── Hover preview card ─────────────────────── */}
      {hoverPos && createPortal(
        <div style={{
          position: 'fixed', left: hoverPos.x, top: hoverPos.y, zIndex: 99999,
          width: 256, pointerEvents: 'none',
          background: isDark ? 'rgba(15,23,42,0.97)' : 'rgba(255,255,255,0.98)',
          borderRadius: 18, overflow: 'hidden',
          border: `1.5px solid ${accent}50`,
          backdropFilter: 'blur(20px)',
          boxShadow: isDark
            ? `0 24px 64px rgba(0,0,0,0.65), 0 0 0 1px ${accent}28`
            : `0 24px 64px rgba(0,0,0,0.13), 0 0 0 1px ${accent}22`,
          animation: 'confirmFadeIn 0.15s ease',
        }}>
          {/* Header strip */}
          <div style={{
            height: 4,
            background: showGray
              ? 'linear-gradient(90deg,#64748b,#94a3b8)'
              : `linear-gradient(90deg,${accent2},${accent})`,
          }} />

          <div style={{ padding: '14px 14px 0' }}>
            {/* Photo + name row */}
            <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start', marginBottom: 11 }}>
              <div style={{
                width: 64, height: 64, borderRadius: 14, overflow: 'hidden', flexShrink: 0,
                border: `2px solid ${accent}`,
                background: `linear-gradient(135deg,${gFrom},${gTo})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32,
                boxShadow: `0 4px 14px ${accent}38`,
              }}>
                {data.photo_url
                  ? <img src={data.photo_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                  : <span>{male ? '👨' : '👩'}</span>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontWeight: 800, fontSize: 13.5,
                  color: isDark ? '#f1f5f9' : '#0f172a',
                  lineHeight: 1.25, marginBottom: 5, wordBreak: 'break-word',
                }}>
                  {data.full_name}
                </div>
                {!dead && ageNow != null && (
                  <div style={{
                    display: 'inline-flex', alignItems: 'center',
                    background: `${accent}22`, borderRadius: 8, padding: '2px 9px',
                    fontSize: 12.5, fontWeight: 800, color: accent2,
                  }}>{ageNow} yosh</div>
                )}
                {dead && ageAtDeath != null && (
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    background: 'rgba(100,116,139,0.15)', borderRadius: 8, padding: '2px 9px',
                    fontSize: 11.5, fontWeight: 700, color: '#94a3b8',
                  }}>🌿 {ageAtDeath} yoshida vafot etdi</div>
                )}
                {/* Gender badge */}
                <div style={{
                  marginTop: 5, fontSize: 10, fontWeight: 600,
                  color: isDark ? '#64748b' : '#94a3b8',
                }}>
                  {male ? '♂ Erkak' : '♀ Ayol'}
                  {dead ? ' · Vafot etgan' : ''}
                </div>
              </div>
            </div>

            {/* Info rows */}
            <div style={{
              display: 'flex', flexDirection: 'column', gap: 6,
              paddingBottom: 11,
              borderBottom: `1px solid ${isDark ? 'rgba(148,163,184,0.1)' : 'rgba(0,0,0,0.07)'}`,
            }}>
              {data.birth_date && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, width: 18, textAlign: 'center', flexShrink: 0 }}>🐣</span>
                  <div>
                    <div style={{ fontSize: 9.5, color: isDark ? '#475569' : '#94a3b8', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Tug'ilgan sana</div>
                    <div style={{ fontSize: 11.5, color: isDark ? '#cbd5e1' : '#334155', fontWeight: 600 }}>{fmtDate(data.birth_date)}</div>
                  </div>
                </div>
              )}
              {dead && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, width: 18, textAlign: 'center', flexShrink: 0 }}>🌿</span>
                  <div>
                    <div style={{ fontSize: 9.5, color: isDark ? '#475569' : '#94a3b8', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Vafot etgan</div>
                    <div style={{ fontSize: 11.5, color: isDark ? '#cbd5e1' : '#334155', fontWeight: 600 }}>
                      {data.death_date ? fmtDate(data.death_date) : 'Sana noma\'lum'}
                    </div>
                  </div>
                </div>
              )}
              {!dead && ageNow != null && data.birth_date && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, width: 18, textAlign: 'center', flexShrink: 0 }}>🎂</span>
                  <div>
                    <div style={{ fontSize: 9.5, color: isDark ? '#475569' : '#94a3b8', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Yoshi</div>
                    <div style={{ fontSize: 11.5, color: isDark ? '#cbd5e1' : '#334155', fontWeight: 600 }}>{ageNow} yosh</div>
                  </div>
                </div>
              )}
              {data.birth_place && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, width: 18, textAlign: 'center', flexShrink: 0 }}>📍</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 9.5, color: isDark ? '#475569' : '#94a3b8', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Tug'ilgan joy</div>
                    <div style={{ fontSize: 11.5, color: isDark ? '#cbd5e1' : '#334155', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{data.birth_place}</div>
                  </div>
                </div>
              )}
              {data.notes && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <span style={{ fontSize: 13, width: 18, textAlign: 'center', flexShrink: 0 }}>📝</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 9.5, color: isDark ? '#475569' : '#94a3b8', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Eslatma</div>
                    <div style={{ fontSize: 11, color: isDark ? '#94a3b8' : '#64748b', lineHeight: 1.4,
                      overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                    }}>{data.notes}</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer CTA */}
          <div style={{
            padding: '9px 14px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            background: dead
              ? (isDark ? 'rgba(71,85,105,0.15)' : 'rgba(241,245,249,0.9)')
              : (isDark ? `${accent}12` : `${accent}0e`),
          }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: dead ? '#94a3b8' : accent2, letterSpacing: '0.03em' }}>
              👆 Batafsil ko'rish uchun bosing
            </span>
          </div>
        </div>,
        document.body
      )}

      {/* ── Focus button (hover paytida kard ustida) ── */}
      {hoverPos && data.onFocusClick && (
        <button
          onClick={e => { e.stopPropagation(); data.onFocusClick(data.id) }}
          style={{
            position: 'absolute', bottom: -10, right: 8, zIndex: 40,
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '3px 10px', borderRadius: 20, border: 'none', cursor: 'pointer',
            fontSize: 10.5, fontWeight: 800,
            background: data.isFocused
              ? 'linear-gradient(135deg,#f59e0b,#d97706)'
              : 'linear-gradient(135deg,#1e293b,#334155)',
            color: data.isFocused ? 'white' : '#cbd5e1',
            boxShadow: data.isFocused
              ? '0 2px 10px rgba(245,158,11,0.5)'
              : '0 2px 8px rgba(0,0,0,0.35)',
            transition: 'all 0.15s',
          }}>
          🎯 {data.isFocused ? "O'chirish" : 'Focus'}
        </button>
      )}

      {/* ── Child-order badge ──────────────────────── */}
      {data.child_number != null && (
        <div style={{
          position: 'absolute', top: -10, left: -10, zIndex: 30,
          width: 22, height: 22, borderRadius: '50%',
          background: 'linear-gradient(135deg,#f97316,#ea580c)',
          color: 'white', fontSize: 9.5, fontWeight: 900,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '2px solid white', boxShadow: '0 2px 8px rgba(249,115,22,0.55)',
        }}>{data.child_number}</div>
      )}

      {/* ── Main card ─────────────────────────────── */}
      <div className="node-enter" style={{
        width: PW, height: PH,
        display: 'flex', alignItems: 'center',
        background: `linear-gradient(118deg,${gFrom} 0%,${gTo} 100%)`,
        borderRadius: 14,
        border: isFocused
          ? `2.5px solid #f59e0b`
          : `1.5px solid ${showGray ? (isDark ? '#334155' : '#e2e8f0') : accent + '60'}`,
        boxShadow: isFocused
          ? `0 0 0 4px rgba(245,158,11,0.3), 0 6px 24px rgba(245,158,11,0.4)`
          : showGray
            ? `0 2px 8px rgba(0,0,0,0.08)`
            : `0 4px 20px ${accent}28, inset 0 1px 0 rgba(255,255,255,0.12)`,
        opacity: dimmed ? 0.3 : 1,
        filter: dimmed ? 'grayscale(80%) brightness(0.7)' : 'none',
        position: 'relative', overflow: 'hidden',
        transition: 'opacity 0.3s, filter 0.3s, transform 0.18s, box-shadow 0.18s',
      }}
        onMouseEnter={e => {
          e.currentTarget.style.transform = 'translateY(-3px) scale(1.01)'
          e.currentTarget.style.boxShadow = showGray
            ? '0 8px 24px rgba(0,0,0,0.14)'
            : `0 10px 32px ${accent}45, inset 0 1px 0 rgba(255,255,255,0.15)`
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = ''
          e.currentTarget.style.boxShadow = showGray
            ? '0 2px 8px rgba(0,0,0,0.08)'
            : `0 4px 20px ${accent}28, inset 0 1px 0 rgba(255,255,255,0.12)`
        }}
      >
        {/* left accent stripe */}
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0, width: 4,
          background: showGray
            ? (isDark ? '#475569' : '#cbd5e1')
            : `linear-gradient(180deg,${accent},${accent2})`,
          borderRadius: '14px 0 0 14px',
        }} />

        {/* subtle glow orb */}
        {!showGray && (
          <div style={{
            position: 'absolute', top: -18, left: -8, width: 70, height: 70,
            borderRadius: '50%', pointerEvents: 'none',
            background: `radial-gradient(circle,${accent}18,transparent 68%)`,
          }} />
        )}

        {/* Photo */}
        <div style={{ paddingLeft: 12, paddingRight: 10, flexShrink: 0, position: 'relative', zIndex: 1 }}>
          <div style={{
            width: PHOTO, height: PHOTO, borderRadius: 12, overflow: 'hidden',
            border: `2px solid ${showGray ? (isDark ? '#475569' : '#cbd5e1') : accent}`,
            background: showGray
              ? (isDark ? '#1e293b' : '#f1f5f9')
              : `linear-gradient(135deg,${accent}22,${gFrom})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, flexShrink: 0,
            boxShadow: showGray ? 'none' : `0 0 0 3px ${accent}22`,
          }}>
            {data.photo_url
              ? <img src={data.photo_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
              : <span>{male ? '👨' : '👩'}</span>}
          </div>
          {dead && (
            <div style={{
              position: 'absolute', bottom: -2, right: 6,
              background: 'linear-gradient(135deg,#64748b,#475569)',
              color: 'white', fontSize: 7, fontWeight: 900,
              padding: '1px 4px', borderRadius: 5,
              border: '1.5px solid white', letterSpacing: '0.02em',
            }}>🌿</div>
          )}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0, paddingRight: 10, position: 'relative', zIndex: 1 }}>
          {/* Last name */}
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
            color: showGray ? (isDark ? '#64748b' : '#94a3b8') : accent2,
            lineHeight: 1, marginBottom: 2,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{lastName}</div>
          {/* First name */}
          {firstName && (
            <div style={{
              fontSize: 12, fontWeight: 700,
              color: isDark ? '#e2e8f0' : '#1e293b',
              lineHeight: 1.2, marginBottom: 4,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{firstName}</div>
          )}
          {/* Age / death info */}
          {dead ? (
            <div style={{
              fontSize: 10, color: isDark ? '#64748b' : '#94a3b8', fontWeight: 500,
              display: 'flex', alignItems: 'center', gap: 3,
            }}>
              {ageAtDeath != null ? `${ageAtDeath} yil yashadi` : '🌿 Vafot etgan'}
            </div>
          ) : (
            ageNow != null && (
              <div style={{
                display: 'inline-flex', alignItems: 'center',
                background: `${accent}18`, borderRadius: 6,
                padding: '1.5px 7px', fontSize: 11, fontWeight: 800, color: accent2,
              }}>{ageNow} yosh</div>
            )
          )}
          {/* Date row */}
          {data.birth_date && (
            <div style={{
              fontSize: 9, color: isDark ? '#475569' : '#94a3b8', marginTop: 3,
              letterSpacing: '0.01em',
            }}>
              {fmtDate(data.birth_date)}
              {dead && data.death_date ? ` — ${fmtDate(data.death_date)}` : ''}
            </div>
          )}
        </div>

        <Handle type="target" position={Position.Top}    style={{ opacity:0, top:-3 }} />
        <Handle type="source" position={Position.Bottom} style={{ opacity:0, bottom:-3 }} />
        <Handle type="source" position={Position.Right}  id="right"
          style={{ opacity:0, right:-3, top: PH - 16 }} />
        <Handle type="target" position={Position.Left}   id="left"
          style={{ opacity:0, left:-3,  top: PH - 16 }} />
      </div>
    </div>
  )
}

// ── CoupleNode ─────────────────────────────────────────────────
function CoupleNode({ id, data }) {
  const isCollapsed = data.collapsed
  const cnt         = data.childCount || 0
  const hasChildren = cnt > 0

  if (!hasChildren) {
    // Farzand yo'q — faqat er-xotin belgisi, bosilmaydi
    return (
      <div style={{
        width: CW, height: CW, borderRadius: '50%',
        background: 'linear-gradient(135deg,#f43f5e,#e11d48)',
        color: 'white', fontSize: 14,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 3px 12px rgba(244,63,94,0.55)',
        border: '2.5px solid white', userSelect: 'none',
      }}>
        💍
        <Handle type="target" position={Position.Top}    style={{ opacity:0, top:-4 }} />
        <Handle type="source" position={Position.Bottom} style={{ opacity:0, bottom:-4 }} />
      </div>
    )
  }

  return (
    <div
      className="node-enter-fast"
      onClick={e => { e.stopPropagation(); data.onToggle && data.onToggle(id) }}
      title={isCollapsed ? "Farzandlarni ko'rsatish" : "Farzandlarni yig'ish"}
      style={{
        width: CW, height: CW, borderRadius: '50%',
        background: isCollapsed
          ? 'linear-gradient(135deg,#10b981,#059669)'
          : 'linear-gradient(135deg,#f97316,#dc6803)',
        color: 'white',
        fontSize: isCollapsed ? 10 : 18,
        fontWeight: 900,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer',
        boxShadow: isCollapsed
          ? '0 3px 12px rgba(16,185,129,0.65)'
          : '0 3px 12px rgba(249,115,22,0.65)',
        border: '2.5px solid white', userSelect: 'none',
        transition: 'all 0.22s cubic-bezier(0.34,1.56,0.64,1)',
        minWidth: isCollapsed && cnt > 9 ? 40 : CW,
        paddingInline: isCollapsed ? 5 : 0,
        whiteSpace: 'nowrap', letterSpacing: '-0.3px',
      }}>
      {isCollapsed ? `+${cnt}` : '−'}
      <Handle type="target" position={Position.Top}    style={{ opacity:0, top:-4 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity:0, bottom:-4 }} />
    </div>
  )
}

// ── Generation label ───────────────────────────────────────────
function GenLabelNode({ data }) {
  return (
    <div style={{
      background: 'linear-gradient(135deg,#6366f1,#7c3aed)',
      color: 'white', padding: '5px 14px',
      borderRadius: 20, fontSize: 10.5, fontWeight: 700,
      whiteSpace: 'nowrap', boxShadow: '0 4px 14px rgba(99,102,241,0.38)',
      letterSpacing: '0.05em', border: '1.5px solid rgba(255,255,255,0.3)',
      pointerEvents: 'none',
    }}>
      {data.label}
    </div>
  )
}

// ── CoupleEdge ─────────────────────────────────────────────────
function CoupleEdge({ sourceX, sourceY, targetX, targetY, data }) {
  const midX      = (sourceX + targetX) / 2
  const ccTopY    = data?.ccTopY
  const childless = data?.childless
  const stemEndY  = childless ? sourceY : (ccTopY ?? sourceY + 10)
  return (
    <>
      <path d={`M ${sourceX} ${sourceY} L ${targetX} ${targetY}`}
        stroke="#f43f5e" strokeWidth={8} fill="none" opacity={0.04} className="tree-edge-glow" />
      <path d={`M ${sourceX} ${sourceY} L ${targetX} ${targetY}`}
        stroke="#fca5a5" strokeWidth={2} fill="none"
        strokeDasharray="7 4" strokeLinecap="round" className="tree-edge-spouse" />
      {!childless && (
        <path d={`M ${midX} ${sourceY} L ${midX} ${stemEndY}`}
          stroke="#f97316" strokeWidth={2.2} fill="none" opacity={0.75} />
      )}
      <rect x={midX - 13} y={sourceY - 11} width={26} height={22} rx={7}
        fill="white" stroke="#fca5a5" strokeWidth={1.5}
        style={{ filter:'drop-shadow(0 1px 4px rgba(244,63,94,0.14))' }} />
      <text x={midX} y={sourceY + 5} textAnchor="middle"
        fontSize={14} fill="#f43f5e" fontWeight={700}
        style={{ userSelect:'none', pointerEvents:'none' }}>⚭</text>
    </>
  )
}

// ── StemEdge ───────────────────────────────────────────────────
function StemEdge({ sourceX, sourceY, targetX, targetY, data }) {
  const clr = data?.color || '#818cf8'
  return (
    <>
      <path d={`M ${sourceX} ${sourceY} L ${targetX} ${targetY}`}
        stroke={clr} strokeWidth={7} fill="none" opacity={0.06} />
      <path d={`M ${sourceX} ${sourceY} L ${targetX} ${targetY}`}
        stroke={clr} strokeWidth={2.2} fill="none" strokeLinecap="round" />
    </>
  )
}

// ── ChildEdge ──────────────────────────────────────────────────
// Ota-ona CC → farzand. Cubic bezier egri chiziq.
// Arrow yo'nalishi bezier'ning oxiridagi haqiqiy tangent bo'yicha
// hisoblanadi (t=0.85 nuqtasidan endpoint'gacha yo'nalish).
function ChildEdge({ sourceX, sourceY, targetX, targetY, data }) {
  const clr  = data?.color || '#6366f1'
  const midY = (sourceY + targetY) / 2
  const curve = `M ${sourceX} ${sourceY} C ${sourceX} ${midY}, ${targetX} ${midY}, ${targetX} ${targetY}`

  // Egri chiziqning oxirgi yo'nalishini t=0.85 nuqtasidan hisoblash
  const t = 0.85, mt = 1 - t
  const px = mt**3*sourceX + 3*mt**2*t*sourceX + 3*mt*t**2*targetX + t**3*targetX
  const py = mt**3*sourceY + 3*mt**2*t*midY    + 3*mt*t**2*midY    + t**3*targetY
  const adx = targetX - px, ady = targetY - py
  const alen = Math.sqrt(adx*adx + ady*ady) || 1
  const ux = adx / alen, uy = ady / alen  // arrow direction unit vector
  const nx = -uy,         ny = ux          // perpendicular

  const AL = 10, AW = 5
  const bx = targetX - AL*ux, by = targetY - AL*uy
  const pts = `${targetX},${targetY} ${bx + AW*nx},${by + AW*ny} ${bx - AW*nx},${by - AW*ny}`

  return (
    <>
      <path d={curve} stroke={clr} strokeWidth={7} fill="none" opacity={0.06} />
      <path d={curve} stroke={clr} strokeWidth={2.2} fill="none" strokeLinecap="round" />
      <polygon points={pts} fill={clr} />
    </>
  )
}

const nodeTypes = {
  personNode: PersonNode,
  coupleNode: CoupleNode,
  genLabel:   GenLabelNode,
}
const edgeTypes = {
  coupleEdge: CoupleEdge,
  stemEdge:   StemEdge,
  childEdge:  ChildEdge,
}

// ── Focus mode: N avlod filtr ─────────────────────────────────
function focusFilter(persons, focusId, generations = 3) {
  if (!focusId) return persons
  const pm = {}
  persons.forEach(p => { pm[p.id] = p })

  const included = new Set()
  included.add(focusId)

  // Ancestors
  function addAncestors(id, depth) {
    if (depth <= 0) return
    const p = pm[id]
    if (!p) return
    if (p.father_id) { included.add(p.father_id); addAncestors(p.father_id, depth - 1) }
    if (p.mother_id) { included.add(p.mother_id); addAncestors(p.mother_id, depth - 1) }
  }
  // Descendants
  function addDescendants(id, depth) {
    if (depth <= 0) return
    const kids = persons.filter(p => p.father_id === id || p.mother_id === id)
    kids.forEach(k => { included.add(k.id); addDescendants(k.id, depth - 1) })
  }
  // Spouses of included
  function addSpouses() {
    persons.forEach(p => {
      if (included.has(p.id)) {
        ;(p.families || []).forEach(f => { if (f.partner_id) included.add(f.partner_id) })
      }
    })
  }

  addAncestors(focusId, generations)
  addDescendants(focusId, generations)
  addSpouses()

  return persons.filter(p => included.has(p.id))
}

// ── Generation computation ────────────────────────────────────
function computeGenerations(persons) {
  const pm = {}
  persons.forEach(p => { pm[p.id] = p })
  const gen = {}
  persons.forEach(p => { gen[p.id] = 0 })

  // 1-o'tish: ota-ona → farzand orqali avlodlarni hisoblash
  let changed = true
  while (changed) {
    changed = false
    persons.forEach(c => {
      let mx = -1
      if (c.father_id && pm[c.father_id]) mx = Math.max(mx, gen[c.father_id])
      if (c.mother_id && pm[c.mother_id]) mx = Math.max(mx, gen[c.mother_id])
      if (mx >= 0 && gen[c.id] < mx + 1) { gen[c.id] = mx + 1; changed = true }
    })
  }

  // 2-o'tish: Oilaga kirgan shaxslar (ota/ona yo'q) — juftining avlodini oladi
  // Masalan: Nargizabonu (father_id/mother_id yo'q) → Elyor bilan nikohda → Elyor avlodi = 2 → Nargizabonu ham 2
  changed = true
  while (changed) {
    changed = false
    persons.forEach(p => {
      if (p.father_id || p.mother_id) return // o'z avlodi bor, o'zgartirmaymiz
      ;(p.families || []).forEach(f => {
        const spouseGen = gen[f.partner_id]
        if (f.partner_id && spouseGen !== undefined && gen[p.id] < spouseGen) {
          gen[p.id] = spouseGen
          changed = true
        }
      })
    })
  }

  return gen
}

// ── Build layout ───────────────────────────────────────────────
// Har bir avlod qatorini x=0 markazga joylashtirish
function centerRows(nodes) {
  // 1. personNode'larni _gen bo'yicha guruhlash
  const groups = new Map()
  nodes.forEach(nd => {
    if (nd.type !== 'personNode') return
    const gen = nd.data._gen ?? 0
    if (!groups.has(gen)) groups.set(gen, [])
    groups.get(gen).push(nd)
  })

  // 2. Har qatorni markazlashtirish
  groups.forEach(group => {
    const xs = group.map(nd => nd.position.x + PW / 2)
    const mid = (Math.min(...xs) + Math.max(...xs)) / 2
    group.forEach(nd => { nd.position = { ...nd.position, x: nd.position.x - mid } })
  })

  // 3. coupleNode'larni ota-ona o'rtasiga joylashtirish
  const posById = {}
  nodes.forEach(nd => { posById[nd.id] = nd.position })
  nodes.forEach(nd => {
    if (nd.type !== 'coupleNode') return
    const { fatherId, motherId } = nd.data
    const fp = fatherId ? posById[`p-${fatherId}`] : null
    const mp = motherId ? posById[`p-${motherId}`] : null
    if (!fp && !mp) return
    const fx = fp ? fp.x + PW / 2 : null
    const mx = mp ? mp.x + PW / 2 : null
    const cx = (fx != null && mx != null ? (fx + mx) / 2 : (fx ?? mx)) - CW / 2
    nd.position = { ...nd.position, x: cx }
  })

  // 4. genLabel'larni eng chap personNode ga nisbatan joylashtirish
  const minX = Math.min(...nodes.filter(nd => nd.type === 'personNode').map(nd => nd.position.x))
  nodes.forEach(nd => {
    if (nd.type === 'genLabel') nd.position = { ...nd.position, x: minX - 128 }
  })

  return nodes
}

function buildLayout(persons, collapsed, toggleFn, dimDeceased, onPersonClick, focusedId, onFocusClick) {
  if (!persons.length) return { nodes: [], edges: [] }

  const pm = {}
  persons.forEach(p => { pm[p.id] = p })

  const coupleMap   = new Map()
  const coupleInfo  = {}
  const childCouple = {}

  persons.forEach(p => {
    const fid = p.father_id, mid = p.mother_id
    if (!fid && !mid) return
    const key = fid && mid
      ? `${Math.min(fid, mid)}-${Math.max(fid, mid)}`
      : fid ? `f${fid}` : `m${mid}`
    if (!coupleMap.has(key)) {
      const cid = `cc-${key}`
      coupleMap.set(key, cid)
      coupleInfo[cid] = { fatherId: fid || null, motherId: mid || null }
    }
    childCouple[p.id] = coupleMap.get(key)
  })

  const coupleChildren = {}
  persons.forEach(p => {
    const cid = childCouple[p.id]
    if (cid) { coupleChildren[cid] = coupleChildren[cid] || []; coupleChildren[cid].push(p.id) }
  })

  const personCouples = {}
  Object.entries(coupleInfo).forEach(([cid, { fatherId, motherId }]) => {
    if (fatherId) { personCouples[fatherId] = personCouples[fatherId] || []; personCouples[fatherId].push(cid) }
    if (motherId) { personCouples[motherId] = personCouples[motherId] || []; personCouples[motherId].push(cid) }
  })

  function hidePersonDeep(pid, hp, hc) {
    if (hp.has(pid)) return
    hp.add(pid)
    const p = pm[pid]
    // Ko'p oila: har bir partner ham yashiriladi
    ;(p?.families || []).forEach(f => {
      if (f.partner_id && pm[f.partner_id] && !hp.has(f.partner_id))
        hidePersonDeep(f.partner_id, hp, hc)
    })
    ;(personCouples[pid] || []).forEach(ccid => {
      if (hc.has(ccid)) return
      hc.add(ccid)
      const { fatherId, motherId } = coupleInfo[ccid]
      const spouseId = fatherId === pid ? motherId : fatherId
      if (spouseId && !hp.has(spouseId)) hidePersonDeep(spouseId, hp, hc)
      ;(coupleChildren[ccid] || []).forEach(cid2 => hidePersonDeep(cid2, hp, hc))
    })
  }

  function getDescendants(startCid) {
    const hp = new Set(), hc = new Set()
    ;(coupleChildren[startCid] || []).forEach(pid => hidePersonDeep(pid, hp, hc))
    return { hp, hc }
  }

  const hiddenP = new Set(), hiddenC = new Set()
  collapsed.forEach(cid => {
    const { hp, hc } = getDescendants(cid)
    hp.forEach(id => hiddenP.add(id))
    hc.forEach(id => hiddenC.add(id))
  })

  const g = new dagre.graphlib.Graph({ multigraph: false })
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'TB', ranksep: RANK_SEP, nodesep: NODE_SEP, marginx: 100, marginy: 60 })

  persons.forEach(p => {
    if (!hiddenP.has(p.id)) g.setNode(`p-${p.id}`, { width: PW, height: PH })
  })

  const addCC = (cid) => {
    if (g.hasNode(cid)) return
    const { fatherId, motherId } = coupleInfo[cid] || {}
    const fOk = !fatherId || !hiddenP.has(fatherId)
    const mOk = !motherId || !hiddenP.has(motherId)
    if ((fOk || mOk) && !hiddenC.has(cid)) g.setNode(cid, { width: CW, height: CW })
  }

  Object.keys(coupleInfo).forEach(addCC)
  collapsed.forEach(addCC)

  Object.entries(coupleInfo).forEach(([cid, { fatherId, motherId }]) => {
    if (!g.hasNode(cid)) return
    if (fatherId && g.hasNode(`p-${fatherId}`)) g.setEdge(`p-${fatherId}`, cid)
    if (motherId && g.hasNode(`p-${motherId}`)) g.setEdge(`p-${motherId}`, cid)
  })

  // Detect and remove orphaned CCs: CCs where neither parent node is in the graph.
  // This happens in focus mode when a spouse's parents are outside the filtered set.
  // Remove them from dagre entirely so they don't distort the layout.
  const orphanedCC = new Set()
  Object.entries(coupleInfo).forEach(([cid, { fatherId, motherId }]) => {
    if (!g.hasNode(cid)) return
    const fIn = fatherId && g.hasNode(`p-${fatherId}`)
    const mIn = motherId && g.hasNode(`p-${motherId}`)
    if (!fIn && !mIn) { orphanedCC.add(cid); g.removeNode(cid) }
  })

  // Helper: is this person effectively a root (no in-graph parents)?
  function isEffectiveRoot(pid) {
    const p = pm[pid]
    if (!p || (!p.father_id && !p.mother_id)) return true
    const pcc = childCouple[pid]
    return pcc ? orphanedCC.has(pcc) : true
  }

  const marriedInOf  = {}
  const marriedInSet = new Set()

  Object.entries(coupleInfo).forEach(([, { fatherId, motherId }]) => {
    if (!fatherId || !motherId) return
    const f = pm[fatherId], m = pm[motherId]
    if (!f || !m) return
    if (!g.hasNode(`p-${fatherId}`) || !g.hasNode(`p-${motherId}`)) return
    if (isEffectiveRoot(motherId)) {
      const fParentCC = childCouple[fatherId]
      if (fParentCC && g.hasNode(fParentCC) && !orphanedCC.has(fParentCC)) {
        marriedInOf[fatherId] = { spouseId: motherId, parentCC: fParentCC }
        marriedInSet.add(motherId)
      }
    }
    if (isEffectiveRoot(fatherId)) {
      const mParentCC = childCouple[motherId]
      if (mParentCC && g.hasNode(mParentCC) && !orphanedCC.has(mParentCC)) {
        marriedInOf[motherId] = { spouseId: fatherId, parentCC: mParentCC }
        marriedInSet.add(fatherId)
      }
    }
  })

  // Farzandsiz juftlar: families ma'lumotidan foydalanib, turmush o'rtog'ini
  // sherigining avlodiga joylashtirish (coupleInfo da yo'q holat)
  persons.forEach(p => {
    if (hiddenP.has(p.id) || marriedInSet.has(p.id)) return
    if (!isEffectiveRoot(p.id)) return  // o'z ota-onasi bor — odatiy tartib
    ;(p.families || []).forEach(f => {
      const partnerId = f.partner_id
      if (!partnerId || !pm[partnerId] || hiddenP.has(partnerId)) return
      if (marriedInSet.has(p.id)) return
      if (!isEffectiveRoot(partnerId)) {
        // Sherigining ota-ona juft-markazi
        const partnerParentCC = childCouple[partnerId]
        if (partnerParentCC && g.hasNode(partnerParentCC) && !orphanedCC.has(partnerParentCC)) {
          marriedInOf[partnerId] = marriedInOf[partnerId] || { spouseId: p.id, parentCC: partnerParentCC }
          marriedInSet.add(p.id)
        }
      }
    })
  })

  persons.forEach(p => {
    if (hiddenP.has(p.id)) return
    if (marriedInSet.has(p.id)) return
    const cid = childCouple[p.id]
    if (!cid || !g.hasNode(cid) || !g.hasNode(`p-${p.id}`)) return
    if (orphanedCC.has(cid)) return // skip — parent CC has no in-graph parents
    g.setEdge(cid, `p-${p.id}`)
    const si = marriedInOf[p.id]
    if (si && !hiddenP.has(si.spouseId) && g.hasNode(`p-${si.spouseId}`))
      g.setEdge(si.parentCC, `p-${si.spouseId}`, { weight: 5, minlen: 1 })
  })

  dagre.layout(g)

  // Farzandsiz juftlar: families asosida vizual couple center hisoblash
  const childlessCouples = []
  const _seenFC = new Set()
  persons.forEach(p => {
    ;(p.families || []).forEach(f => {
      const partnerId = f.partner_id
      if (!partnerId || !pm[partnerId] || hiddenP.has(p.id) || hiddenP.has(partnerId)) return
      const fatherId = p.gender === 'male' ? p.id : partnerId
      const motherId = p.gender === 'male' ? partnerId : p.id
      const fcKey = `${Math.min(fatherId, motherId)}-${Math.max(fatherId, motherId)}`
      if (_seenFC.has(fcKey)) return
      _seenFC.add(fcKey)
      const ccId = `cc-${fcKey}`
      if (coupleInfo[ccId]) return  // farzandlari bor, allaqachon boshqarilgan
      if (!g.hasNode(`p-${fatherId}`) || !g.hasNode(`p-${motherId}`)) return
      const fN = g.node(`p-${fatherId}`), mN = g.node(`p-${motherId}`)
      if (!fN || !mN) return
      childlessCouples.push({ cid: ccId, fatherId, motherId,
        cx: (fN.x + mN.x) / 2, cy: (fN.y + mN.y) / 2 })
    })
  })

  // Force each couple pair to the same Y level.
  // Dagre can place a "married-in" spouse at a higher rank than their partner
  // (especially in focus mode). Snapping both to max(Y) fixes the misalignment
  // before yGroups processes them.
  Object.entries(coupleInfo).forEach(([, { fatherId, motherId }]) => {
    if (!fatherId || !motherId) return
    if (!g.hasNode(`p-${fatherId}`) || !g.hasNode(`p-${motherId}`)) return
    const fNode = g.node(`p-${fatherId}`)
    const mNode = g.node(`p-${motherId}`)
    const targetY = Math.max(fNode.y, mNode.y)
    fNode.y = targetY
    mNode.y = targetY
  })

  // Post-layout rank reorder
  const yGroups = new Map()
  persons.forEach(p => {
    if (hiddenP.has(p.id) || !g.hasNode(`p-${p.id}`)) return
    const yn = Math.round(g.node(`p-${p.id}`).y)
    if (!yGroups.has(yn)) yGroups.set(yn, [])
    yGroups.get(yn).push(p.id)
  })

  yGroups.forEach(pids => {
    if (pids.length < 2) return
    pids.sort((a, b) => g.node(`p-${a}`).x - g.node(`p-${b}`).x)
    const placed = new Set()
    const ordered = []
    pids.forEach(pid => {
      if (placed.has(pid)) return
      ordered.push(pid)
      placed.add(pid)
      for (const ccid of (personCouples[pid] || [])) {
        const { fatherId, motherId } = coupleInfo[ccid]
        const sid = fatherId === pid ? motherId : fatherId
        if (!sid || placed.has(sid) || !pids.includes(sid)) continue
        if (pids.includes(sid)) { ordered.push(sid); placed.add(sid) }
      }
    })
    pids.forEach(p => { if (!placed.has(p)) ordered.push(p) })
    const origCenter = pids.reduce((s, id) => s + g.node(`p-${id}`).x, 0) / pids.length
    const startX = origCenter - (ordered.length - 1) * (PW + NODE_SEP) / 2
    ordered.forEach((pid, i) => { g.node(`p-${pid}`).x = startX + i * (PW + NODE_SEP) })
  })

  // Final spacing enforcement: guarantee no person cards overlap at the same Y level.
  // This is the last resort after dagre + Y alignment + yGroups reorder — if any two
  // nodes are still closer than PW+NODE_SEP we push them apart.
  const finalYGroups = new Map()
  persons.forEach(p => {
    if (hiddenP.has(p.id) || !g.hasNode(`p-${p.id}`)) return
    const yn = Math.round(g.node(`p-${p.id}`).y)
    if (!finalYGroups.has(yn)) finalYGroups.set(yn, [])
    finalYGroups.get(yn).push(p.id)
  })
  finalYGroups.forEach(pids => {
    if (pids.length < 2) return
    pids.sort((a, b) => g.node(`p-${a}`).x - g.node(`p-${b}`).x)
    for (let i = 1; i < pids.length; i++) {
      const prev = g.node(`p-${pids[i - 1]}`)
      const curr = g.node(`p-${pids[i]}`)
      const minX = prev.x + PW + NODE_SEP
      if (curr.x < minX) {
        const delta = minX - curr.x
        // Shift this node and all to the right of it
        for (let j = i; j < pids.length; j++) g.node(`p-${pids[j]}`).x += delta
      }
    }
  })

  // Snap CC to midpoint (runs after final spacing so X positions are settled)
  Object.entries(coupleInfo).forEach(([cid, { fatherId, motherId }]) => {
    if (!g.hasNode(cid)) return
    const cc    = g.node(cid)
    const fNode = fatherId && g.hasNode(`p-${fatherId}`) ? g.node(`p-${fatherId}`) : null
    const mNode = motherId && g.hasNode(`p-${motherId}`) ? g.node(`p-${motherId}`) : null
    if (!fNode && !mNode) return
    cc.x = fNode && mNode ? (fNode.x + mNode.x) / 2 : (fNode || mNode).x
    const parentBottomY = Math.max(
      fNode ? fNode.y + PH / 2 : 0,
      mNode ? mNode.y + PH / 2 : 0,
    )
    cc.y = parentBottomY + CC_GAP + CW / 2
  })

  const generations = computeGenerations(persons)
  const genYMap = {}
  persons.forEach(p => {
    if (hiddenP.has(p.id) || !g.hasNode(`p-${p.id}`)) return
    const n = g.node(`p-${p.id}`)
    const gen = generations[p.id] ?? 0
    if (genYMap[gen] === undefined || n.y < genYMap[gen]) genYMap[gen] = n.y
  })

  const nodes = []

  persons.forEach(p => {
    if (hiddenP.has(p.id) || !g.hasNode(`p-${p.id}`)) return
    const n = g.node(`p-${p.id}`)
    nodes.push({
      id: `p-${p.id}`, type: 'personNode',
      data: { ...p, _gen: generations[p.id] ?? 0, dimDeceased, onPersonClick, onFocusClick, isFocused: focusedId === p.id },
      position: { x: n.x - PW / 2, y: n.y - PH / 2 },
    })
  })

  Object.entries(coupleInfo).forEach(([cid, info]) => {
    if (hiddenC.has(cid) || !g.hasNode(cid) || orphanedCC.has(cid)) return
    const n = g.node(cid)
    nodes.push({
      id: cid, type: 'coupleNode',
      data: {
        ...info,
        collapsed: collapsed.has(cid),
        childCount: (coupleChildren[cid] || []).length,
        onToggle: toggleFn,
      },
      position: { x: n.x - CW / 2, y: n.y - CW / 2 },
    })
  })

  // Gen labels
  let minX = Infinity
  nodes.forEach(nd => {
    if (nd.type === 'personNode' && nd.position.x < minX) minX = nd.position.x
  })
  Object.entries(genYMap).forEach(([gen, y]) => {
    nodes.push({
      id: `gen-${gen}`, type: 'genLabel',
      data: { label: `${parseInt(gen) + 1}-avlod` },
      position: { x: minX - 128, y: y - PH / 2 + PH / 2 - 13 },
      draggable: false, selectable: false, zIndex: 10,
    })
  })

  const edges = []

  // Farzandsiz juft chiziqlari (coupleEdge o'zi ⚭ belgisini chizadi, alohida node shart emas)
  childlessCouples.forEach(({ cid, fatherId, motherId, cy }) => {
    const fN = g.node(`p-${fatherId}`), mN = g.node(`p-${motherId}`)
    if (!fN || !mN) return
    const [leftId, rightId] = fN.x <= mN.x ? [fatherId, motherId] : [motherId, fatherId]
    edges.push({
      id: `e-couple-${cid}`,
      source: `p-${leftId}`, sourceHandle: 'right',
      target: `p-${rightId}`, targetHandle: 'left',
      type: 'coupleEdge', data: { ccTopY: cy - CW / 2, childless: true }, zIndex: -1,
    })
  })

  const drawnCouple = new Set()
  Object.entries(coupleInfo).forEach(([cid, { fatherId, motherId }]) => {
    if (!g.hasNode(cid)) return
    const fVisible = fatherId && g.hasNode(`p-${fatherId}`)
    const mVisible = motherId && g.hasNode(`p-${motherId}`)
    const cc       = g.node(cid)
    const ccTopY   = cc.y - CW / 2

    if (fVisible && mVisible) {
      const key = `${Math.min(fatherId, motherId)}-${Math.max(fatherId, motherId)}`
      if (!drawnCouple.has(key)) {
        drawnCouple.add(key)
        // Always draw edge left→right based on actual X positions to avoid
        // the line crossing behind both cards when yGroups places mother on the left.
        const fX = g.node(`p-${fatherId}`).x
        const mX = g.node(`p-${motherId}`).x
        const [leftId, rightId] = fX <= mX ? [fatherId, motherId] : [motherId, fatherId]
        edges.push({
          id: `e-couple-${cid}`,
          source: `p-${leftId}`, sourceHandle: 'right',
          target: `p-${rightId}`, targetHandle: 'left',
          type: 'coupleEdge', data: { ccTopY }, zIndex: -1,
        })
      }
    } else if (fVisible) {
      edges.push({ id: `e-single-${cid}`, source: `p-${fatherId}`, target: cid,
        type: 'stemEdge', data: { color: '#818cf8' } })
    } else if (mVisible) {
      edges.push({ id: `e-single-${cid}`, source: `p-${motherId}`, target: cid,
        type: 'stemEdge', data: { color: '#f472b6' } })
    }
  })

  persons.forEach(p => {
    if (hiddenP.has(p.id)) return
    const cid = childCouple[p.id]
    if (!cid || !g.hasNode(cid) || !g.hasNode(`p-${p.id}`) || orphanedCC.has(cid)) return
    const clr = p.gender === 'male' ? '#6366f1' : '#ec4899'
    edges.push({
      id: `e-c-${p.id}`, source: cid, target: `p-${p.id}`,
      type: 'childEdge', data: { color: clr },
    })
  })

  return { nodes, edges }
}

// ── PersonDetailModal ──────────────────────────────────────────
function PersonDetailModal({ personId, onClose, navigate, onFocus, isFocused }) {
  const [detail, setDetail]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadErr, setLoadErr] = useState(false)
  const [tab, setTab]         = useState('info')
  const [guestWarn, setGuestWarn]       = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const { isDark } = useThemeStore()
  const { user }   = useAuthStore()

  useEffect(() => {
    if (!personId) return
    setLoading(true)
    setLoadErr(false)
    setDetail(null)
    setTab('info')
    getPerson(personId)
      .then(r => { setDetail(r.data); setLoading(false) })
      .catch(() => { setLoadErr(true); setLoading(false) })
  }, [personId])

  if (!personId) return null

  // Guest login modal
  if (guestWarn) return (
    <>
      {showAuthModal && <AuthModal onClose={() => { setShowAuthModal(false); setGuestWarn(false) }} />}
      <div style={{
        position:'fixed', inset:0, zIndex:9998,
        background:'rgba(2,8,23,0.72)', backdropFilter:'blur(6px)',
        display:'flex', alignItems:'center', justifyContent:'center', padding:16,
      }}>
        <div style={{
          background: isDark ? '#1e293b' : 'white',
          borderRadius:24, width:'100%', maxWidth:360,
          boxShadow:'0 20px 60px rgba(0,0,0,0.35)', overflow:'hidden',
        }}>
          <div style={{ padding:'20px 22px 16px', background:'linear-gradient(135deg,#6366f1,#7c3aed)', color:'white' }}>
            <div style={{ fontSize:28, marginBottom:6 }}>🔐</div>
            <div style={{ fontSize:16, fontWeight:900 }}>Kirish talab qilinadi</div>
            <div style={{ fontSize:12, opacity:0.82, marginTop:3 }}>
              Tahrirlash uchun tizimga kiring
            </div>
          </div>
          <div style={{ padding:'18px 22px 20px' }}>
            <div style={{ fontSize:13, color: isDark ? '#94a3b8' : '#64748b', marginBottom:16, lineHeight:1.6 }}>
              Shaxs ma'lumotlarini tahrirlash uchun <strong>login va parol</strong> bilan tizimga kirishingiz kerak.
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              <button onClick={() => setShowAuthModal(true)}
                style={{ padding:'11px', borderRadius:12, border:'none', cursor:'pointer',
                  background:'linear-gradient(135deg,#6366f1,#7c3aed)', color:'white',
                  fontSize:14, fontWeight:800, boxShadow:'0 4px 14px rgba(99,102,241,0.35)' }}>
                🔑 Tizimga kirish
              </button>
              <button onClick={() => setGuestWarn(false)}
                style={{ padding:'10px', borderRadius:12, cursor:'pointer',
                  border: isDark ? '1.5px solid #334155' : '1.5px solid #e2e8f0',
                  background:'transparent', fontSize:13, fontWeight:600,
                  color: isDark ? '#94a3b8' : '#64748b' }}>
                ← Orqaga
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )

  const male   = detail?.gender === 'male'
  const dead   = !!detail?.death_date || !!detail?.deceased || !!detail?.is_deceased
  const accent = dead ? '#6b7280' : male ? '#6366f1' : '#ec4899'
  const accentLight = dead ? '#f3f4f6' : male ? '#eef2ff' : '#fff0f8'
  const heroGrad = dead
    ? 'linear-gradient(145deg,#374151 0%,#1f2937 100%)'
    : male
      ? 'linear-gradient(145deg,#4f46e5 0%,#6366f1 60%,#7c3aed 100%)'
      : 'linear-gradient(145deg,#db2777 0%,#ec4899 60%,#be185d 100%)'

  // ── Timeline qurilishi: barcha voqealar xronologik tartibda ──
  const buildTimeline = (d) => {
    if (!d) return []
    const raw = []

    // Tug'ilgan kun
    if (d.birth_date)
      raw.push({ icon:'🐣', label:"Dunyoga keldi", date:d.birth_date, color:'#10b981', order:0 })

    // Ota-ona (tug'ilgan sanasi bilan birgalikda, shuning uchun birth_date dan biroz keyin)
    if (d.father_name || d.mother_name) {
      const p = [d.father_name, d.mother_name].filter(Boolean).join(' va ')
      raw.push({ icon:'👨‍👩‍👦', label:`Ota-onasi: ${p}`, date:d.birth_date, color:'#6366f1', order:1, sub:true, ageAtEvent:null, hideYear:true })
    }

    // Reminder'lardan voqealar (birthday va death ni o'tkazib yuboramiz — allaqachon qo'shilgan)
    ;(d.reminders || []).forEach(r => {
      if (r.type === 'birthday' || r.type === 'death') return  // takror
      const ageAtEvent = (d.birth_date && r.date)
        ? calcAge(d.birth_date, r.date)
        : null
      raw.push({
        icon:    r.icon,
        label:   r.note
          ? `${r.type_display}: ${r.note}`
          : r.type_display,
        date:    r.date,
        color:   r.color || '#a855f7',
        order:   2,
        sub:     false,
        reminderType: r.type,
        ageAtEvent,
      })
    })

    // Farzandlar — ota/onaning o'sha paytdagi yoshini hisoblaymiz
    ;(d.children || []).forEach(c => {
      const ageAtEvent = (d.birth_date && c.birth_date)
        ? calcAge(d.birth_date, c.birth_date)
        : null
      raw.push({
        icon:  c.gender === 'male' ? '👦' : '👧',
        label: `Farzand: ${c.full_name}`,
        date:  c.birth_date,
        color: '#f59e0b',
        order: 3,
        sub:   true,
        ageAtEvent,
      })
    })

    // Ko'p oila: Family modeli orqali
    ;(d.families || []).forEach((fam, fi) => {
      const weddingR = (d.reminders || []).find(r => r.type === 'wedding')
      const label = `${fi === 0 ? "Turmush o'rtog'i" : `${fi + 1}-nikoh`}: ${fam.partner_name}`
      const ageAtEvent = (d.birth_date && fam.wedding_date)
        ? calcAge(d.birth_date, fam.wedding_date)
        : null
      if (fam.wedding_date) {
        // Wedding sana bor — reminder bilan takror bo'lmasin (1-oila uchun)
        if (fi > 0 || !weddingR) {
          raw.push({ icon:'💍', label, date: fam.wedding_date, color:'#f43f5e', order:4, ageAtEvent })
        }
      } else if (!weddingR || fi > 0) {
        raw.push({ icon:'💍', label, date: null, color:'#f43f5e', order:4 })
      }
      // Ajralish sanasi
      if (fam.divorce_date) {
        const ageDiv = (d.birth_date && fam.divorce_date) ? calcAge(d.birth_date, fam.divorce_date) : null
        raw.push({ icon:'💔', label:`Ajralish (${fam.partner_name})`, date: fam.divorce_date, color:'#94a3b8', order:4, ageAtEvent: ageDiv })
      }
    })

    // Vafot
    if (d.death_date)
      raw.push({ icon:'🌿', label:'Vafot etdi', date:d.death_date, color:'#6b7280', order:99 })

    // Xronologik saralash: sana bor → sana bo'yicha; sana yo'q → order bo'yicha
    const toMs = (dateStr) => dateStr ? new Date(dateStr + 'T00:00:00').getTime() : null

    raw.sort((a, b) => {
      const da = toMs(a.date)
      const db = toMs(b.date)
      if (da && db) return da !== db ? da - db : a.order - b.order
      if (da && !db) return -1   // sanali avvalroq (sana yo'qlardan oldin)
      if (!da && db) return 1
      return a.order - b.order
    })

    return raw
  }

  const timelineEvents = buildTimeline(detail)

  return (
    <div
      style={{ position:'fixed', inset:0, zIndex:9999,
        display:'flex', alignItems:'center', justifyContent:'center',
        background:'rgba(2,8,23,0.65)', backdropFilter:'blur(8px)', padding:'16px' }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: isDark ? '#1e293b' : '#fff', borderRadius:28, width:'100%', maxWidth:480,
          maxHeight:'92vh', overflow:'hidden', display:'flex', flexDirection:'column',
          boxShadow:'0 32px 96px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.08)',
          animation:'modalIn 0.28s cubic-bezier(0.34,1.56,0.64,1)' }}
      >
        {/* ── Hero header ── */}
        <div style={{ background: heroGrad, padding:'0 0 0', flexShrink:0, position:'relative', overflow:'hidden' }}>
          {/* Deko doiralar */}
          <div style={{ position:'absolute', top:-50, right:-50, width:160, height:160, borderRadius:'50%', background:'rgba(255,255,255,0.07)', pointerEvents:'none' }} />
          <div style={{ position:'absolute', bottom:-40, left:-30, width:130, height:130, borderRadius:'50%', background:'rgba(255,255,255,0.05)', pointerEvents:'none' }} />

          {/* Close */}
          <div style={{ display:'flex', justifyContent:'flex-end', padding:'14px 16px 0' }}>
            <button onClick={onClose} style={{
              width:30, height:30, borderRadius:'50%', background:'rgba(255,255,255,0.2)',
              border:'none', cursor:'pointer', fontSize:14, color:'white',
              display:'flex', alignItems:'center', justifyContent:'center',
              transition:'background 0.15s', backdropFilter:'blur(4px)',
            }}
            onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.35)'}
            onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.2)'}>
              ✕
            </button>
          </div>

          {/* Photo + info row */}
          <div style={{ display:'flex', gap:16, alignItems:'flex-end', padding:'8px 20px 0', position:'relative' }}>
            {/* Photo */}
            <div style={{
              width:90, height:90, borderRadius:22, overflow:'hidden', flexShrink:0,
              border:'3.5px solid rgba(255,255,255,0.5)',
              background:'rgba(255,255,255,0.18)',
              display:'flex', alignItems:'center', justifyContent:'center', fontSize:44,
              boxShadow:'0 8px 24px rgba(0,0,0,0.25)',
            }}>
              {loading
                ? <span style={{ fontSize:28, opacity:0.6 }}>⏳</span>
                : detail?.photo_url
                  ? <img src={detail.photo_url} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" />
                  : <span>{male ? '👨' : '👩'}</span>}
            </div>

            {/* Name / badges */}
            <div style={{ flex:1, minWidth:0, paddingBottom:4, color:'white' }}>
              {loading ? (
                <div style={{ opacity:0.5, fontSize:13 }}>Yuklanmoqda...</div>
              ) : (
                <>
                  <div style={{ fontSize:18, fontWeight:900, lineHeight:1.2, marginBottom:6,
                    textShadow:'0 2px 8px rgba(0,0,0,0.2)' }}>
                    {detail.full_name}
                  </div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                    <span style={{ padding:'2px 10px', borderRadius:20, fontSize:10.5, fontWeight:700,
                      background:'rgba(255,255,255,0.22)', backdropFilter:'blur(4px)' }}>
                      {dead ? '🌿 Vafot etgan' : male ? '👨 Erkak' : '👩 Ayol'}
                    </span>
                    {!dead && detail.age != null && (
                      <span style={{ padding:'2px 10px', borderRadius:20, fontSize:10.5, fontWeight:700,
                        background:'rgba(255,255,255,0.18)' }}>
                        🎂 {detail.age} yosh
                      </span>
                    )}
                    {dead && detail.birth_date && detail.death_date && (
                      <span style={{ padding:'2px 10px', borderRadius:20, fontSize:10.5, fontWeight:700,
                        background:'rgba(255,255,255,0.18)' }}>
                        {calcAge(detail.birth_date, detail.death_date)} yosh yashadi
                      </span>
                    )}
                    {detail.child_number && (
                      <span style={{ padding:'2px 10px', borderRadius:20, fontSize:10.5, fontWeight:700,
                        background:'rgba(255,165,0,0.4)' }}>
                        🔢 {detail.child_number}-farzand
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Dates row */}
          {!loading && detail?.birth_date && (
            <div style={{ display:'flex', gap:16, padding:'10px 20px 8px', color:'rgba(255,255,255,0.85)', fontSize:11.5 }}>
              <span>📅 {fmtDate(detail.birth_date)}{dead && detail.death_date ? ` — ${fmtDate(detail.death_date)}` : ''}</span>
              {detail.phone && <span>📞 {detail.phone}</span>}
            </div>
          )}

          {/* Tabs */}
          {!loading && !loadErr && (
            <div style={{ display:'flex', padding:'0 8px', marginTop:4 }}>
              {[['info','📋 Ma\'lumot'],['timeline','📅 Tarix']].map(([key, lbl]) => (
                <button key={key} onClick={() => setTab(key)} style={{
                  padding:'9px 16px', fontSize:12, fontWeight:700, cursor:'pointer',
                  border:'none', background:'transparent', color: tab===key ? 'white' : 'rgba(255,255,255,0.55)',
                  borderBottom: tab===key ? '2.5px solid rgba(255,255,255,0.9)' : '2.5px solid transparent',
                  transition:'all 0.15s', marginBottom:-1,
                }}>{lbl}</button>
              ))}
            </div>
          )}
        </div>

        {/* ── Body ── */}
        <div style={{ flex:1, overflowY:'auto', padding:'12px 14px', background: isDark ? '#0f172a' : 'linear-gradient(160deg,#f0f4ff 0%,#fdf4ff 50%,#fff0f8 100%)' }}>
          {loading ? (
            <div style={{ textAlign:'center', padding:'40px 0', color:'#94a3b8' }}>
              <div style={{ fontSize:40, marginBottom:8, animation:'pulse 1.5s infinite' }}>🌳</div>
              <div style={{ fontSize:13 }}>Yuklanmoqda...</div>
            </div>
          ) : loadErr ? (
            <div style={{ textAlign:'center', padding:'40px 0', color:'#ef4444' }}>
              <div style={{ fontSize:40, marginBottom:8 }}>⚠️</div>
              <div style={{ fontSize:13, fontWeight:700 }}>Ma'lumot yuklanmadi</div>
              <div style={{ fontSize:11, color:'#94a3b8', marginTop:4 }}>Server bilan aloqada xato yuz berdi</div>
              <button onClick={() => { setLoadErr(false); setLoading(true); getPerson(personId).then(r=>{setDetail(r.data);setLoading(false)}).catch(()=>setLoadErr(true)) }}
                style={{ marginTop:12, padding:'6px 16px', borderRadius:10, border:'none', cursor:'pointer',
                  background:'#fef2f2', color:'#dc2626', fontSize:11, fontWeight:700 }}>
                🔄 Qayta urinish
              </button>
            </div>
          ) : tab === 'info' ? (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>

              {/* ── Ota-ona: 2-kolonnali grid ── */}
              {(detail.father_name || detail.mother_name) && (
                <div style={{ background: isDark ? '#1e293b' : 'white', borderRadius:16, padding:'10px 12px',
                  border: isDark ? '1px solid #334155' : '1px solid rgba(99,102,241,0.12)',
                  boxShadow:'0 2px 12px rgba(99,102,241,0.06)' }}>
                  <div style={{ fontSize:9.5, fontWeight:800, color:'#6366f1', letterSpacing:'0.08em',
                    marginBottom:8, display:'flex', alignItems:'center', gap:5 }}>
                    <span>👨‍👩‍👦</span> OTA-ONASI
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns: detail.father_name && detail.mother_name ? '1fr 1fr' : '1fr', gap:6 }}>
                    {detail.father_name && (
                      <div onClick={detail.father ? () => { onClose(); navigate(`/persons/${detail.father}`) } : undefined}
                        style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:5,
                          padding:'8px 6px', borderRadius:12, cursor: detail.father ? 'pointer' : 'default',
                          background: isDark ? 'linear-gradient(135deg,#1e1b4b,#1e293b)' : 'linear-gradient(135deg,#eef2ff,#f5f3ff)',
                          border:'1.5px solid #c7d2fe', transition:'all 0.15s' }}
                        onMouseEnter={e => detail.father && (e.currentTarget.style.boxShadow='0 3px 10px rgba(99,102,241,0.2)')}
                        onMouseLeave={e => (e.currentTarget.style.boxShadow='')}>
                        <div style={{ width:44, height:44, borderRadius:14, overflow:'hidden', flexShrink:0,
                          background:'#ddd6fe', border:'2px solid #a5b4fc',
                          display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>
                          {detail.father_photo
                            ? <img src={detail.father_photo} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" />
                            : '👨'}
                        </div>
                        <div style={{ textAlign:'center' }}>
                          <div style={{ fontSize:8.5, fontWeight:700, color:'#6366f1', marginBottom:1 }}>OTASI</div>
                          <div style={{ fontSize:10.5, fontWeight:700, color: isDark ? '#f1f5f9' : '#0f172a', lineHeight:1.2,
                            maxWidth:110, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                            {detail.father_name}
                          </div>
                        </div>
                      </div>
                    )}
                    {detail.mother_name && (
                      <div onClick={detail.mother ? () => { onClose(); navigate(`/persons/${detail.mother}`) } : undefined}
                        style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:5,
                          padding:'8px 6px', borderRadius:12, cursor: detail.mother ? 'pointer' : 'default',
                          background: isDark ? 'linear-gradient(135deg,#2d1b2e,#1e293b)' : 'linear-gradient(135deg,#fff0f8,#fdf4ff)',
                          border:'1.5px solid #f9a8d4', transition:'all 0.15s' }}
                        onMouseEnter={e => detail.mother && (e.currentTarget.style.boxShadow='0 3px 10px rgba(236,72,153,0.2)')}
                        onMouseLeave={e => (e.currentTarget.style.boxShadow='')}>
                        <div style={{ width:44, height:44, borderRadius:14, overflow:'hidden', flexShrink:0,
                          background:'#fbcfe8', border:'2px solid #f9a8d4',
                          display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>
                          {detail.mother_photo
                            ? <img src={detail.mother_photo} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" />
                            : '👩'}
                        </div>
                        <div style={{ textAlign:'center' }}>
                          <div style={{ fontSize:8.5, fontWeight:700, color:'#ec4899', marginBottom:1 }}>ONASI</div>
                          <div style={{ fontSize:10.5, fontWeight:700, color: isDark ? '#f1f5f9' : '#0f172a', lineHeight:1.2,
                            maxWidth:110, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                            {detail.mother_name}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── Oila(lar) ── */}
              {(detail.families || []).length > 0 && (
                <div style={{ background: isDark ? '#1e293b' : 'white', borderRadius:16, padding:'10px 12px',
                  border: isDark ? '1px solid #334155' : '1px solid rgba(244,63,94,0.15)',
                  boxShadow:'0 2px 12px rgba(244,63,94,0.05)' }}>
                  <div style={{ fontSize:9.5, fontWeight:800, color:'#f43f5e',
                    letterSpacing:'0.08em', marginBottom:8, display:'flex', alignItems:'center', gap:5 }}>
                    <span>💍</span>
                    {detail.families.length > 1 ? `OILALARI (${detail.families.length} TA)` : "TURMUSH O'RTOG'I"}
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    {(detail.families || []).map((fam, fi) => {
                      const pGender = fam.partner_gender
                      const clr     = pGender === 'male' ? '#6366f1' : '#ec4899'
                      const bg      = isDark
                        ? (pGender === 'male' ? 'linear-gradient(135deg,#1e1b4b,#1e293b)' : 'linear-gradient(135deg,#2d1b2e,#1e293b)')
                        : (pGender === 'male' ? 'linear-gradient(135deg,#eef2ff,#f5f3ff)' : 'linear-gradient(135deg,#fff0f8,#fdf4ff)')
                      const bdr     = pGender === 'male' ? '#c7d2fe' : '#f9a8d4'
                      return (
                        <div key={fam.id}
                          onClick={() => { onClose(); navigate(`/persons/${fam.partner_id}`) }}
                          style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px',
                            borderRadius:12, cursor:'pointer', background:bg,
                            border:`1.5px solid ${bdr}`,
                            opacity: fam.is_divorced ? 0.65 : 1,
                            transition:'all 0.15s' }}
                          onMouseEnter={e => (e.currentTarget.style.boxShadow=`0 3px 10px ${clr}30`)}
                          onMouseLeave={e => (e.currentTarget.style.boxShadow='')}>
                          <div style={{ width:40, height:40, borderRadius:12, overflow:'hidden', flexShrink:0,
                            background: pGender==='male' ? '#ddd6fe' : '#fbcfe8',
                            border:`2px solid ${bdr}`,
                            display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>
                            {fam.partner_photo
                              ? <img src={fam.partner_photo} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" />
                              : <span>{pGender==='male' ? '👨' : '👩'}</span>}
                          </div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                              <div style={{ fontSize:8.5, fontWeight:800, color:clr }}>
                                {detail.families.length > 1 ? `${fi+1}-NIKOH` : 'JUFT'}
                              </div>
                              {fam.is_divorced && (
                                <span style={{ fontSize:8, background:'#fee2e2', color:'#dc2626',
                                  padding:'1px 5px', borderRadius:5, fontWeight:700 }}>Ajralgan</span>
                              )}
                            </div>
                            <div style={{ fontSize:11.5, fontWeight:700, color: isDark ? '#f1f5f9' : '#0f172a', lineHeight:1.2,
                              overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                              {fam.partner_name}
                            </div>
                            {fam.wedding_date && (
                              <div style={{ fontSize:9, color: isDark ? '#64748b' : '#94a3b8', marginTop:1 }}>
                                💍 {globalFmtDate(fam.wedding_date)}
                                {fam.divorce_date && ` — 💔 ${globalFmtDate(fam.divorce_date)}`}
                              </div>
                            )}
                          </div>
                          <svg width="12" height="12" fill="none" stroke={clr} viewBox="0 0 24 24" style={{ opacity:0.4, flexShrink:0 }}>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* ── Farzandlar ── */}
              {detail.children?.length > 0 && (
                <div style={{ background: isDark ? '#1e293b' : 'white', borderRadius:16, padding:'10px 12px',
                  border: isDark ? '1px solid #334155' : '1px solid rgba(245,158,11,0.15)',
                  boxShadow:'0 2px 12px rgba(245,158,11,0.05)' }}>
                  <div style={{ fontSize:9.5, fontWeight:800, color:'#d97706', letterSpacing:'0.08em',
                    marginBottom:8, display:'flex', alignItems:'center', gap:5 }}>
                    <span>👶</span> FARZANDLARI ({detail.children.length} TA)
                  </div>
                  {/* Scroll only when more than 4 children */}
                  <div style={{ display:'flex', flexDirection:'column', gap:5,
                    maxHeight: detail.children.length > 4 ? 210 : 'none',
                    overflowY: detail.children.length > 4 ? 'auto' : 'visible' }}>
                    {detail.children.map((c) => (
                      <div key={c.id}
                        onClick={() => { onClose(); navigate(`/persons/${c.id}`) }}
                        style={{
                          display:'flex', alignItems:'center', gap:8,
                          padding:'7px 10px', borderRadius:11, cursor:'pointer',
                          background: isDark
                            ? (c.gender==='male' ? 'linear-gradient(135deg,#1e1b4b,#1e293b)' : 'linear-gradient(135deg,#2d1b2e,#1e293b)')
                            : (c.gender==='male' ? 'linear-gradient(135deg,#eef2ff,#f5f3ff)' : 'linear-gradient(135deg,#fff0f8,#fdf4ff)'),
                          border:`1.5px solid ${c.gender==='male' ? '#c7d2fe' : '#f9a8d4'}`,
                          transition:'all 0.15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.transform='translateX(2px)'; e.currentTarget.style.boxShadow=`0 3px 8px ${c.gender==='male'?'rgba(99,102,241,0.15)':'rgba(236,72,153,0.15)'}` }}
                        onMouseLeave={e => { e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow='' }}
                      >
                        <div style={{
                          minWidth:26, height:26, borderRadius:8, flexShrink:0,
                          background: c.gender==='male' ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : 'linear-gradient(135deg,#ec4899,#db2777)',
                          display:'flex', alignItems:'center', justifyContent:'center',
                          color:'white', fontSize:10, fontWeight:900,
                        }}>
                          {c.child_number || '—'}
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:11.5, fontWeight:700, color: isDark ? '#f1f5f9' : '#0f172a', lineHeight:1.2,
                            overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                            {c.full_name}
                          </div>
                          {c.birth_date && (
                            <div style={{ fontSize:9.5, color: isDark ? '#64748b' : '#94a3b8', marginTop:1 }}>
                              {fmtDate(c.birth_date)}{c.death_date ? ` — ${fmtDate(c.death_date)}` : ''}
                            </div>
                          )}
                        </div>
                        <div style={{
                          width:32, height:32, borderRadius:10, overflow:'hidden', flexShrink:0,
                          background: c.gender==='male' ? '#ddd6fe' : '#fbcfe8',
                          border:`2px solid ${c.gender==='male' ? '#a5b4fc' : '#f9a8d4'}`,
                          display:'flex', alignItems:'center', justifyContent:'center', fontSize:16,
                        }}>
                          {c.photo_url
                            ? <img src={c.photo_url} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" />
                            : <span>{c.gender==='male' ? '👦' : '👧'}</span>}
                        </div>
                        <svg width="12" height="12" fill="none" stroke={c.gender==='male'?'#6366f1':'#ec4899'} viewBox="0 0 24 24" style={{ opacity:0.4, flexShrink:0 }}>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Bo'sh holat */}
              {!detail.father_name && !detail.mother_name && !detail.families?.length && !detail.children?.length && (
                <div style={{ textAlign:'center', padding:'24px 0', color:'#94a3b8' }}>
                  <div style={{ fontSize:36, marginBottom:8 }}>🌱</div>
                  <div style={{ fontSize:13, fontWeight:600 }}>Oila ma'lumotlari yo'q</div>
                  <div style={{ fontSize:11, marginTop:4 }}>Tahrirlash orqali qo'shing</div>
                </div>
              )}
            </div>
          ) : (
            /* ── Timeline tab ── */
            <div>
              {timelineEvents.length === 0 ? (
                <div style={{ textAlign:'center', padding:'28px 0', color:'#94a3b8' }}>
                  <div style={{ fontSize:36, marginBottom:8 }}>📅</div>
                  <div style={{ fontSize:13, fontWeight:600 }}>Voqealar yo'q</div>
                  <div style={{ fontSize:11, marginTop:4 }}>
                    Eslatmalar qo'shish uchun admin panelga o'ting
                  </div>
                </div>
              ) : (
                <div style={{ position:'relative', paddingLeft:36, paddingBottom:8 }}>
                  {/* Chiziq */}
                  <div style={{
                    position:'absolute', left:13, top:4, bottom:4, width:2,
                    background:`linear-gradient(to bottom,${accent}cc,${accent}22)`,
                    borderRadius:2,
                  }} />

                  {timelineEvents.map((ev, i) => {
                    const year = ev.date ? new Date(ev.date + 'T00:00:00').getFullYear() : null
                    const isMain = !ev.sub
                    return (
                      <div key={i} style={{ display:'flex', gap:10, marginBottom: isMain ? 12 : 8,
                        position:'relative', alignItems:'flex-start' }}>
                        {/* Dot */}
                        <div style={{
                          position:'absolute', left:-28, top: isMain ? 2 : 3,
                          width: isMain ? 22 : 16, height: isMain ? 22 : 16,
                          borderRadius:'50%',
                          background: isMain ? ev.color : '#f8fafc',
                          border:`2.5px solid ${ev.color}`,
                          display:'flex', alignItems:'center', justifyContent:'center',
                          fontSize: isMain ? 10 : 8,
                          boxShadow: isMain ? `0 2px 10px ${ev.color}60` : 'none',
                          color:'white', flexShrink:0,
                          marginLeft: isMain ? 0 : 3,
                        }}>
                          {isMain ? ev.icon : ''}
                        </div>

                        {/* Card */}
                        <div style={{
                          flex:1,
                          background: isMain ? (isDark ? '#1e293b' : 'white') : 'transparent',
                          borderRadius: isMain ? 13 : 8,
                          padding: isMain ? '9px 13px' : '4px 10px',
                          border: isMain ? `1px solid ${ev.color}30` : 'none',
                          boxShadow: isMain ? `0 2px 10px ${ev.color}15` : 'none',
                        }}>
                          {/* Yil badge — faqat sanali eventlarda */}
                          {year && isMain && (
                            <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:4, flexWrap:'wrap' }}>
                              <div style={{ display:'inline-flex', alignItems:'center', gap:4,
                                padding:'1px 7px', borderRadius:8,
                                background:`${ev.color}15`, color:ev.color,
                                fontSize:10, fontWeight:800 }}>
                                📅 {year}
                                {ev.date && ` · ${fmtDate(ev.date)}`}
                              </div>
                              {ev.ageAtEvent != null && ev.ageAtEvent >= 0 && (
                                <div style={{ display:'inline-flex', alignItems:'center',
                                  padding:'1px 8px', borderRadius:8,
                                  background:`${ev.color}22`, color:ev.color,
                                  fontSize:10, fontWeight:900 }}>
                                  {ev.ageAtEvent} yoshida
                                </div>
                              )}
                            </div>
                          )}

                          <div style={{
                            fontSize: isMain ? 12.5 : 11.5,
                            fontWeight: isMain ? 700 : 500,
                            color: isMain ? (isDark ? '#f1f5f9' : '#0f172a') : (isDark ? '#94a3b8' : '#64748b'),
                            lineHeight:1.35,
                          }}>
                            {ev.label}
                          </div>

                          {/* Sub event date */}
                          {ev.sub && ev.date && (
                            <div style={{ display:'flex', alignItems:'center', gap:5, marginTop:1, flexWrap:'wrap' }}>
                              <span style={{ fontSize:10, color:'#94a3b8' }}>{fmtDate(ev.date)}</span>
                              {ev.ageAtEvent != null && ev.ageAtEvent >= 0 && (
                                <span style={{ fontSize:9, fontWeight:800, color:ev.color, background:`${ev.color}15`, padding:'1px 6px', borderRadius:7 }}>
                                  {ev.ageAtEvent} yoshida
                                </span>
                              )}
                              {ev.ageAtEvent == null && !ev.hideYear && year && (
                                <span style={{ fontSize:9, color:'#94a3b8', fontWeight:700 }}>{year}</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Eslatma qo'shish havolasi */}
              <div style={{ margin:'8px 0 4px', padding:'10px 14px', borderRadius:12,
                background: isDark ? '#0f2a1a' : '#f0fdf4',
                border: isDark ? '1px dashed #166534' : '1px dashed #86efac', textAlign:'center' }}>
                <div style={{ fontSize:11, color: isDark ? '#4ade80' : '#15803d', fontWeight:600 }}>
                  ➕ Yangi voqea qo'shish uchun Admin paneli → Eslatmalar bo'limiga o'ting
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        {!loading && !loadErr && (
          <div style={{ padding:'10px 16px 14px', borderTop: isDark ? '1px solid #334155' : '1px solid #e2e8f0',
            background: isDark ? '#1e293b' : 'white', display:'flex', flexDirection:'column', gap:8, flexShrink:0 }}>

            {/* Focus tugmasi — katta va ko'zga ko'rinarli */}
            {onFocus && (
              <button
                onClick={() => { onFocus(personId); onClose() }}
                style={{
                  width:'100%', padding:'10px', borderRadius:13, border:'none', cursor:'pointer',
                  fontSize:13, fontWeight:800, transition:'all 0.18s',
                  background: isFocused
                    ? 'linear-gradient(135deg,#f59e0b,#d97706)'
                    : (isDark ? 'rgba(245,158,11,0.12)' : '#fffbeb'),
                  color: isFocused ? 'white' : '#92400e',
                  border: `1.5px solid ${isFocused ? '#f59e0b' : '#fde68a'}`,
                  boxShadow: isFocused ? '0 4px 14px rgba(245,158,11,0.4)' : 'none',
                }}>
                🎯 {isFocused ? "Focus rejimini o'chirish" : 'Shu shaxsga fokuslanish'}
              </button>
            )}

            <div style={{ display:'flex', gap:8 }}>
              <button
                onClick={() => { onClose(); navigate(`/persons/${personId}`) }}
                style={{ flex:1, padding:'10px', borderRadius:13, border:'none', cursor:'pointer',
                  background:accentLight, color:accent, fontSize:12.5, fontWeight:700, transition:'all 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.opacity='0.8'}
                onMouseLeave={e => e.currentTarget.style.opacity='1'}>
                👤 Profil
              </button>
              <button
                onClick={() => {
                  if (!user) { setGuestWarn(true); return }
                  onClose(); navigate(`/persons/${personId}/edit`)
                }}
                style={{
                  flex:2, padding:'10px', borderRadius:13, border:'none', cursor:'pointer',
                  background:`linear-gradient(135deg,${accent},${dead?'#4b5563':male?'#7c3aed':'#db2777'})`,
                  color:'white', fontSize:12.5, fontWeight:700,
                  boxShadow:`0 4px 12px ${accent}50`, transition:'all 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.opacity='0.9'}
                onMouseLeave={e => e.currentTarget.style.opacity='1'}>
                ✏️ Tahrirlash
              </button>
              <button onClick={onClose} style={{
                padding:'10px 14px', borderRadius:13,
                border: isDark ? '1.5px solid #334155' : '1.5px solid #e2e8f0',
                background: isDark ? '#0f172a' : 'white',
                cursor:'pointer', fontSize:12.5, fontWeight:600,
                color: isDark ? '#94a3b8' : '#94a3b8',
              }}>✕</button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
      `}</style>
    </div>
  )
}

// ── RelRow: ota-ona / juft satri ──────────────────────────────
function RelRow({ label, name, gender, photo, onClick }) {
  const male = gender === 'male'
  const accent = male ? '#6366f1' : '#ec4899'
  const { isDark } = useThemeStore()
  return (
    <div onClick={onClick || undefined} style={{
      display:'flex', alignItems:'center', gap:10, padding:'8px 12px',
      borderRadius:13, cursor: onClick ? 'pointer' : 'default',
      background: male
        ? (isDark ? 'linear-gradient(135deg,#1e1b4b,#1e293b)' : 'linear-gradient(135deg,#eef2ff,#f5f3ff)')
        : (isDark ? 'linear-gradient(135deg,#2d1b2e,#1e293b)' : 'linear-gradient(135deg,#fff0f8,#fdf4ff)'),
      border:`1.5px solid ${male ? '#c7d2fe' : '#f9a8d4'}`,
      transition:'all 0.15s',
    }}
    onMouseEnter={e => { if (onClick) e.currentTarget.style.transform='translateX(3px)' }}
    onMouseLeave={e => { e.currentTarget.style.transform='' }}>
      {/* Avatar: rasm yoki ikonka */}
      <div style={{
        width:40, height:40, borderRadius:12, overflow:'hidden', flexShrink:0,
        background: male ? '#ddd6fe' : '#fbcfe8',
        border:`2px solid ${male ? '#a5b4fc' : '#f9a8d4'}`,
        display:'flex', alignItems:'center', justifyContent:'center', fontSize:20,
        boxShadow:`0 2px 8px ${accent}25`,
      }}>
        {photo
          ? <img src={photo} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" />
          : <span>{male ? '👨' : '👩'}</span>}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:9.5, fontWeight:700, color:accent,
          textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:1 }}>{label}</div>
        <div style={{ fontSize:12.5, fontWeight:700, color: isDark ? '#f1f5f9' : '#0f172a', lineHeight:1.2 }}>{name}</div>
      </div>
      {onClick && (
        <svg width="14" height="14" fill="none" stroke={accent} viewBox="0 0 24 24" style={{ opacity:0.5, flexShrink:0 }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
        </svg>
      )}
    </div>
  )
}

// ── ModalSection ──────────────────────────────────────────────
function ModalSection({ icon, title, accent, children }) {
  const { isDark } = useThemeStore()
  return (
    <div style={{ background: isDark ? '#1e293b' : 'white', borderRadius:16, overflow:'hidden',
      border: isDark ? '1px solid #334155' : '1px solid #e2e8f0',
      boxShadow:'0 1px 6px rgba(0,0,0,0.05)' }}>
      <div style={{ padding:'8px 12px 6px', display:'flex', alignItems:'center', gap:6,
        borderBottom: isDark ? '1px solid #334155' : '1px solid #f1f5f9' }}>
        <span style={{ fontSize:13 }}>{icon}</span>
        <span style={{ fontSize:10, fontWeight:800, color:'#94a3b8',
          textTransform:'uppercase', letterSpacing:'0.07em' }}>{title}</span>
      </div>
      <div style={{ padding:'10px 12px' }}>{children}</div>
    </div>
  )
}

function InfoSection({ icon, title, children }) {
  const { isDark } = useThemeStore()
  return (
    <div style={{ background: isDark ? '#0f172a' : '#f8fafc', borderRadius:14, padding:'12px 14px',
      border: isDark ? '1px solid #334155' : '1px solid #f1f5f9' }}>
      <div style={{ fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10 }}>
        {icon} {title}
      </div>
      {children}
    </div>
  )
}

function InfoRow({ label, value, color }) {
  const { isDark } = useThemeStore()
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'4px 0' }}>
      <span style={{ fontSize:12, color: isDark ? '#94a3b8' : '#64748b' }}>{label}</span>
      <span style={{ fontSize:12, fontWeight:700, color: color || (isDark ? '#f1f5f9' : '#0f172a') }}>{value}</span>
    </div>
  )
}

// ── MobileListView ─────────────────────────────────────────────
function MobileListView({ rawPersons, onPersonClick, toolbarSearch = '', user }) {
  const [q, setQ]       = useState('')
  const { isDark }      = useThemeStore()
  const navigate        = useNavigate()

  // Toolbar qidiruvini ham, ichki qidiruvni ham hisobga olamiz
  const activeQ = (toolbarSearch || q).trim()

  const genMap = rawPersons.length ? computeGenerations(rawPersons) : {}

  const filtered = rawPersons.filter(p => {
    if (!activeQ) return true
    const lq = activeQ.toLowerCase()
    return (
      p.full_name?.toLowerCase().includes(lq) ||
      p.birth_place?.toLowerCase().includes(lq)
    )
  })

  // Avlodlar bo'yicha guruhlash
  const byGen = {}
  filtered.forEach(p => {
    const g = (genMap[p.id] ?? 0) + 1
    if (!byGen[g]) byGen[g] = []
    byGen[g].push(p)
  })
  const gens = Object.keys(byGen).map(Number).sort((a, b) => a - b)

  const textPrimary   = isDark ? '#f1f5f9' : '#0f172a'
  const textSecondary = isDark ? '#94a3b8' : '#64748b'
  const cardBg        = isDark ? '#1e293b' : 'white'
  const border        = isDark ? '#334155' : '#e2e8f0'

  return (
    <div style={{ flex:1, overflowY:'auto', padding:'10px 12px',
      background: isDark ? '#0f172a' : '#f8fafc', display:'flex', flexDirection:'column', gap:10 }}>

      {/* Result count — faqat qidiruv faol bo'lganda */}
      {activeQ && (
        <div style={{ fontSize:11.5, color:textSecondary, fontWeight:600 }}>
          🔍 "{activeQ}" bo'yicha {filtered.length} ta natija
        </div>
      )}

      {/* Groups */}
      {gens.length === 0 ? (
        <div style={{ textAlign:'center', padding:'40px 0', color:textSecondary }}>
          <div style={{ fontSize:40, marginBottom:8 }}>🔍</div>
          <div style={{ fontSize:14, fontWeight:600 }}>Natija topilmadi</div>
        </div>
      ) : gens.map(gen => (
        <div key={gen}>
          {/* Generation header */}
          {!q && (
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
              <div style={{ height:1, flex:1, background:border }}/>
              <div style={{ padding:'3px 12px', borderRadius:20, fontSize:11, fontWeight:800,
                background:'linear-gradient(135deg,#6366f1,#7c3aed)', color:'white',
                boxShadow:'0 2px 8px rgba(99,102,241,.3)', flexShrink:0 }}>
                {gen}-avlod · {byGen[gen].length} kishi
              </div>
              <div style={{ height:1, flex:1, background:border }}/>
            </div>
          )}

          {/* Person cards */}
          <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
            {byGen[gen].sort((a,b) => (a.child_number||99)-(b.child_number||99)).map(p => {
              const male = p.gender === 'male'
              const dead = !!p.death_date || !!p.deceased || !!p.is_deceased
              const accent = dead ? '#6b7280' : male ? '#6366f1' : '#ec4899'
              const age = p.birth_date
                ? Math.floor((new Date() - new Date(p.birth_date + 'T00:00:00')) / (365.25*86400000))
                : null

              return (
                <div key={p.id}
                  onClick={() => onPersonClick(p.id)}
                  style={{ display:'flex', alignItems:'center', gap:11,
                    padding:'10px 12px', borderRadius:14, cursor:'pointer',
                    background:cardBg,
                    border:`1.5px solid ${dead ? border : accent + '30'}`,
                    boxShadow: dead ? 'none' : `0 2px 10px ${accent}12`,
                    opacity: dead ? 0.72 : 1,
                    transition:'all .15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform='translateX(3px)'; e.currentTarget.style.boxShadow=`0 4px 16px ${accent}22` }}
                  onMouseLeave={e => { e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow=dead?'none':`0 2px 10px ${accent}12` }}>

                  {/* Avatar */}
                  <div style={{ width:44, height:44, borderRadius:13, flexShrink:0, overflow:'hidden',
                    border:`2px solid ${accent}`, background: male ? '#eef2ff' : '#fff0f8',
                    display:'flex', alignItems:'center', justifyContent:'center', fontSize:22,
                    position:'relative' }}>
                    {p.photo_url
                      ? <img src={p.photo_url} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt=""/>
                      : <span>{male ? '👨' : '👩'}</span>}
                    {dead && (
                      <div style={{ position:'absolute', top:-4, right:-4, width:16, height:16,
                        borderRadius:'50%', background:'#6b7280', border:'2px solid white',
                        display:'flex', alignItems:'center', justifyContent:'center',
                        fontSize:7, color:'white', fontWeight:900 }}>🌿</div>
                    )}
                    {p.child_number && (
                      <div style={{ position:'absolute', bottom:-4, left:-4, width:16, height:16,
                        borderRadius:'50%', background:'#f97316', border:'2px solid white',
                        display:'flex', alignItems:'center', justifyContent:'center',
                        fontSize:7, color:'white', fontWeight:900 }}>{p.child_number}</div>
                    )}
                  </div>

                  {/* Info */}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13.5, fontWeight:800, color:textPrimary,
                      lineHeight:1.2, marginBottom:2,
                      overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {p.full_name}
                    </div>
                    <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
                      {p.birth_date && (
                        <span style={{ fontSize:11, color:textSecondary }}>
                          🎂 {fmtDate(p.birth_date)}{age!=null?` · ${age} yosh`:''}
                        </span>
                      )}
                      {p.birth_place && (
                        <span style={{ fontSize:11, color:textSecondary }}>
                          📍 {p.birth_place}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display:'flex', flexDirection:'column', gap:5, flexShrink:0 }}>
                    <button
                      onClick={e => { e.stopPropagation(); navigate(`/persons/${p.id}/edit`) }}
                      style={{ padding:'4px 10px', borderRadius:8, fontSize:10.5, fontWeight:700,
                        border:'none', cursor:'pointer',
                        background:'linear-gradient(135deg,#6366f1,#7c3aed)', color:'white' }}>
                      ✏️ Tahrir
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {/* Add button — faqat login qilganlarga */}
      {user && (
        <button onClick={() => navigate('/persons/add')}
          style={{ padding:'13px', borderRadius:14, border:'none', cursor:'pointer',
            background:'linear-gradient(135deg,#10b981,#059669)', color:'white',
            fontSize:14, fontWeight:800, marginTop:4,
            boxShadow:'0 4px 16px rgba(16,185,129,.35)',
            transition:'all .2s' }}
          onMouseEnter={e => e.currentTarget.style.transform='translateY(-2px)'}
          onMouseLeave={e => e.currentTarget.style.transform=''}>
          ➕ Yangi shaxs qo'shish
        </button>
      )}
    </div>
  )
}

// ── TreeEmptyState ─────────────────────────────────────────────
function TreeEmptyState({ navigate, isDark }) {
  const steps = [
    { icon: '➕', label: "Shaxs qo'shish", desc: "Birinchi a'zoni bazaga kiriting", to: '/persons/add', color: '#10b981' },
    { icon: '🔗', label: "Ota-ona bog'lash", desc: "Oila aloqalarini yarating", to: '/relationship', color: '#6366f1' },
    { icon: '🌳', label: "Daraxtni ko'rish", desc: "Shajara chiroyli ko'rinishda", to: null, color: '#f59e0b' },
  ]
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 10,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: isDark
        ? 'linear-gradient(150deg,#1e1b4b 0%,#1e1433 50%,#1e1428 100%)'
        : 'linear-gradient(150deg,#eef2ff 0%,#f5f0ff 50%,#fdf4ff 100%)',
    }}>
      <div style={{ textAlign: 'center', maxWidth: 480, padding: '0 24px' }}>
        {/* Animated illustration */}
        <div style={{
          fontSize: 80, marginBottom: 8,
          animation: 'emptyFloat 3s ease-in-out infinite',
          display: 'inline-block',
        }}>🌱</div>

        <h2 style={{
          fontSize: 26, fontWeight: 900, margin: '0 0 10px',
          color: isDark ? '#f1f5f9' : '#1e293b',
        }}>Shajara hali bo'sh</h2>

        <p style={{
          fontSize: 15, color: isDark ? '#94a3b8' : '#64748b',
          marginBottom: 32, lineHeight: 1.6,
        }}>
          Oila daraxtingizni boshlash uchun birinchi a'zoni qo'shing.<br/>
          Bu faqat bir necha daqiqa oladi!
        </p>

        {/* Steps */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 28, justifyContent: 'center' }}>
          {steps.map((s, i) => (
            <div key={i} style={{
              flex: 1, padding: '16px 10px', borderRadius: 16,
              background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.85)',
              border: `1.5px solid ${s.color}30`,
              backdropFilter: 'blur(8px)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
            }}>
              <div style={{
                width: 42, height: 42, borderRadius: 12, fontSize: 20,
                background: `${s.color}18`,
                border: `1.5px solid ${s.color}40`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{s.icon}</div>
              <div style={{ fontSize: 12, fontWeight: 800, color: isDark ? '#e2e8f0' : '#1e293b' }}>{s.label}</div>
              <div style={{ fontSize: 11, color: isDark ? '#64748b' : '#94a3b8', lineHeight: 1.4 }}>{s.desc}</div>
              <div style={{
                width: 20, height: 20, borderRadius: '50%', fontSize: 11, fontWeight: 900,
                background: s.color, color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{i + 1}</div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <button
          onClick={() => navigate('/persons/add')}
          style={{
            padding: '14px 36px', borderRadius: 16, border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg,#6366f1,#7c3aed)',
            color: 'white', fontSize: 16, fontWeight: 800,
            boxShadow: '0 8px 28px rgba(99,102,241,0.45)',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 14px 36px rgba(99,102,241,0.55)' }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(99,102,241,0.45)' }}
        >
          ➕ Birinchi a'zoni qo'shish
        </button>

        <div style={{ marginTop: 14, fontSize: 12, color: isDark ? '#64748b' : '#94a3b8' }}>
          Yoki <span
            style={{ color: '#6366f1', fontWeight: 700, cursor: 'pointer' }}
            onClick={() => navigate('/persons')}
          >shaxslar ro'yxatini</span> ko'ring
        </div>
      </div>

      <style>{`
        @keyframes emptyFloat {
          0%,100% { transform: translateY(0px) }
          50%      { transform: translateY(-12px) }
        }
      `}</style>
    </div>
  )
}

// ── Donolar gapi ──────────────────────────────────────────────
const FAMILY_QUOTES = [
  { text: "Ildiz chuqur bo'lsa — daraxt baland o'sar.",            author: "Xalq naqlı" },
  { text: "Ajdodlarni bilmagan — o'z yo'lini bilmaydi.",           author: "Sharq hikmati" },
  { text: "Oila — insonning birinchi maktabi.",                     author: "V. Gyugo" },
  { text: "Nasabni bilmoq — o'zligini bilmoqdir.",                  author: "Alisher Navoiy" },
  { text: "Kelajakni qurayotganlar o'tmishini biladi.",             author: "Konfutsiy" },
  { text: "Shajara — xotira emas, tiriklarning hayoti.",            author: "Xalq naqlı" },
  { text: "Ota-boboni ulug'lagan — o'z farzandini tarbiyalagan.",  author: "Sharq hikmatı" },
  { text: "Avlodlar zanjiri uzilmasa — millat abadiy.",             author: "Milliy maqol" },
  { text: "Ildizlarini yodda tutgan daraxt bo'ron ura olmaydi.",    author: "Afrika naqlı" },
  { text: "Oila tarixi — xalq tarixining ko'zgusi.",                author: "Tarixchi" },
  { text: "Yaxshi ot — meros, yaxshi ism — boylik.",                author: "O'zbek naqlı" },
  { text: "Bobo yo'lidan borgan — adashmas.",                       author: "Sharq hikmatı" },
  { text: "Sulolangni bilmasang — kelajaging noma'lum.",            author: "Xalq naqlı" },
  { text: "Oilani sevgan — dunyoni sevgan.",                        author: "Buyuk Britaniya naqlı" },
  { text: "Shajara — o'lganlarning tirik hujjati.",                 author: "Tarixchi" },
]

// ── TreeFlow ───────────────────────────────────────────────────
function TreeFlow({ rawPersons, stats }) {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  // 6.1 — Lazy rendering performance counters
  const [visibleCount, setVisibleCount] = useState(0)
  const [collapsed, setCollapsed]        = useState(new Set())
  const [dimDeceased, setDimDeceased]    = useState(false)
  const [search, setSearch]              = useState('')
  const [loading, setLoading]            = useState(true)
  const [selectedPersonId, setSelectedPersonId] = useState(null)
  const [exporting, setExporting]        = useState(false)
  const [isMobile, setIsMobile]          = useState(() => typeof window !== 'undefined' && window.innerWidth < 640)
  const [focusId, setFocusId]            = useState(null)
  const [focusGen, setFocusGen]          = useState(3)
  const [hoveredId, setHoveredId]        = useState(null)
  // Mobil ko'rinish: 'tree' | 'list'
  const [viewMode, setViewMode]          = useState(() =>
    typeof window !== 'undefined' && window.innerWidth < 768 ? 'list' : 'tree'
  )
  // Foydalanuvchi qo'lda viewMode tanlagan bo'lsa, auto-switch ishlamasin.
  // userPickedView = true bo'lganda matchMedia handler o'zgartirmaydi.
  const userPickedView = useRef(false)
  const setViewModeManual = useCallback((mode) => {
    userPickedView.current = true
    setViewMode(mode)
  }, [])

  // Auto-switch: faqat foydalanuvchi qo'lda tanlamagan holda ishlaydi.
  // Brauzer 768px chegarasini kesib o'tganda boshlang'ich holat tiklash uchun —
  // desktop ga qaytganda tree, mobilga o'tganda list taklif qilinadi,
  // lekin faqat user o'zi tanlamagan bo'lsa.
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const handler = (e) => {
      if (userPickedView.current) return
      setViewMode(e.matches ? 'list' : 'tree')
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)')
    const handler = (e) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  // 5.3 — Filter panel
  const [showFilters, setShowFilters]    = useState(false)
  const [filterAlive,  setFilterAlive]   = useState(false)   // faqat tiriklar
  const [filterGender, setFilterGender]  = useState('all')   // 'all'|'male'|'female'
  const [filterGen,    setFilterGen]     = useState(0)       // 0 = hammasi, N = N-avlod
  // ── Qo'shimcha statistikalar (ribbon uchun) ───────────────────
  const extraStats = useMemo(() => {
    if (!rawPersons.length) return null
    const genMap    = computeGenerations(rawPersons)
    const genVals   = Object.values(genMap)
    const genCount  = genVals.length ? Math.max(...genVals) + 1 : 1
    const alive     = rawPersons.filter(p => !p.death_date && !p.deceased && !p.is_deceased)
    const dead      = rawPersons.filter(p => p.death_date || p.deceased || p.is_deceased)
    const ages      = alive.map(p => calcAge(p.birth_date, null)).filter(a => a != null && a >= 0)
    const avgAge    = ages.length ? Math.round(ages.reduce((s, a) => s + a, 0) / ages.length) : null
    const males     = rawPersons.filter(p => p.gender === 'male').length
    const malesPct  = rawPersons.length ? Math.round(males / rawPersons.length * 100) : null
    const maxAgeP   = alive.reduce((best, p) => {
      const a = calcAge(p.birth_date, null)
      return (a != null && (!best || a > best.age)) ? { ...p, age: a } : best
    }, null)
    const total     = rawPersons.length
    const alivePct  = total ? Math.round(alive.length / total * 100) : 0
    const deadPct   = total ? Math.round(dead.length  / total * 100) : 0
    const deadMales = dead.filter(p => p.gender === 'male').length
    const avgDeadAge = (() => {
      const da = dead.map(p => calcAge(p.birth_date, p.death_date)).filter(a => a != null && a > 0)
      return da.length ? Math.round(da.reduce((s,a)=>s+a,0)/da.length) : null
    })()
    return { genCount, avgAge, malesPct, maxAge: maxAgeP?.age ?? null,
      aliveCount: alive.length, deadCount: dead.length, alivePct, deadPct,
      deadMales, avgDeadAge, total }
  }, [rawPersons])

  const quote = useMemo(() => FAMILY_QUOTES[Math.floor(Math.random() * FAMILY_QUOTES.length)], [])

  // 12. Share link modal
  const [showShare, setShowShare]       = useState(false)
  const [shareLinks, setShareLinks]     = useState([])
  const [shareLoading, setShareLoading] = useState(false)
  const [shareCreating, setShareCreating] = useState(false)

  const loadShareLinks = useCallback(async () => {
    setShareLoading(true)
    try { const r = await getShareLinks(); setShareLinks(r.data) }
    catch { /* ignore */ }
    finally { setShareLoading(false) }
  }, [])

  const handleCreateShareLink = useCallback(async () => {
    setShareCreating(true)
    try {
      await createShareLink({})
      await loadShareLinks()
      toast.success('🔗 Havola yaratildi!')
    } catch { toast.error('Xato yuz berdi') }
    finally { setShareCreating(false) }
  }, [loadShareLinks])

  const handleDeleteShareLink = useCallback(async (id) => {
    try {
      await deleteShareLink(id)
      setShareLinks(prev => prev.filter(l => l.id !== id))
      toast.success('🗑️ Havola o\'chirildi')
    } catch { toast.error('Xato yuz berdi') }
  }, [])

  const handleCopyLink = useCallback((token) => {
    const url = `${window.location.origin}/s/${token}`
    navigator.clipboard.writeText(url).then(() => toast.success('📋 Havola nusxalandi!'))
  }, [])

  useEffect(() => { if (showShare) loadShareLinks() }, [showShare, loadShareLinks])

  // Oxirgi bosilgan shaxs — modal yopilgandan keyin ham saqlanadi (Focus uchun)
  const lastClickedId = useRef(null)
  // Saqlangan pozitsiyalar (localStorage)
  const savedPosRef = useRef({})
  // Eski saqlangan pozitsiyalarni o'chirish — layout har doim markazlangan bo'lsin
  useEffect(() => { try { localStorage.removeItem(POS_KEY) } catch {} }, [])
  const { isDark } = useThemeStore()
  const { fitView, zoomIn, zoomOut } = useReactFlow()
  const nodesInitialized = useNodesInitialized()
  const flowRef = useRef(null)

  // viewMode ref — window resize handler'da stale closure muammosini hal qiladi
  const viewModeRef = useRef(viewMode)
  useEffect(() => { viewModeRef.current = viewMode }, [viewMode])

  // Node'lar o'lchanib tayyor bo'lganda (useNodesInitialized → true):
  //   1. fitView — viewport'ni to'g'ri joyga qo'yadi
  //   2. requestAnimationFrame ichida har bir edge uchun yangi object yaratib
  //      ChildEdge'ni qayta render qilishga majbur qilinadi.
  //
  // Sabab: setEdges chaqirilganda ReactFlow node o'lchamlarini hali o'lchamagan
  // bo'ladi → handle koordinatalari (0,0) → polygon ko'rinmaydi.
  // setEdges([...e]) bir xil object referencelar berib React bailout qiladi,
  // shuning uchun e.map(x=>({...x})) bilan yangi objectlar yaratiladi.
  useEffect(() => {
    if (!nodesInitialized) return
    fitView({ padding: 0.12, duration: 600 })
    const id = requestAnimationFrame(() => {
      setEdges(e => e.map(x => ({ ...x })))
    })
    return () => cancelAnimationFrame(id)
  }, [nodesInitialized, fitView, setEdges])

  // viewMode 'tree' ga o'tganda fitView — faqat shu trigger uchun.
  // nodesInitialized layout rebuild'dan keyingi fitView'ni o'z zimmasiga oladi,
  // lekin viewMode o'zgarganda node'lar o'zgarmaydi → nodesInitialized qayta ishlamaydi.
  // Shuning uchun bu effect alohida kerak.
  const prevViewMode = useRef(viewMode)
  useEffect(() => {
    if (viewMode !== 'tree' || prevViewMode.current === 'tree') {
      prevViewMode.current = viewMode
      return
    }
    prevViewMode.current = viewMode
    const t = setTimeout(() => fitView({ padding: 0.12, duration: 500 }), 80)
    return () => clearTimeout(t)
  }, [viewMode, fitView])

  // Brauzer o'lchami o'zgarganda silliq moslashish
  useEffect(() => {
    let debounce = null
    const handler = () => {
      clearTimeout(debounce)
      debounce = setTimeout(() => {
        if (viewModeRef.current === 'tree') fitView({ padding: 0.12, duration: 500 })
      }, 180)
    }
    window.addEventListener('resize', handler, { passive: true })
    return () => { window.removeEventListener('resize', handler); clearTimeout(debounce) }
  }, [fitView])

  const toggleCouple = useCallback((coupleId) => {
    setCollapsed(prev => {
      const next = new Set(prev)
      next.has(coupleId) ? next.delete(coupleId) : next.add(coupleId)
      return next
    })
  }, [])

  const handlePersonClick = useCallback((id) => {
    lastClickedId.current = id
    setSelectedPersonId(id)
  }, [])

  const handleFocusClick = useCallback((id) => {
    setFocusId(prev => prev === id ? null : id)
    setSelectedPersonId(null)
  }, [])

  // Node drag tugaganda pozitsiyani saqlash
  const handleNodeDragStop = useCallback((_event, node) => {
    savedPosRef.current = { ...savedPosRef.current, [node.id]: node.position }
    savePosToLS(savedPosRef.current)
  }, [])

  // Barcha saqlangan pozitsiyalarni tozalash
  const resetPositions = useCallback(() => {
    savedPosRef.current = {}
    savePosToLS({})
    toast.success('♻️ Tartib tiklandi')
    // Rebuild layout
    const pool = rawPersons
    const filtered = focusFilter(pool, null, focusGen)
    const { nodes: n, edges: e } = buildLayout(filtered, collapsed, toggleCouple, dimDeceased, handlePersonClick, focusId, handleFocusClick)
    setNodes(centerRows(n))
    setEdges(e)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawPersons, collapsed, dimDeceased, toggleCouple, handlePersonClick, focusGen])

  useEffect(() => {
    if (!rawPersons.length) return
    setLoading(false)

    // 5.3 — Apply filters before focusFilter
    let pool = rawPersons
    if (filterAlive)            pool = pool.filter(p => !p.death_date)
    if (filterGender !== 'all') pool = pool.filter(p => p.gender === filterGender)
    if (filterGen > 0) {
      // Avlod hisoblash
      const genMap = computeGenerations(rawPersons)  // rawPersons dan hisoblaymiz
      pool = pool.filter(p => genMap[p.id] === filterGen - 1)
    }

    const filtered = focusFilter(pool, focusId, focusGen)
    const { nodes: n, edges: e } = buildLayout(filtered, collapsed, toggleCouple, dimDeceased, handlePersonClick, focusId, handleFocusClick)
    const centered = centerRows(n)
    setNodes(centered)
    setEdges(e)
    setVisibleCount(centered.filter(x => x.type === 'personNode').length)
  }, [rawPersons, collapsed, dimDeceased, toggleCouple, handlePersonClick, handleFocusClick,
      focusId, focusGen, filterAlive, filterGender, filterGen])

  // PNG export
  const handleExport = useCallback(async () => {
    const el = document.querySelector('.react-flow__viewport')?.closest('.react-flow')
    if (!el) return
    setExporting(true)
    try {
      await fitView({ padding: 0.1, duration: 300 })
      await new Promise(r => setTimeout(r, 400))
      const dataUrl = await toPng(el, {
        quality: 1.0,
        pixelRatio: 3,
        backgroundColor: isDark ? '#0f172a' : '#f1f5fd',
        filter: node => !node.classList?.contains('react-flow__minimap') && !node.classList?.contains('react-flow__controls') && !node.classList?.contains('react-flow__attribution'),
        style: { fontFamily: 'system-ui, -apple-system, sans-serif' },
      })
      const a = document.createElement('a')
      a.href   = dataUrl
      a.download = `shajara-${new Date().toISOString().slice(0,10)}.png`
      a.click()
    } finally {
      setExporting(false)
    }
  }, [fitView])

  // PDF export
  const handleExportPDF = useCallback(async () => {
    const el = document.querySelector('.react-flow__viewport')?.closest('.react-flow')
    if (!el) return
    setExporting(true)
    try {
      await fitView({ padding: 0.1, duration: 300 })
      await new Promise(r => setTimeout(r, 400))
      const dataUrl = await toPng(el, {
        quality: 1.0, pixelRatio: 2,
        backgroundColor: isDark ? '#0f172a' : '#f1f5fd',
        filter: node => !node.classList?.contains('react-flow__minimap') &&
                        !node.classList?.contains('react-flow__controls') &&
                        !node.classList?.contains('react-flow__attribution'),
        style: { fontFamily: 'system-ui, -apple-system, sans-serif' },
      })
      const img = new Image()
      img.src = dataUrl
      await new Promise(r => { img.onload = r })
      const pw = img.naturalWidth, ph = img.naturalHeight
      const landscape = pw > ph
      const pdf = new jsPDF({ orientation: landscape ? 'landscape' : 'portrait', unit: 'px', format: [pw, ph] })
      pdf.addImage(dataUrl, 'PNG', 0, 0, pw, ph)
      pdf.save(`shajara-${new Date().toISOString().slice(0, 10)}.pdf`)
    } finally {
      setExporting(false)
    }
  }, [fitView, isDark])

  // 5.3 — max generation for dropdown
  const maxGen = rawPersons.length
    ? Math.max(...Object.values(computeGenerations(rawPersons))) + 1
    : 1
  const activeFilters = (filterAlive ? 1 : 0) + (filterGender !== 'all' ? 1 : 0) + (filterGen > 0 ? 1 : 0)

  // Hover-highlight: hoveredId bo'lganda barcha ajdodlar, avlodlar va juftlar
  const hoveredConnectedIds = useMemo(() => {
    if (!hoveredId) return null
    const pid = parseInt(hoveredId.replace('p-', ''), 10)
    const pm2 = {}
    rawPersons.forEach(p => { pm2[p.id] = p })
    if (!pm2[pid]) return null

    const ids = new Set()
    const visitedAnc = new Set()
    const visitedDesc = new Set()

    // Barcha ajdodlarni rekursiv qo'shish (yuqoriga)
    const addAncestors = (id) => {
      if (visitedAnc.has(id)) return
      visitedAnc.add(id)
      ids.add(String(id))
      const p = pm2[id]
      if (!p) return
      ;(p.families || []).forEach(f => { if (f.partner_id) ids.add(String(f.partner_id)) })
      if (p.father_id) addAncestors(p.father_id)
      if (p.mother_id) addAncestors(p.mother_id)
    }

    // Barcha avlodlarni rekursiv qo'shish (pastga)
    const addDescendants = (id) => {
      if (visitedDesc.has(id)) return
      visitedDesc.add(id)
      ids.add(String(id))
      const p = pm2[id]
      if (!p) return
      ;(p.families || []).forEach(f => { if (f.partner_id) ids.add(String(f.partner_id)) })
      rawPersons.forEach(child => {
        if (child.father_id === id || child.mother_id === id) addDescendants(child.id)
      })
    }

    addAncestors(pid)
    addDescendants(pid)
    return ids
  }, [hoveredId, rawPersons])

  const baseNodes = search.trim()
    ? nodes.map(n => {
        if (n.type !== 'personNode') return n
        const match = n.data.full_name?.toLowerCase().includes(search.toLowerCase())
        return { ...n, style: match
          ? { filter:'drop-shadow(0 0 12px rgba(249,115,22,0.8))' }
          : { opacity:0.12 } }
      })
    : nodes

  // Hover: edge dimming — bog'liq bo'lmagan qirralar xiralashadi
  const hoveredEdges = useMemo(() => {
    if (!hoveredId || !hoveredConnectedIds) return edges
    return edges.map(e => {
      // Edge source yoki target connected bo'lsa — yorqin, aks holda xiralash
      const srcPid = e.source.startsWith('p-') ? e.source.replace('p-', '') : null
      const tgtPid = e.target.startsWith('p-') ? e.target.replace('p-', '') : null
      const connected = (srcPid && hoveredConnectedIds.has(srcPid))
        || (tgtPid && hoveredConnectedIds.has(tgtPid))
      if (connected) return { ...e, style: { ...e.style, opacity: 1 } }
      return { ...e, style: { ...e.style, opacity: 0.08 } }
    })
  }, [hoveredId, hoveredConnectedIds, edges])

  const visibleNodes = baseNodes

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', background:'linear-gradient(135deg,#eef2ff,#fdf4ff)' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:64, marginBottom:16 }}>🌳</div>
        <div style={{ color:'#6366f1', fontWeight:700, fontSize:16 }}>Shajara daraxti yuklanmoqda...</div>
        <div style={{ color:'#94a3b8', fontSize:13, marginTop:4 }}>Iltimos kuting</div>
      </div>
    </div>
  )

  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column' }}>
      {/* Modal */}
      <PersonDetailModal
        personId={selectedPersonId}
        onClose={() => setSelectedPersonId(null)}
        navigate={navigate}
        onFocus={(id) => {
          if (focusId === id) { setFocusId(null); lastClickedId.current = null }
          else setFocusId(id)
        }}
        isFocused={focusId === selectedPersonId}
      />

      {/* Stats ribbon */}
      {stats && (
        <div className="stats-ribbon" style={{
          display: 'grid',
          gridTemplateColumns: 'auto 1fr auto',
          alignItems: 'center',
          background: 'linear-gradient(135deg,#1e1b4b 0%,#312e81 30%,#4f46e5 65%,#7c3aed 100%)',
          position: 'relative', overflow: 'hidden',
          minHeight: 60, flexShrink: 0,
        }}>
          <style>{`
            @keyframes statFadeIn {
              0%   { opacity:0; transform:translateY(-50%) translateX(var(--stat-dx,0)) scale(0.88) }
              100% { opacity:1; transform:translateY(-50%) translateX(0) scale(1) }
            }
            @keyframes ribbonShimmer {
              0%   { background-position:-200% center }
              100% { background-position: 200% center }
            }
            @keyframes treePulse {
              0%,100% { transform:scale(1) rotate(-4deg) }
              50%      { transform:scale(1.15) rotate(4deg) }
            }
            @keyframes quoteSlide {
              0%   { opacity:0; transform:translateY(6px) }
              100% { opacity:1; transform:translateY(0) }
            }
            .rb-stat:hover { background:rgba(255,255,255,0.1) !important; border-radius:12px }
            .rb-stat:hover .rb-val { transform:scale(1.08) }
            .rb-val { transition: transform 0.18s }
            @media (max-width: 768px) {
              .rb-left { overflow-x: auto; scrollbar-width: none; }
              .rb-left::-webkit-scrollbar { display: none; }
              .rb-stat { padding: 0 12px !important; min-width: 72px; }
            }
          `}</style>

          {/* Bg glows */}
          <div style={{ position:'absolute', top:-40, left:10, width:140, height:140, borderRadius:'50%',
            background:'radial-gradient(circle,rgba(255,255,255,0.07) 0%,transparent 70%)', pointerEvents:'none' }}/>
          <div style={{ position:'absolute', bottom:-50, right:'35%', width:160, height:160, borderRadius:'50%',
            background:'radial-gradient(circle,rgba(168,85,247,0.2) 0%,transparent 70%)', pointerEvents:'none' }}/>

          {/* ── LEFT: 4 stat ── */}
          <div className="rb-left" style={{ display:'flex', alignItems:'stretch' }}>
            {[
              { icon:'👥', label:"Jami a'zolar", value:stats.total,                         suffix:'',      glow:'rgba(255,255,255,0.18)' },
              { icon:'💚', label:'Tiriklar',      value:stats.alive,                         suffix:'',      glow:'rgba(16,185,129,0.3)'  },
              { icon:'🕯️', label:'Vafot etgan',   value:stats.deceased ?? (stats.total - (stats.alive||0)), suffix:'', glow:'rgba(148,163,184,0.3)' },
              { icon:'🌿', label:'Avlodlar',      value:extraStats?.genCount ?? '—',         suffix:' ta',   glow:'rgba(34,197,94,0.3)'   },
              { icon:'📊', label:"O'rtacha yosh", value:extraStats?.avgAge ?? '—',           suffix:' yosh', glow:'rgba(251,191,36,0.3)'  },
            ].map(({ icon, label, value, suffix, glow }, i) => (
              <div key={label} className="rb-stat" style={{
                display:'flex', alignItems:'center', gap:9,
                padding:'0 18px', color:'white', cursor:'default',
                borderRight:'1px solid rgba(255,255,255,0.1)',
                transition:'background 0.18s',
                minHeight: 60,
              }}>
                <div style={{
                  width:32, height:32, borderRadius:10, flexShrink:0,
                  background:'rgba(255,255,255,0.13)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:16, border:'1px solid rgba(255,255,255,0.2)',
                  boxShadow:`0 2px 10px ${glow}`,
                }}>{icon}</div>
                <div>
                  <div className="rb-val" style={{
                    fontSize:20, fontWeight:900, lineHeight:1,
                    letterSpacing:'-0.5px', whiteSpace:'nowrap',
                  }}>
                    {typeof value === 'number' ? <AnimCount to={value} /> : value}{typeof value === 'number' ? suffix : ''}
                  </div>
                  <div style={{ fontSize:9.5, opacity:0.65, fontWeight:600, marginTop:2, whiteSpace:'nowrap' }}>{label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* ── CENTER: Aforizm ── */}
          <div className="rb-center" style={{
            display:'flex', alignItems:'center', justifyContent:'center',
            padding:'0 28px', color:'white',
            borderLeft:'1px solid rgba(255,255,255,0.1)',
            borderRight:'1px solid rgba(255,255,255,0.1)',
            minHeight: 60, position:'relative', overflow:'hidden',
            animation:'quoteSlide 0.5s ease',
          }}>
            <div style={{
              position:'absolute', inset:0, pointerEvents:'none',
              background:'linear-gradient(105deg,transparent 30%,rgba(255,255,255,0.05) 50%,transparent 70%)',
              backgroundSize:'200% 100%', animation:'ribbonShimmer 6s ease infinite',
            }}/>
            <div style={{ textAlign:'center', zIndex:1, maxWidth: 480 }}>
              <div style={{
                fontSize:13.5, fontWeight:700, lineHeight:1.5,
                fontStyle:'italic', opacity:0.96,
                letterSpacing:'0.01em',
                textShadow:'0 1px 8px rgba(0,0,0,0.3)',
              }}>❝ {quote.text} ❞</div>
              <div style={{
                fontSize:10.5, opacity:0.58, fontWeight:600, marginTop:4,
                letterSpacing:'0.06em', textTransform:'uppercase',
              }}>{quote.author}</div>
            </div>
          </div>

          {/* ── RIGHT: Oila nomi ── */}
          <div className="rb-right" style={{
            display:'flex', alignItems:'center', gap:12,
            padding:'0 24px', minHeight:60,
            position:'relative', overflow:'hidden',
          }}>
            <div style={{
              position:'absolute', inset:0, pointerEvents:'none',
              background:'linear-gradient(105deg,transparent 25%,rgba(255,255,255,0.08) 50%,transparent 75%)',
              backgroundSize:'200% 100%', animation:'ribbonShimmer 4s ease infinite',
            }}/>
            <div style={{
              width:42, height:42, borderRadius:13, flexShrink:0,
              background:'linear-gradient(135deg,rgba(255,255,255,0.26),rgba(255,255,255,0.09))',
              border:'1.5px solid rgba(255,255,255,0.32)',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:22, boxShadow:'0 5px 18px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.3)',
              animation:'treePulse 3.5s ease infinite',
              position:'relative', zIndex:1, flexShrink:0,
            }}>🌳</div>
            <div style={{ position:'relative', zIndex:1 }}>
              <div style={{
                fontSize:16, fontWeight:900, color:'white', lineHeight:1.15,
                letterSpacing:'-0.2px', textShadow:'0 2px 10px rgba(0,0,0,0.4)',
                whiteSpace:'nowrap',
              }}>
                Matayev <span style={{
                  background:'linear-gradient(135deg,#fde68a,#fbbf24)',
                  WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
                  fontSize:14,
                }}>&amp;</span> Abdumannonovlar
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:5, marginTop:4 }}>
                <div style={{ flex:1, height:1.5, borderRadius:2, background:'linear-gradient(90deg,rgba(253,230,138,0.7),transparent)' }}/>
                <span style={{ fontSize:8.5, fontWeight:900, letterSpacing:'0.2em', textTransform:'uppercase', color:'rgba(253,230,138,0.8)' }}>✦ Shajarasi ✦</span>
                <div style={{ flex:1, height:1.5, borderRadius:2, background:'linear-gradient(90deg,transparent,rgba(253,230,138,0.7))' }}/>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="tree-toolbar-row" style={{ display:'flex', alignItems:'center', flexWrap:'wrap', gap:8, padding:'8px 12px',
        background: isDark ? '#1e293b' : 'white',
        borderBottom: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
        boxShadow: isDark ? '0 1px 10px rgba(0,0,0,0.3)' : '0 1px 10px rgba(0,0,0,0.05)',
        flexShrink:0 }}>

        <div style={{ display:'flex', alignItems:'center', gap:6, color:'#4f46e5', fontWeight:700, fontSize:14, flexShrink:0 }}>
          <span style={{ fontSize:17 }}>🌲</span>
          <span className="hide-mobile" style={{ color: isDark ? '#818cf8' : '#4f46e5' }}>
            Shajara daraxti
            {focusId && <span style={{ marginLeft:6, fontSize:11, background:'#f59e0b22', color:'#f59e0b', padding:'1px 7px', borderRadius:8, fontWeight:700 }}>
              Focus rejim
            </span>}
          </span>
        </div>

        {/* View toggle: daraxt / ro'yxat */}
        <div style={{ display:'flex', gap:3, padding:'3px', borderRadius:11,
          background: isDark ? '#0f172a' : '#f1f5f9',
          border:`1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
          flexShrink:0 }}>
          {[['tree','🌲','Daraxt'],['list','☰','Ro\'yxat']].map(([mode, icon, label]) => (
            <button key={mode} onClick={() => setViewModeManual(mode)}
              title={label}
              style={{ padding:'4px 10px', borderRadius:8, border:'none', cursor:'pointer',
                fontSize:12, fontWeight:700, transition:'all .15s',
                background: viewMode===mode
                  ? 'linear-gradient(135deg,#6366f1,#7c3aed)'
                  : 'transparent',
                color: viewMode===mode ? 'white' : (isDark ? '#64748b' : '#94a3b8'),
                boxShadow: viewMode===mode ? '0 2px 8px rgba(99,102,241,.3)' : 'none',
              }}>
              {icon} <span style={{ fontSize:10 }}>{label}</span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="tree-toolbar-search" style={{ position:'relative', width:200, flexShrink:0 }}>
          <svg style={{ position:'absolute', top:'50%', transform:'translateY(-50%)', left:8,
            color:'#94a3b8', width:13, height:13, pointerEvents:'none' }}
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <input type="text" placeholder="Ism yoki familiya..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="form-input"
            style={{ paddingLeft:26, paddingTop:5, paddingBottom:5, fontSize:12 }}/>
          {search && (
            <button onClick={() => setSearch('')}
              style={{ position:'absolute', top:'50%', transform:'translateY(-50%)',
                right:7, color:'#94a3b8', cursor:'pointer', fontSize:10, background:'none', border:'none' }}>✕</button>
          )}
        </div>

        {/* Right side buttons */}
        <div className="tree-toolbar-right" style={{ display:'flex', alignItems:'center', gap:6, marginLeft:'auto', flexWrap:'wrap' }}>
          {/* Reset view */}
          <button onClick={() => fitView({ padding:0.12, duration:400 })} title="Ko'rinishni tiklash"
            style={{ width:30, height:30, borderRadius:9, background:'#f1f5f9', color:'#475569',
              border:'1px solid #e2e8f0', cursor:'pointer', display:'flex', alignItems:'center',
              justifyContent:'center', fontSize:17, fontWeight:700 }}>↺</button>
          {/* Reset positions */}
          <button onClick={resetPositions} title="Tartibni qayta hisoblash"
            style={{ width:30, height:30, borderRadius:9, background: isDark ? '#1e293b' : '#f8fafc',
              color: isDark ? '#94a3b8' : '#64748b',
              border:`1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
              cursor:'pointer', display:'flex', alignItems:'center',
              justifyContent:'center', fontSize:14 }}>⚙️</button>

          {/* Add person — faqat login qilganlarga */}
          {user && (
            <button onClick={() => navigate('/persons/add')}
              style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 12px',
                borderRadius:9, fontSize:12, fontWeight:700, cursor:'pointer', border:'none',
                background:'linear-gradient(135deg,#10b981,#059669)', color:'white',
                boxShadow:'0 3px 10px rgba(16,185,129,0.35)' }}>
              ➕ <span className="hide-mobile">Yangi shaxs</span>
            </button>
          )}

          {/* Export PNG */}
          <button onClick={handleExport} disabled={exporting}
            className="png-export-btn"
            style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 12px',
              borderRadius:9, fontSize:12, fontWeight:700, cursor:'pointer', border:'none',
              background: exporting ? '#e2e8f0' : 'linear-gradient(135deg,#3b82f6,#6366f1)',
              color: exporting ? '#94a3b8' : 'white',
              boxShadow: exporting ? 'none' : '0 3px 10px rgba(59,130,246,0.35)' }}>
            {exporting ? '⏳' : '📷'} <span>{exporting ? 'Export...' : 'PNG'}</span>
          </button>

          {/* Export PDF */}
          <button onClick={handleExportPDF} disabled={exporting}
            style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 12px',
              borderRadius:9, fontSize:12, fontWeight:700, cursor:'pointer', border:'none',
              background: exporting ? '#e2e8f0' : 'linear-gradient(135deg,#ef4444,#dc2626)',
              color: exporting ? '#94a3b8' : 'white',
              boxShadow: exporting ? 'none' : '0 3px 10px rgba(239,68,68,0.35)' }}>
            {exporting ? '⏳' : '📄'} <span className="hide-mobile">{exporting ? 'Export...' : 'PDF'}</span>
          </button>

          {/* Focus mode */}
          {focusId ? (
            <div style={{ display:'flex', alignItems:'center', gap:4 }}>
              {/* Fokus shaxsi nomi */}
              {(() => {
                const fp = rawPersons.find(p => p.id === focusId)
                return fp ? (
                  <span style={{ fontSize:11, fontWeight:700, color:'#92400e',
                    background:'#fef3c7', padding:'4px 8px', borderRadius:8,
                    border:'1px solid #fde68a', maxWidth:120, overflow:'hidden',
                    textOverflow:'ellipsis', whiteSpace:'nowrap' }}
                    title={fp.full_name}>
                    🎯 {fp.full_name?.split(' ')[0]}
                  </span>
                ) : null
              })()}
              <select value={focusGen} onChange={e => setFocusGen(Number(e.target.value))}
                style={{ padding:'4px 8px', borderRadius:8, fontSize:11, fontWeight:700,
                  border:'1.5px solid #f59e0b', background: isDark ? '#1e293b' : '#fffbeb',
                  color:'#92400e', cursor:'pointer', outline:'none' }}>
                {[1,2,3,4,5].map(g => <option key={g} value={g}>{g} avlod</option>)}
              </select>
              <button onClick={() => { setFocusId(null); lastClickedId.current = null }}
                style={{ display:'flex', alignItems:'center', gap:4, padding:'5px 10px',
                  borderRadius:9, fontSize:11, fontWeight:700, cursor:'pointer',
                  border:'1.5px solid #f59e0b', background:'#fef3c7', color:'#92400e' }}>
                ✕ <span className="hide-mobile">Focus</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                if (lastClickedId.current) {
                  setFocusId(lastClickedId.current)
                  setSelectedPersonId(null)
                } else {
                  toast('Avval daraxtdagi shaxs kartasini bosing, so\'ng 🎯 Focus ni bosing', { icon: '💡' })
                }
              }}
              title="Focus rejimi — bitta shaxs atrofida ko'rish"
              style={{ display:'flex', alignItems:'center', gap:4, padding:'5px 12px',
                borderRadius:9, fontSize:11, fontWeight:700, cursor:'pointer',
                border:`1.5px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                background: isDark ? '#1e293b' : '#f8fafc',
                color: isDark ? '#94a3b8' : '#64748b', transition:'all 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor='#f59e0b'; e.currentTarget.style.color='#92400e' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor=isDark?'#334155':'#e2e8f0'; e.currentTarget.style.color=isDark?'#94a3b8':'#64748b' }}>
              🎯 <span className="hide-mobile">Focus</span>
            </button>
          )}

          {/* Dim deceased */}
          <button onClick={() => setDimDeceased(v => !v)}
            style={{ display:'flex', alignItems:'center', gap:4, padding:'5px 12px',
              borderRadius:9, fontSize:11.5, fontWeight:600, cursor:'pointer', border:'1.5px solid',
              background: dimDeceased ? '#1e293b' : '#f8fafc',
              color: dimDeceased ? 'white' : '#64748b',
              borderColor: dimDeceased ? '#1e293b' : '#e2e8f0', transition:'all 0.2s' }}>
            🌿 <span className="hide-mobile">{dimDeceased ? 'Asl holat' : 'Vafot etgan'}</span>
          </button>

          {/* 12. Share button */}
          <button onClick={() => setShowShare(v => !v)}
            title="Shajarani ulashish"
            style={{ display:'flex', alignItems:'center', gap:4, padding:'5px 12px',
              borderRadius:9, fontSize:11.5, fontWeight:700, cursor:'pointer', border:'1.5px solid',
              background: showShare
                ? 'linear-gradient(135deg,#0ea5e9,#6366f1)'
                : (isDark ? '#1e293b' : '#f8fafc'),
              color: showShare ? 'white' : (isDark ? '#94a3b8' : '#64748b'),
              borderColor: showShare ? '#0ea5e9' : (isDark ? '#334155' : '#e2e8f0'),
              transition:'all 0.2s' }}>
            🔗 <span className="hide-mobile">Ulashish</span>
          </button>

          {/* 5.3 Filter button */}
          <button onClick={() => setShowFilters(v => !v)}
            style={{ display:'flex', alignItems:'center', gap:4, padding:'5px 12px',
              borderRadius:9, fontSize:11.5, fontWeight:700, cursor:'pointer', border:'1.5px solid',
              background: showFilters || activeFilters > 0
                ? 'linear-gradient(135deg,#6366f1,#7c3aed)'
                : (isDark ? '#1e293b' : '#f8fafc'),
              color: showFilters || activeFilters > 0 ? 'white' : (isDark ? '#94a3b8' : '#64748b'),
              borderColor: showFilters || activeFilters > 0 ? '#6366f1' : (isDark ? '#334155' : '#e2e8f0'),
              transition:'all 0.2s', position: 'relative' }}>
            🔧 <span className="hide-mobile">Filter</span>
            {activeFilters > 0 && (
              <span style={{ position:'absolute', top:-6, right:-6, width:16, height:16,
                borderRadius:'50%', background:'#ef4444', color:'white',
                fontSize:9, fontWeight:900, display:'flex', alignItems:'center', justifyContent:'center',
                border:'2px solid white' }}>
                {activeFilters}
              </span>
            )}
          </button>
        </div>

        {/* Legend */}
        <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:10.5, color:'#64748b',
          paddingLeft:8, borderLeft:'1px solid #e2e8f0', flexShrink:0 }} className="hide-mobile">
          <span style={{ display:'flex', alignItems:'center', gap:3 }}>
            <span style={{ width:10, height:10, borderRadius:3, border:'2px solid #6366f1', display:'inline-block' }}/> Erkak
          </span>
          <span style={{ display:'flex', alignItems:'center', gap:3 }}>
            <span style={{ width:10, height:10, borderRadius:3, border:'2px solid #ec4899', display:'inline-block' }}/> Ayol
          </span>
          <span style={{ color:'#f43f5e', fontWeight:700 }}>⚭ Juftlar</span>
        </div>
      </div>

      {/* 5.3 Filter panel */}
      {showFilters && (
        <div style={{
          display:'flex', flexWrap:'wrap', alignItems:'center', gap:12,
          padding:'10px 14px', flexShrink:0,
          background: isDark ? '#0f172a' : '#f8fafc',
          borderBottom: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
        }}>
          <span style={{ fontSize:11, fontWeight:800, color: isDark ? '#818cf8' : '#6366f1',
            letterSpacing:'0.06em', textTransform:'uppercase' }}>
            🔧 Filtrlar
          </span>

          {/* Alive toggle */}
          <button onClick={() => setFilterAlive(v => !v)}
            style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 12px',
              borderRadius:20, fontSize:12, fontWeight:600, cursor:'pointer',
              border:`1.5px solid ${filterAlive ? '#10b981' : (isDark ? '#334155' : '#e2e8f0')}`,
              background: filterAlive ? '#d1fae5' : 'transparent',
              color: filterAlive ? '#065f46' : (isDark ? '#94a3b8' : '#64748b'),
              transition:'all 0.2s' }}>
            💚 Faqat tiriklar
            {filterAlive && <span style={{ fontSize:10, background:'#10b981', color:'white',
              borderRadius:'50%', width:14, height:14, display:'flex', alignItems:'center',
              justifyContent:'center', fontWeight:900 }}>✓</span>}
          </button>

          {/* Gender filter */}
          <div style={{ display:'flex', gap:4 }}>
            {[['all','👥 Hammasi'],['male','👨 Erkaklar'],['female','👩 Ayollar']].map(([val, label]) => (
              <button key={val} onClick={() => setFilterGender(val)}
                style={{ padding:'5px 10px', borderRadius:20, fontSize:11, fontWeight:600,
                  cursor:'pointer', border:'1.5px solid',
                  borderColor: filterGender===val ? (val==='male' ? '#6366f1' : val==='female' ? '#ec4899' : '#6366f1') : (isDark ? '#334155' : '#e2e8f0'),
                  background: filterGender===val
                    ? (val==='male' ? '#eef2ff' : val==='female' ? '#fff0f8' : '#eef2ff')
                    : 'transparent',
                  color: filterGender===val
                    ? (val==='male' ? '#4f46e5' : val==='female' ? '#db2777' : '#4f46e5')
                    : (isDark ? '#94a3b8' : '#64748b'),
                  transition:'all 0.15s' }}>
                {label}
              </button>
            ))}
          </div>

          {/* Generation filter */}
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ fontSize:11, color: isDark ? '#94a3b8' : '#64748b', fontWeight:600 }}>
              Avlod:
            </span>
            <div style={{ display:'flex', gap:3 }}>
              <button onClick={() => setFilterGen(0)}
                style={{ padding:'4px 10px', borderRadius:20, fontSize:11, fontWeight:600,
                  cursor:'pointer', border:`1.5px solid ${filterGen===0 ? '#6366f1' : (isDark ? '#334155' : '#e2e8f0')}`,
                  background: filterGen===0 ? '#eef2ff' : 'transparent',
                  color: filterGen===0 ? '#4f46e5' : (isDark ? '#94a3b8' : '#64748b'),
                  transition:'all 0.15s' }}>
                Barchasi
              </button>
              {Array.from({ length: maxGen }, (_, i) => i + 1).map(g => (
                <button key={g} onClick={() => setFilterGen(g)}
                  style={{ padding:'4px 8px', borderRadius:20, fontSize:11, fontWeight:700,
                    cursor:'pointer', border:`1.5px solid ${filterGen===g ? '#7c3aed' : (isDark ? '#334155' : '#e2e8f0')}`,
                    background: filterGen===g ? 'linear-gradient(135deg,#6366f1,#7c3aed)' : 'transparent',
                    color: filterGen===g ? 'white' : (isDark ? '#94a3b8' : '#64748b'),
                    transition:'all 0.15s', minWidth:28, textAlign:'center' }}>
                  {g}
                </button>
              ))}
            </div>
          </div>

          {/* Reset */}
          {activeFilters > 0 && (
            <button onClick={() => { setFilterAlive(false); setFilterGender('all'); setFilterGen(0) }}
              style={{ marginLeft:'auto', padding:'5px 12px', borderRadius:20, fontSize:11, fontWeight:700,
                cursor:'pointer', border:'1.5px solid #ef4444',
                background:'#fee2e2', color:'#dc2626', transition:'all 0.15s' }}>
              ✕ Filtrlarni tozalash
            </button>
          )}
        </div>
      )}

      {/* 12. Share panel */}
      {showShare && (
        <div style={{
          padding:'14px 16px', flexShrink:0,
          background: isDark ? '#0f172a' : '#f0f9ff',
          borderBottom: `1px solid ${isDark ? '#1e3a5f' : '#bae6fd'}`,
        }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontSize:15 }}>🔗</span>
              <span style={{ fontSize:12, fontWeight:800, color: isDark ? '#38bdf8' : '#0369a1',
                textTransform:'uppercase', letterSpacing:'0.06em' }}>Shajarani ulashish</span>
              <span style={{ fontSize:11, color: isDark ? '#64748b' : '#94a3b8', fontWeight:500 }}>
                (7 kunlik vaqtinchalik havola)
              </span>
            </div>
            <button onClick={handleCreateShareLink} disabled={shareCreating}
              style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 14px',
                borderRadius:9, fontSize:12, fontWeight:700, cursor:'pointer', border:'none',
                background: shareCreating ? '#e2e8f0' : 'linear-gradient(135deg,#0ea5e9,#6366f1)',
                color: shareCreating ? '#94a3b8' : 'white',
                boxShadow: shareCreating ? 'none' : '0 3px 10px rgba(14,165,233,0.35)',
                transition:'all 0.2s' }}>
              {shareCreating ? '⏳' : '➕'} Yangi havola
            </button>
          </div>

          {shareLoading ? (
            <div style={{ fontSize:12, color:'#94a3b8', padding:'8px 0' }}>Yuklanmoqda...</div>
          ) : shareLinks.length === 0 ? (
            <div style={{ fontSize:12, color: isDark ? '#64748b' : '#94a3b8', padding:'6px 0' }}>
              Hozircha havolalar yo'q. "Yangi havola" tugmasini bosing.
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {shareLinks.map(lnk => {
                const url = `${window.location.origin}/s/${lnk.token}`
                const exp = new Date(lnk.expires_at)
                const expired = new Date() > exp
                return (
                  <div key={lnk.id} style={{
                    display:'flex', alignItems:'center', gap:10, padding:'8px 12px',
                    borderRadius:11, background: isDark ? '#1e293b' : 'white',
                    border: `1.5px solid ${expired ? '#fca5a5' : (isDark ? '#1e3a5f' : '#bae6fd')}`,
                    opacity: expired ? 0.6 : 1,
                  }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:11.5, fontWeight:700,
                        color: isDark ? '#f1f5f9' : '#0f172a',
                        overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {url}
                      </div>
                      <div style={{ fontSize:10, color: expired ? '#ef4444' : (isDark ? '#64748b' : '#94a3b8'), marginTop:1 }}>
                        {expired ? '⛔ Muddati tugagan' : `✅ Amal qilish muddati: ${exp.toLocaleDateString('uz-UZ')}`}
                        {' · '}👁 {lnk.view_count} marta ko'rildi
                      </div>
                    </div>
                    <button onClick={() => handleCopyLink(lnk.token)}
                      style={{ padding:'5px 10px', borderRadius:8, fontSize:11, fontWeight:700,
                        border:'none', cursor:'pointer',
                        background:'linear-gradient(135deg,#0ea5e9,#6366f1)', color:'white',
                        flexShrink:0 }}>
                      📋 Nusxa
                    </button>
                    <button onClick={() => handleDeleteShareLink(lnk.id)}
                      style={{ padding:'5px 10px', borderRadius:8, fontSize:11, fontWeight:700,
                        border:'1.5px solid #fca5a5', cursor:'pointer',
                        background: isDark ? '#1e293b' : '#fee2e2', color:'#ef4444',
                        flexShrink:0 }}>
                      🗑️
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* List view (mobil yoki toggle) */}
      {viewMode === 'list' && (
        <MobileListView
          rawPersons={rawPersons}
          onPersonClick={handlePersonClick}
          toolbarSearch={search}
          user={user}
        />
      )}

      {/* Canvas — har doim DOM da, lekin list rejimida joy egallamas */}
      <HoverCtx.Provider value={{ hoveredId, connectedIds: hoveredConnectedIds }}>
      <div
        style={{
          flex: viewMode === 'tree' ? 1 : 0,
          minHeight: 0,
          overflow: viewMode === 'tree' ? 'visible' : 'hidden',
          position:'relative',
          opacity: viewMode !== 'tree' ? 0 : (loading ? 0 : 1),
          pointerEvents: viewMode !== 'tree' ? 'none' : 'auto',
          transition: 'opacity 0.45s ease',
          zIndex: viewMode !== 'tree' ? -1 : 0,
        }}
        ref={flowRef}
      >
        <ReactFlow
          nodes={visibleNodes} edges={hoveredEdges}
          onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes} edgeTypes={edgeTypes}
          minZoom={0.04} maxZoom={2.5}
          attributionPosition="bottom-left"
          onlyRenderVisibleElements={rawPersons.length > 60}
          nodesDraggable={true}
          onNodeDragStop={handleNodeDragStop}
          onNodeMouseEnter={(_e, node) => { if (node.type === 'personNode') setHoveredId(node.id) }}
          onNodeMouseLeave={() => setHoveredId(null)}
          style={{ background: isDark
            ? 'linear-gradient(150deg,#1e1b4b 0%,#1e1433 50%,#1e1428 100%)'
            : 'linear-gradient(150deg,#eef2ff 0%,#f5f0ff 50%,#fdf4ff 100%)' }}
        >
          <Background variant="dots" color={isDark ? '#4f46e580' : '#c7d2fe'} gap={30} size={1.4} />
          {/* Custom silliq Controls */}
          <div style={{
            position: 'absolute', bottom: isMobile ? 66 : 24, left: isMobile ? 10 : 16, zIndex: 5,
            display: 'flex', flexDirection: 'column', gap: isMobile ? 3 : 4,
          }}>
            {[
              { icon: '+', title: "Kattalashtirish",  onClick: () => zoomIn({ duration: 350 }) },
              { icon: '−', title: "Kichiklashtirish", onClick: () => zoomOut({ duration: 350 }) },
              { icon: '⊡', title: "Ekranga moslashtirish", onClick: () => fitView({ padding: 0.12, duration: 700 }) },
            ].map(({ icon, title, onClick }) => (
              <button
                key={icon}
                title={title}
                onClick={onClick}
                className="tree-zoom-btn"
                style={{
                  width: 32, height: 32,
                  borderRadius: 10,
                  border: isDark ? '1.5px solid rgba(99,102,241,0.3)' : '1.5px solid rgba(99,102,241,0.22)',
                  background: isDark ? 'rgba(30,27,75,0.82)' : 'rgba(255,255,255,0.92)',
                  color: isDark ? '#a5b4fc' : '#6366f1',
                  backdropFilter: 'blur(10px)',
                  boxShadow: isDark ? '0 2px 10px rgba(0,0,0,0.4)' : '0 2px 10px rgba(99,102,241,0.15)',
                  cursor: 'pointer',
                  fontSize: icon === '+' || icon === '−' ? 20 : 14,
                  fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.15s, border-color 0.15s, transform 0.12s, color 0.15s',
                  lineHeight: 1,
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = isDark ? 'rgba(99,102,241,0.55)' : 'rgba(99,102,241,0.12)'
                  e.currentTarget.style.borderColor = '#818cf8'
                  e.currentTarget.style.color = isDark ? '#fff' : '#4f46e5'
                  e.currentTarget.style.transform = 'scale(1.1)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = isDark ? 'rgba(30,27,75,0.82)' : 'rgba(255,255,255,0.92)'
                  e.currentTarget.style.borderColor = isDark ? 'rgba(99,102,241,0.3)' : 'rgba(99,102,241,0.22)'
                  e.currentTarget.style.color = isDark ? '#a5b4fc' : '#6366f1'
                  e.currentTarget.style.transform = 'scale(1)'
                }}
              >
                {icon}
              </button>
            ))}
          </div>
          {!isMobile && (
            <MiniMap
              nodeColor={n => {
                if (n.type === 'coupleNode') return '#f97316'
                if (n.type === 'genLabel')   return '#6366f1'
                return n.data?.gender === 'male' ? '#818cf8' : '#f472b6'
              }}
              nodeStrokeWidth={0}
              maskColor={isDark ? 'rgba(15,23,42,0.72)' : 'rgba(241,245,253,0.72)'}
              style={{
                right: 14, bottom: 120, top: 'auto',
                width: 130, height: 80,
                borderRadius: 12,
                background: isDark ? 'rgba(15,23,42,0.85)' : 'rgba(255,255,255,0.88)',
                backdropFilter: 'blur(10px)',
                border: isDark ? '1px solid rgba(99,102,241,0.25)' : '1px solid rgba(99,102,241,0.18)',
                boxShadow: isDark
                  ? '0 4px 20px rgba(0,0,0,0.45)'
                  : '0 4px 20px rgba(99,102,241,0.15)',
              }}
            />
          )}
          {/* Mobile: Shajara nomi — faqat mobil ekranda ko'rinadi */}
          {isMobile && !loading && rawPersons.length > 0 && (
            <Panel position="top-center" style={{ marginTop: 8 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 7,
                background: isDark
                  ? 'rgba(30,27,75,0.88)'
                  : 'rgba(255,255,255,0.92)',
                border: `1.5px solid rgba(99,102,241,0.35)`,
                borderRadius: 20, padding: '5px 14px',
                backdropFilter: 'blur(12px)',
                boxShadow: isDark
                  ? '0 4px 20px rgba(0,0,0,0.5)'
                  : '0 4px 20px rgba(99,102,241,0.18)',
              }}>
                <span style={{ fontSize: 14, lineHeight: 1 }}>🌳</span>
                <span style={{
                  fontSize: 12, fontWeight: 900,
                  background: 'linear-gradient(135deg,#818cf8,#c084fc)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                  letterSpacing: '-0.2px', whiteSpace: 'nowrap',
                }}>Matayev &amp; Abdumannonovlar</span>
                <span style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: '0.12em',
                  textTransform: 'uppercase', color: '#f59e0b', opacity: 0.9,
                }}>✦ Shajarasi ✦</span>
              </div>
            </Panel>
          )}

          {focusId && !loading && (
            <Panel position="bottom-center" style={{ marginBottom: 8 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                background: isDark ? 'rgba(30,20,0,0.92)' : 'rgba(255,255,255,0.96)',
                border: '2px solid #f59e0b',
                borderRadius: 14, padding: '9px 18px',
                boxShadow: '0 4px 24px rgba(245,158,11,0.25)',
                fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap',
                color: isDark ? '#fde68a' : '#92400e',
              }}>
                <span style={{ fontSize: 16 }}>🎯</span>
                <span>
                  <b>Focus rejimi faol.</b>{' '}
                  Chiqish uchun: kartadagi <b>🎯</b> tugmasini bosing yoki
                </span>
                <button
                  onClick={() => { setFocusId(null); lastClickedId.current = null }}
                  style={{
                    padding: '4px 13px', borderRadius: 9, border: '1.5px solid #f59e0b',
                    background: '#f59e0b', color: 'white', fontWeight: 700,
                    cursor: 'pointer', fontSize: 12,
                  }}>
                  ✕ Chiqish
                </button>
              </div>
            </Panel>
          )}
        </ReactFlow>

        {/* ── Deceased stat panels — rendered into document.body so position:fixed works ── */}
        {dimDeceased && extraStats && createPortal(
          <>
            <style>{`
              @keyframes statSlideL {
                from { opacity:0; transform:translateY(-50%) translateX(-40px) scale(0.9) }
                to   { opacity:1; transform:translateY(-50%) translateX(0)     scale(1)   }
              }
              @keyframes statSlideR {
                from { opacity:0; transform:translateY(-50%) translateX(40px)  scale(0.9) }
                to   { opacity:1; transform:translateY(-50%) translateX(0)     scale(1)   }
              }
            `}</style>

            {/* LEFT — Tiriklar */}
            <div style={{
              position:'fixed', left:280, top:60,
              zIndex:9999, pointerEvents:'none',
              display:'flex', flexDirection:'column', gap:10,
              animation:'statSlideL 0.55s cubic-bezier(.16,1,.3,1) both',
            }}>
              <StatPanel
                accent="#22c55e"
                title="💚 Tiriklar"
                count={extraStats.aliveCount}
                pct={extraStats.alivePct}
                sub1label="👨 Erkak"
                sub1val={rawPersons.filter(p=>p.gender==='male'&&!p.death_date&&!p.deceased&&!p.is_deceased).length}
                sub2label="👩 Ayol"
                sub2val={rawPersons.filter(p=>p.gender!=='male'&&!p.death_date&&!p.deceased&&!p.is_deceased).length}
                extra={extraStats.avgAge ? `O'rtacha yosh: ${extraStats.avgAge}` : null}
                isDark={isDark}
              />
            </div>

            {/* RIGHT — Vafot etganlar */}
            <div style={{
              position:'fixed', right:200, top:60,
              zIndex:9999, pointerEvents:'none',
              display:'flex', flexDirection:'column', gap:10,
              animation:'statSlideR 0.55s cubic-bezier(.16,1,.3,1) both',
            }}>
              <StatPanel
                accent="#94a3b8"
                title="🕯️ Vafot etganlar"
                count={extraStats.deadCount}
                pct={extraStats.deadPct}
                sub1label="👨 Erkak"
                sub1val={extraStats.deadMales}
                sub2label="👩 Ayol"
                sub2val={extraStats.deadCount - extraStats.deadMales}
                extra={extraStats.avgDeadAge ? `O'rtacha umr: ${extraStats.avgDeadAge} yosh` : null}
                isDark={isDark}
              />
            </div>
          </>,
          document.body
        )}

        {!loading && rawPersons.length === 0 && (
          <TreeEmptyState navigate={navigate} isDark={isDark} />
        )}
      </div>
      </HoverCtx.Provider>
    </div>
  )
}

export default function TreePage() {
  const [rawPersons, setRawPersons] = useState([])
  const [stats, setStats] = useState(null)
  useEffect(() => {
    getTree().then(r => setRawPersons(r.data.nodes.map(n => n.data)))
    getStatistics().then(r => setStats(r.data))
  }, [])
  return (
    <div style={{ height:'100vh' }}>
      <ReactFlowProvider>
        <TreeFlow rawPersons={rawPersons} stats={stats} />
      </ReactFlowProvider>
    </div>
  )
}
