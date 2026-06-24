import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const THEMES = [
  { id: 'indigo',   name: 'Indigo',   emoji: '🌌', p: '#4f46e5', s: '#7c3aed', grad: 'linear-gradient(135deg,#4f46e5,#7c3aed)' },
  { id: 'ocean',    name: 'Ocean',    emoji: '🌊', p: '#0ea5e9', s: '#06b6d4', grad: 'linear-gradient(135deg,#0ea5e9,#06b6d4)' },
  { id: 'emerald',  name: 'Emerald',  emoji: '🌿', p: '#10b981', s: '#059669', grad: 'linear-gradient(135deg,#10b981,#059669)' },
  { id: 'rose',     name: 'Rose',     emoji: '🌸', p: '#f43f5e', s: '#e11d48', grad: 'linear-gradient(135deg,#f43f5e,#e11d48)' },
  { id: 'amber',    name: 'Amber',    emoji: '🌅', p: '#f59e0b', s: '#d97706', grad: 'linear-gradient(135deg,#f59e0b,#d97706)' },
  { id: 'violet',   name: 'Violet',   emoji: '🪐', p: '#8b5cf6', s: '#6d28d9', grad: 'linear-gradient(135deg,#8b5cf6,#6d28d9)' },
  { id: 'fuchsia',  name: 'Fuchsia',  emoji: '💜', p: '#d946ef', s: '#a21caf', grad: 'linear-gradient(135deg,#d946ef,#a21caf)' },
  { id: 'slate',    name: 'Slate',    emoji: '🪨', p: '#64748b', s: '#475569', grad: 'linear-gradient(135deg,#64748b,#475569)' },
]

export const FONTS = [
  { id: 'inter',     name: 'Inter',          family: "'Inter', sans-serif",                     google: 'Inter:wght@400;600;700;800;900' },
  { id: 'poppins',   name: 'Poppins',        family: "'Poppins', sans-serif",                   google: 'Poppins:wght@400;600;700;800;900' },
  { id: 'roboto',    name: 'Roboto',         family: "'Roboto', sans-serif",                    google: 'Roboto:wght@400;500;700;900' },
  { id: 'nunito',    name: 'Nunito',         family: "'Nunito', sans-serif",                    google: 'Nunito:wght@400;600;700;800;900' },
  { id: 'mono',      name: 'JetBrains Mono', family: "'JetBrains Mono', monospace",             google: 'JetBrains+Mono:wght@400;600;700;800' },
]

export const FONT_SIZES = [
  { id: 'sm', name: 'Kichik',   label: 'A', base: '12px' },
  { id: 'md', name: "O'rtacha", label: 'A', base: '14px' },
  { id: 'lg', name: 'Katta',    label: 'A', base: '16px' },
]

function applyDesign({ themeId, fontId, fontSizeId }) {
  const theme    = THEMES.find(t => t.id === themeId)    || THEMES[0]
  const font     = FONTS.find(f => f.id === fontId)      || FONTS[0]
  const fontSize = FONT_SIZES.find(s => s.id === fontSizeId) || FONT_SIZES[1]

  // CSS variables
  const root = document.documentElement
  root.style.setProperty('--accent',        theme.p)
  root.style.setProperty('--accent2',       theme.s)
  root.style.setProperty('--accent-grad',   theme.grad)
  root.style.setProperty('--accent-light',  theme.p + '20')
  root.style.setProperty('--accent-glow',   theme.p + '55')
  root.style.setProperty('--font-family',   font.family)
  root.style.setProperty('--font-base',     fontSize.base)

  // Apply to body
  document.body.style.fontFamily = font.family
  document.body.style.fontSize   = fontSize.base

  // Google Fonts — link elementni yangilaymiz
  let link = document.getElementById('gfont')
  if (!link) {
    link = document.createElement('link')
    link.id   = 'gfont'
    link.rel  = 'stylesheet'
    document.head.appendChild(link)
  }
  link.href = `https://fonts.googleapis.com/css2?family=${font.google}&display=swap`

  // data-theme atributi (CSS qoidalar uchun)
  root.setAttribute('data-theme', themeId)
}

const useDesignStore = create(persist(
  (set, get) => ({
    themeId:    'indigo',
    fontId:     'inter',
    fontSizeId: 'md',

    setTheme:    (themeId)    => { set({ themeId });    applyDesign({ ...get(), themeId }) },
    setFont:     (fontId)     => { set({ fontId });     applyDesign({ ...get(), fontId }) },
    setFontSize: (fontSizeId) => { set({ fontSizeId }); applyDesign({ ...get(), fontSizeId }) },

    init: () => applyDesign(get()),
  }),
  { name: 'design' }
))

export default useDesignStore
