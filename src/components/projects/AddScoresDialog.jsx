import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { CheckCircle2, Music, Search, SearchX, X } from 'lucide-react'
import { addScoresToProject, db } from '../../db/db.js'
import { pluralize } from '../../lib/format.js'
import { Button, Dialog, EmptyState, IconButton, Spinner, TextField, useToast } from '../ui/index.js'
import { cn } from '../ui/cn.js'
import { ScoreThumb } from './ScoreThumb.jsx'
import { compareScoresByTitle, matchesQuery, scorePageCount } from './projectUtils.js'

/**
 * Searchable multi-select of library scores that are not yet in the project.
 * `existingIds` – score ids already in the project (hidden from the list).
 */
export function AddScoresDialog({ open, onClose, projectId, existingIds = [] }) {
  if (!open) return null
  return <AddScoresBody onClose={onClose} projectId={projectId} existingIds={existingIds} />
}

function AddScoresBody({ onClose, projectId, existingIds }) {
  const toast = useToast()
  const scores = useLiveQuery(() => db.scores.toArray(), [], null)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(() => new Set())
  const [busy, setBusy] = useState(false)

  const existing = useMemo(() => new Set(existingIds), [existingIds])
  const candidates = useMemo(() => (scores ? scores.filter((s) => !existing.has(s.id)).sort(compareScoresByTitle) : null), [scores, existing])
  const visible = useMemo(() => (candidates ? candidates.filter((s) => matchesQuery(s, query)) : null), [candidates, query])

  // Only count selections that still exist and are still addable.
  const chosen = useMemo(() => (candidates ? candidates.filter((s) => selected.has(s.id)) : []), [candidates, selected])
  const allVisibleChosen = !!visible?.length && visible.every((s) => selected.has(s.id))

  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const toggleAllVisible = () =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (allVisibleChosen) visible.forEach((s) => next.delete(s.id))
      else visible.forEach((s) => next.add(s.id))
      return next
    })

  const confirm = async () => {
    if (busy || !chosen.length) return
    setBusy(true)
    try {
      const n = await addScoresToProject(
        projectId,
        chosen.map((s) => s.id),
      )
      toast.success(n === 1 ? `”${chosen[0].title}” lades till` : `${pluralize(n, 'stycke', 'stycken')} lades till i projektet`)
      onClose?.()
    } catch {
      toast.error('Styckena kunde inte läggas till. Försök igen.')
    } finally {
      setBusy(false)
    }
  }

  const libraryEmpty = scores !== null && scores.length === 0
  const allAdded = candidates !== null && candidates.length === 0 && !libraryEmpty

  return (
    <Dialog
      open
      onClose={busy ? undefined : onClose}
      title="Lägg till stycken"
      description={candidates?.length ? `${pluralize(candidates.length, 'stycke', 'stycken')} i biblioteket kan läggas till.` : 'Välj noter ur biblioteket.'}
      size="md"
      footer={
        libraryEmpty || allAdded ? (
          <Button variant="ghost" onClick={onClose}>
            Stäng
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              Avbryt
            </Button>
            <Button onClick={confirm} disabled={!chosen.length} loading={busy} data-testid="picker-confirm">
              Lägg till{chosen.length ? ` (${chosen.length})` : ''}
            </Button>
          </>
        )
      }
    >
      <div data-testid="add-scores-dialog" className="flex flex-col gap-3">
        {scores === null ? (
          <div className="flex items-center justify-center py-12 text-gold-300">
            <Spinner className="size-6" />
          </div>
        ) : libraryEmpty ? (
          <EmptyState icon={Music} title="Biblioteket är tomt" description="Skanna eller importera noter först. Sedan kan du lägga dem i projektet." className="py-8">
            <Button as={Link} to="/" variant="secondary">
              Gå till biblioteket
            </Button>
          </EmptyState>
        ) : allAdded ? (
          <EmptyState icon={CheckCircle2} title="Allt är redan med" description="Alla stycken i biblioteket finns redan i det här projektet." className="py-8" />
        ) : (
          <>
            <div className="sticky top-0 z-10 -mx-1 flex items-center gap-2 bg-ink-850 px-1 pb-1 pt-1">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-ivory-500" aria-hidden="true" />
                <TextField
                  type="search"
                  inputMode="search"
                  enterKeyHint="search"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="Sök stycke…"
                  aria-label="Sök i biblioteket"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape' && query) {
                      e.preventDefault()
                      e.stopPropagation()
                      setQuery('')
                    }
                  }}
                  data-testid="picker-search"
                  inputClassName="pl-10 pr-11 [&::-webkit-search-cancel-button]:hidden"
                />
                {query ? (
                  <IconButton label="Rensa sökning" size="sm" onClick={() => setQuery('')} className="absolute right-1 top-1/2 -translate-y-1/2 text-ivory-400">
                    <X />
                  </IconButton>
                ) : null}
              </div>
              {visible && visible.length > 1 ? (
                <Button variant="ghost" size="sm" onClick={toggleAllVisible} className="shrink-0">
                  {allVisibleChosen ? 'Avmarkera alla' : 'Markera alla'}
                </Button>
              ) : null}
            </div>

            {visible.length === 0 ? (
              <EmptyState icon={SearchX} title="Inga träffar" description={`Inget stycke matchar ”${query.trim()}”.`} className="py-8" />
            ) : (
              <ul className="m-0 flex list-none flex-col gap-1 p-0" aria-label="Stycken i biblioteket">
                {visible.map((s) => {
                  const checked = selected.has(s.id)
                  return (
                    <li key={s.id}>
                      <label
                        data-testid="picker-item"
                        data-score-id={s.id}
                        data-checked={checked ? 'true' : 'false'}
                        className={cn(
                          'flex min-h-14 cursor-pointer items-center gap-3 rounded-xl px-2.5 py-1.5 transition-colors select-none',
                          checked ? 'bg-gold-500/12 shadow-glow' : 'hover:bg-ink-700/60',
                        )}
                      >
                        <input type="checkbox" className="size-5 shrink-0 accent-gold-500" checked={checked} onChange={() => toggle(s.id)} aria-label={`Välj ${s.title}`} />
                        <ScoreThumb score={s} className="h-12 w-9 rounded" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-display text-[17px] leading-tight text-ivory-50">{s.title}</span>
                          <span className="block truncate text-[13px] text-ivory-400">
                            <span className={cn(!s.composer && 'italic')}>{s.composer || 'Okänd kompositör'}</span>
                            <span className="text-ivory-500"> · {pluralize(scorePageCount(s), 'sida', 'sidor')}</span>
                          </span>
                        </span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            )}
          </>
        )}
      </div>
    </Dialog>
  )
}
