/**
 * Shajara PDF eksporti — jsPDF yordamida chiroyli oila hujjati
 */
import { jsPDF } from 'jspdf'

// Ranglar
const C = {
  primary:  [79,  70,  229],
  violet:   [124, 58,  237],
  male:     [99,  102, 241],
  female:   [236, 72,  153],
  dark:     [15,  23,  42],
  text:     [30,  41,  59],
  muted:    [100, 116, 139],
  light:    [241, 245, 249],
  white:    [255, 255, 255],
  gold:     [217, 119, 6],
  green:    [16,  185, 129],
  gray:     [148, 163, 184],
  border:   [226, 232, 240],
}

function rgb(doc, type, color) {
  if (type === 'fill') doc.setFillColor(...color)
  else if (type === 'text') doc.setTextColor(...color)
  else doc.setDrawColor(...color)
}

// ── Asosiy eksport funksiyasi ──────────────────────────────────────
export async function exportFamilyPDF({ persons, genStats, stats }) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210, H = 297, PAD = 14
  const today = new Date().toLocaleDateString('ru-RU') // 09.06.2026 formatda

  // ═══════════════════════════════════════════════════════════════
  // 1-SAHIFA: Muqova
  // ═══════════════════════════════════════════════════════════════

  // Ustki gradient fon (to'q indigo)
  rgb(doc, 'fill', C.primary)
  doc.rect(0, 0, W, 75, 'F')
  rgb(doc, 'fill', C.violet)
  doc.rect(0, 55, W, 22, 'F')

  // Sarlavha
  doc.setFontSize(30)
  doc.setFont('helvetica', 'bold')
  rgb(doc, 'text', C.white)
  doc.text('OILA SHAJARASI', W / 2, 38, { align: 'center' })

  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  rgb(doc, 'text', [199, 210, 254])
  doc.text('Family Tree Document', W / 2, 48, { align: 'center' })

  // Oltin chiziq
  rgb(doc, 'fill', C.gold)
  doc.rect(PAD * 4, 53, W - PAD * 8, 1.5, 'F')

  // Sana
  doc.setFontSize(9)
  rgb(doc, 'text', C.white)
  doc.text(today, W / 2, 63, { align: 'center' })

  // ── 4 ta stat karta ──────────────────────────────────────────
  const cardData = [
    { label: 'Jami shaxslar',  value: stats.total,     color: C.primary },
    { label: 'Erkaklar',       value: stats.male,      color: C.male   },
    { label: 'Ayollar',        value: stats.female,    color: C.female },
    { label: 'Avlodlar',       value: genStats.length, color: C.green  },
  ]
  const cW = (W - PAD * 2 - 9) / 4, cH = 26, cY = 84

  cardData.forEach((c, i) => {
    const cx = PAD + i * (cW + 3)
    rgb(doc, 'fill', c.color)
    doc.roundedRect(cx, cY, cW, cH, 3, 3, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(17)
    rgb(doc, 'text', C.white)
    doc.text(String(c.value), cx + cW / 2, cY + 12, { align: 'center' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.text(c.label, cx + cW / 2, cY + 21, { align: 'center' })
  })

  // ── Avlodlar taqsimoti bar ───────────────────────────────────
  let y = 122
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  rgb(doc, 'text', C.dark)
  doc.text('Avlodlar taqsimoti', PAD, y)
  y += 7

  const barAreaW = W - PAD * 2 - 30
  genStats.forEach(g => {
    const filledW = stats.total > 0 ? (g.total / stats.total) * barAreaW : 0
    const mW = g.total > 0 ? (g.male / g.total) * filledW : 0
    const fW = g.total > 0 ? (g.female / g.total) * filledW : 0

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    rgb(doc, 'text', C.muted)
    doc.text(g.name, PAD, y + 4)

    rgb(doc, 'fill', C.light)
    doc.roundedRect(PAD + 20, y, barAreaW, 6, 1, 1, 'F')
    if (mW > 0) { rgb(doc, 'fill', C.male);   doc.roundedRect(PAD + 20, y, mW, 6, 1, 1, 'F') }
    if (fW > 0) { rgb(doc, 'fill', C.female); doc.roundedRect(PAD + 20 + mW, y, fW, 6, 0, 0, 'F') }

    rgb(doc, 'text', C.text)
    doc.setFontSize(7.5)
    doc.text(`${g.total} kishi`, W - PAD, y + 4, { align: 'right' })
    if (g.avgAge) {
      rgb(doc, 'text', C.muted)
      doc.text(`o'rt. ${g.avgAge}y`, W - PAD - 18, y + 4, { align: 'right' })
    }
    y += 10
  })

  // ── Umumiy statistika qutilari ───────────────────────────────
  y += 4
  const sBoxes = [
    { label: 'Tirik',        value: stats.alive,    color: C.green },
    { label: 'Vafot etgan',  value: stats.deceased, color: C.gray  },
    { label: "O'rtacha yosh", value: (() => {
      const ages = persons.map(p => {
        if (!p.birth_date) return null
        const e = p.death_date ? new Date(p.death_date+'T00:00:00') : new Date()
        return Math.floor((e - new Date(p.birth_date+'T00:00:00')) / (365.25*86400000))
      }).filter(a => a != null && a >= 0)
      return ages.length ? Math.round(ages.reduce((a,b)=>a+b,0)/ages.length) + ' yosh' : '—'
    })(), color: C.primary },
  ]
  const sbW = (W - PAD * 2 - 6) / 3
  sBoxes.forEach((sb, i) => {
    const sx = PAD + i * (sbW + 3)
    rgb(doc, 'fill', C.light)
    doc.roundedRect(sx, y, sbW, 18, 3, 3, 'F')
    rgb(doc, 'fill', sb.color)
    doc.roundedRect(sx, y, 3, 18, 2, 2, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    rgb(doc, 'text', sb.color)
    doc.text(String(sb.value), sx + sbW / 2 + 1, y + 8, { align: 'center' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    rgb(doc, 'text', C.muted)
    doc.text(sb.label, sx + sbW / 2 + 1, y + 15, { align: 'center' })
  })

  // Footer
  _footer(doc, W, H, PAD, today, 1)

  // ═══════════════════════════════════════════════════════════════
  // 2+ SAHIFALAR: Avlod bo'yicha shaxslar
  // ═══════════════════════════════════════════════════════════════
  const COLS = 2
  const CW = (W - PAD * 2 - 6) / COLS
  const CH = 36
  const AV = 6.5   // avatar radius

  let pageNum = 2

  for (const gs of genStats) {
    const genPersons = gs._persons || []
    if (!genPersons.length) continue

    doc.addPage()
    _genHeader(doc, W, PAD, gs)
    y = 22
    let col = 0

    for (const p of genPersons) {
      if (y + CH + 4 > H - 18) {
        _footer(doc, W, H, PAD, today, pageNum++)
        doc.addPage()
        _subHeader(doc, W, PAD, gs.name)
        y = 18; col = 0
      }

      const cx = PAD + col * (CW + 6)
      _personCard(doc, p, cx, y, CW, CH, AV)

      col++
      if (col >= COLS) { col = 0; y += CH + 5 }
    }

    if (col > 0) y += CH + 5
    _footer(doc, W, H, PAD, today, pageNum++)
  }

  doc.save(`shajara-${new Date().toISOString().slice(0, 10)}.pdf`)
}

// ── Yordamchi funksiyalar ─────────────────────────────────────────

function _footer(doc, W, H, PAD, date, pageNum) {
  rgb(doc, 'fill', C.light)
  doc.rect(0, H - 14, W, 14, 'F')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  rgb(doc, 'text', C.muted)
  doc.text('Shajara — Oila Shajarasi Tizimi  |  ' + date, PAD, H - 5)
  doc.text('Sahifa ' + pageNum, W - PAD, H - 5, { align: 'right' })
}

function _genHeader(doc, W, PAD, gs) {
  rgb(doc, 'fill', C.primary)
  doc.rect(0, 0, W, 16, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  rgb(doc, 'text', C.white)
  doc.text(gs.name.toUpperCase() + '  —  ' + gs.total + ' ta shaxs', PAD, 11)
  if (gs.avgAge) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    rgb(doc, 'text', [199, 210, 254])
    doc.text("O'rtacha yosh: " + gs.avgAge, W - PAD, 11, { align: 'right' })
  }
}

function _subHeader(doc, W, PAD, name) {
  rgb(doc, 'fill', C.light)
  doc.rect(0, 0, W, 12, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  rgb(doc, 'text', C.primary)
  doc.text(name + ' (davomi)', PAD, 8)
}

function _personCard(doc, p, cx, y, CW, CH, AV) {
  const isMale = p.gender === 'male'
  const accentColor = isMale ? C.male : C.female
  const bgColor     = isMale ? [238, 242, 255] : [255, 240, 248]

  // Karta fon
  rgb(doc, 'fill', bgColor)
  doc.roundedRect(cx, y, CW, CH, 3, 3, 'F')

  // Chap yon rang chizig'i
  rgb(doc, 'fill', accentColor)
  doc.roundedRect(cx, y, 3, CH, 2, 2, 'F')

  // Avatar doira
  const avX = cx + 3 + AV + 5
  const avY = y + CH / 2
  rgb(doc, 'fill', isMale ? [221, 228, 255] : [255, 221, 241])
  doc.circle(avX, avY, AV, 'F')

  // Jins belgisi
  doc.setFontSize(8)
  rgb(doc, 'text', accentColor)
  doc.text(isMale ? 'E' : 'A', avX, avY + 2.5, { align: 'center' })

  // Ism
  const tx = cx + 3 + AV * 2 + 10
  const maxW = CW - AV * 2 - 16
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  rgb(doc, 'text', C.dark)
  const name = doc.splitTextToSize(p.full_name || '—', maxW)[0]
  doc.text(name, tx, y + 9)

  // Tug'ilgan sana + yosh
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  rgb(doc, 'text', C.muted)
  let line1 = ''
  if (p.birth_date) {
    const bd = new Date(p.birth_date + 'T00:00:00')
    line1 = bd.toLocaleDateString('ru-RU')
  }
  if (p.age != null) line1 += (line1 ? ' · ' : '') + p.age + ' yosh'
  if (line1) doc.text(line1, tx, y + 16)

  // Vafot etgan
  if (p.death_date) {
    doc.setFontSize(7)
    rgb(doc, 'text', C.gray)
    const dd = new Date(p.death_date + 'T00:00:00')
    doc.text('† ' + dd.toLocaleDateString('ru-RU'), tx, y + 22)
  }

  // Tug'ilgan joy
  if (p.birth_place) {
    doc.setFontSize(7)
    rgb(doc, 'text', C.muted)
    const bpY = p.death_date ? 29 : 22
    doc.text(p.birth_place.slice(0, 28), tx, y + bpY)
  }

  // Telefon (o'ng pastda)
  if (p.phone) {
    doc.setFontSize(6.5)
    rgb(doc, 'text', accentColor)
    doc.text(p.phone, cx + CW - 3, y + CH - 4, { align: 'right' })
  }
}
