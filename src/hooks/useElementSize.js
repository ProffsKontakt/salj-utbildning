import { useEffect, useState } from 'react'

/** Observe an element's content box size. Returns { width, height } in CSS px. */
export function useElementSize(ref) {
  const [size, setSize] = useState({ width: 0, height: 0 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let frame = 0
    const update = () => {
      const r = el.getBoundingClientRect()
      setSize((s) => {
        const w = Math.round(r.width)
        const h = Math.round(r.height)
        return s.width === w && s.height === h ? s : { width: w, height: h }
      })
    }
    update()
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(update)
    })
    ro.observe(el)
    return () => {
      cancelAnimationFrame(frame)
      ro.disconnect()
    }
  }, [ref])
  return size
}
