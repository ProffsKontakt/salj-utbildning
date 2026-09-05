const dateFmt = new Intl.DateTimeFormat('sv-SE', { day: 'numeric', month: 'long', year: 'numeric' })
const shortDateFmt = new Intl.DateTimeFormat('sv-SE', { day: 'numeric', month: 'short' })
const weekdayFmt = new Intl.DateTimeFormat('sv-SE', { weekday: 'long' })

/** Parse 'YYYY-MM-DD' into a local Date (no timezone shift). */
export function parseIsoDate(iso) {
  if (!iso) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

export function formatDate(iso) {
  const d = parseIsoDate(iso)
  return d ? dateFmt.format(d) : ''
}

export function formatShortDate(iso) {
  const d = parseIsoDate(iso)
  return d ? shortDateFmt.format(d) : ''
}

export function formatWeekday(iso) {
  const d = parseIsoDate(iso)
  if (!d) return ''
  const s = weekdayFmt.format(d)
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function todayIso() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** Days from today to the given ISO date (negative = past). */
export function daysUntil(iso) {
  const d = parseIsoDate(iso)
  if (!d) return null
  const t = parseIsoDate(todayIso())
  return Math.round((d - t) / 86400000)
}

export function relativeDay(iso) {
  const n = daysUntil(iso)
  if (n === null) return ''
  if (n === 0) return 'Idag'
  if (n === 1) return 'Imorgon'
  if (n === -1) return 'Igår'
  if (n > 1 && n < 14) return `Om ${n} dagar`
  if (n < -1 && n > -14) return `${-n} dagar sedan`
  return formatDate(iso)
}

export function formatTimestamp(ms) {
  if (!ms) return ''
  return new Intl.DateTimeFormat('sv-SE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(ms))
}

export function pluralize(n, one, many) {
  return `${n} ${n === 1 ? one : many}`
}
