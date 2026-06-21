import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useThemeStore = create(persist(
  (set, get) => ({
    isDark: false,

    toggle: () => {
      const next = !get().isDark
      set({ isDark: next })
      applyTheme(next)
    },

    init: () => {
      applyTheme(get().isDark)
    },
  }),
  { name: 'theme' }
))

function applyTheme(dark) {
  if (dark) {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}

export default useThemeStore
