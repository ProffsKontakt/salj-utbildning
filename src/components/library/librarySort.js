// Library sort options + comparator (kept out of the component file for fast refresh).
export const SORT_OPTIONS = [
  { key: 'recent', label: 'Senast öppnad' },
  { key: 'title', label: 'Titel A–Ö' },
  { key: 'composer', label: 'Kompositör' },
  { key: 'newest', label: 'Nyast' },
]

export const DEFAULT_SORT = 'recent'

const collator = new Intl.Collator('sv', { sensitivity: 'base', numeric: true })

/** Return a sorted copy of `scores` according to a SORT_OPTIONS key. */
export function sortScores(scores, sort) {
  const list = scores.slice()
  switch (sort) {
    case 'title':
      list.sort((a, b) => collator.compare(a.title || '', b.title || '') || collator.compare(a.composer || '', b.composer || ''))
      break
    case 'composer':
      list.sort((a, b) => {
        // scores without a composer go last
        if (!a.composer !== !b.composer) return a.composer ? -1 : 1
        return collator.compare(a.composer || '', b.composer || '') || collator.compare(a.title || '', b.title || '')
      })
      break
    case 'newest':
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      break
    case 'recent':
    default:
      list.sort((a, b) => (b.lastOpenedAt || b.updatedAt || 0) - (a.lastOpenedAt || a.updatedAt || 0))
      break
  }
  return list
}
