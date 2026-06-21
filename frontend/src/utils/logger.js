/**
 * Production-safe logger.
 * Development: barcha loglar chiqadi.
 * Production (NODE_ENV=production): faqat xatolar chiqadi, warn/log o'chiriladi.
 */
const isDev = import.meta.env.DEV

const logger = {
  log:   (...args) => { if (isDev) console.log(...args) },
  warn:  (...args) => { if (isDev) console.warn(...args) },
  error: (...args) => { if (isDev) console.error(...args) },
  info:  (...args) => { if (isDev) console.info(...args) },
}

export default logger
