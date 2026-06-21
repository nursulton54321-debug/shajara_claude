import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useChatStore = create(persist(
  (set) => ({
    open: false,
    messages: [],
    enabled: true,

    setOpen:    (open)     => set({ open }),
    setEnabled: (enabled)  => set({ enabled }),
    addMessage: (msg)      => set(s => ({ messages: [...s.messages, msg] })),
    clearMessages: ()      => set({ messages: [] }),
    // array yoki updater function (prev => newArr) qabul qiladi
    setMessages: (arg) => set(s => ({
      messages: typeof arg === 'function' ? arg(s.messages) : arg
    })),
  }),
  {
    name: 'ai_chat',
    partialize: (s) => ({
      messages: s.messages.slice(-50), // oxirgi 50 ta xabar
      enabled: s.enabled,
    }),
  }
))

export default useChatStore
