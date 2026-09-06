// Pure helpers for the projects module (no React, no persistence).
import { formatDate, formatShortDate, formatWeekday, parseIsoDate, pluralize, relativeDay } from '../../lib/format.js'

/** Number of displayed pages of a score (pageOrder may omit removed pages). */
export function scorePageCount(score) {
  return score?.pageOrder?.length ?? score?.pageCount ?? 0
}

/** "7 stycken · 62 sidor" */
export function summarizeSetlist(count, pages) {
  return `${pluralize(count, 'stycke', 'stycken')} · ${pluralize(pages, 'sida', 'sidor')}`
}

/**
 * Human date line for a project: "Lördag 14 sep · Om 9 dagar".
 * Dates further away than two weeks drop the relative part; other years add the year.
 */
export function describeProjectDate(iso, today = new Date()) {
  const d = parseIsoDate(iso)
  if (!d) return ''
  const short = formatShortDate(iso).replace(/\.$/, '')
  const base = `${formatWeekday(iso)} ${short}`
  const rel = relativeDay(iso)
  if (rel && rel !== formatDate(iso)) return `${base} · ${rel}`
  return d.getFullYear() === today.getFullYear() ? base : `${base} ${d.getFullYear()}`
}

export function isPastProject(project, todayIso) {
  return !!project.date && project.date < todayIso
}

/** Upcoming: soonest first, undated last, ties by name. */
export function compareUpcoming(a, b) {
  if (!a.date && !b.date) return a.name.localeCompare(b.name, 'sv')
  if (!a.date) return 1
  if (!b.date) return -1
  return a.date.localeCompare(b.date) || a.name.localeCompare(b.name, 'sv')
}

/** Past: most recent first, ties by name. */
export function comparePast(a, b) {
  return b.date.localeCompare(a.date) || a.name.localeCompare(b.name, 'sv')
}

export function splitProjects(projects, todayIso) {
  const upcoming = []
  const past = []
  for (const p of projects) (isPastProject(p, todayIso) ? past : upcoming).push(p)
  upcoming.sort(compareUpcoming)
  past.sort(comparePast)
  return { upcoming, past }
}

/**
 * Per-project summary from the raw link + score tables.
 * @returns {Map<string, { count:number, pages:number, scores:object[] }>}
 *   `scores` holds the first `limit` scores in setlist order (deleted scores skipped).
 */
export function summarizeProjects(links, scores, limit = 4) {
  const byId = new Map(scores.map((s) => [s.id, s]))
  const grouped = new Map()
  for (const l of links) {
    if (!grouped.has(l.projectId)) grouped.set(l.projectId, [])
    grouped.get(l.projectId).push(l)
  }
  const out = new Map()
  for (const [projectId, list] of grouped) {
    list.sort((a, b) => a.position - b.position)
    const present = list.map((l) => byId.get(l.scoreId)).filter(Boolean)
    out.set(projectId, {
      count: present.length,
      pages: present.reduce((n, s) => n + scorePageCount(s), 0),
      scores: present.slice(0, limit),
    })
  }
  return out
}

/** Lower-case and strip diacritics so "handel" matches "Händel". */
export function fold(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

export function matchesQuery(score, query) {
  const q = fold(query.trim())
  if (!q) return true
  return fold(`${score.title} ${score.composer} ${score.voice}`).includes(q)
}

export function compareScoresByTitle(a, b) {
  return a.title.localeCompare(b.title, 'sv') || a.composer.localeCompare(b.composer, 'sv')
}
