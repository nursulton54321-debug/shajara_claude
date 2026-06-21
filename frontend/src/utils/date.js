/**
 * Loyiha bo'ylab yagona sana formatlash — kk.oo.yyyy
 */
export function fmtDate(d) {
  if (!d) return '—'
  const dt = new Date(String(d).length === 10 ? d + 'T00:00:00' : d)
  if (isNaN(dt.getTime())) return '—'
  const dd = String(dt.getDate()).padStart(2, '0')
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  return `${dd}.${mm}.${dt.getFullYear()}`
}

/** 23.05.2024 15:30 */
export function fmtDateTime(d) {
  if (!d) return '—'
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return '—'
  const HH = String(dt.getHours()).padStart(2, '0')
  const MM = String(dt.getMinutes()).padStart(2, '0')
  return `${fmtDate(d)} ${HH}:${MM}`
}
