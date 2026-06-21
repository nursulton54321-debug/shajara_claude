import { useEffect, useRef, useState } from 'react'

/**
 * Sahifa ochilganda raqamni animatsion ravishda hisoblaydi.
 * Barcha sahifalarda ishlatish uchun.
 */
export default function AnimCount({ to = 0, duration = 1000, suffix = '' }) {
  const [val, setVal] = useState(0)
  const raf = useRef(null)

  useEffect(() => {
    if (!to) { setVal(0); return }
    let start = null
    const step = (ts) => {
      if (!start) start = ts
      const p = Math.min((ts - start) / duration, 1)
      const ease = 1 - Math.pow(1 - p, 3)
      setVal(Math.round(ease * to))
      if (p < 1) raf.current = requestAnimationFrame(step)
    }
    raf.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf.current)
  }, [to, duration])

  return <>{val}{suffix}</>
}
