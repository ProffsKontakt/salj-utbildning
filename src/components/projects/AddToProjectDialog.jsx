// CONTRACT (used by the library): <AddToProjectDialog open onClose scoreIds={string[]} />
// Lets the user pick one or more projects (or create a new one inline) and adds
// the given scores to them via addScoresToProject. Shows a toast on success.
import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { CalendarDays, Check, MapPin, Plus } from 'lucide-react'
import { addScoresToProject, createProject, db } from '../../db/db.js'
import { pluralize, todayIso } from '../../lib/format.js'
import { Button, Dialog, Spinner, TextField, useToast } from '../ui/index.js'
import { cn } from '../ui/cn.js'
import { describeProjectDate, splitProjects } from './projectUtils.js'

export function AddToProjectDialog({ open, onClose, scoreIds = [] }) {
  if (!open) return null
  return <AddToProjectBody key={scoreIds.join('|')} onClose={onClose} scoreIds={scoreIds} />
}

function AddToProjectBody({ onClose, scoreIds }) {
  const toast = useToast()
  const total = scoreIds.length
  const idsKey = scoreIds.join('|')

  const projects = useLiveQuery(() => db.projects.toArray(), [], null)
  const links = useLiveQuery(() => (total ? db.projectScores.where('scoreId').anyOf(scoreIds).toArray() : []), [idsKey], null)
  const scores = useLiveQuery(() => (total ? db.scores.bulkGet(scoreIds) : []), [idsKey], null)
  const [today] = useState(todayIso)

  const [selected, setSelected] = useState(() => new Set())
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDate, setNewDate] = useState('')
  const [nameTouched, setNameTouched] = useState(false)
  const [createBusy, setCreateBusy] = useState(false)
  const [busy, setBusy] = useState(false)

  // How many of the given scores each project already contains.
  const membership = useMemo(() => {
    const m = new Map()
    for (const l of links || []) m.set(l.projectId, (m.get(l.projectId) || 0) + 1)
    return m
  }, [links])

  const ordered = useMemo(() => {
    if (!projects) return null
    const { upcoming, past } = splitProjects(projects, today)
    return [...upcoming, ...past]
  }, [projects, today])

  // A project is "full" when every given score is already in it – nothing left to add.
  const isFull = (p) => total > 0 && (membership.get(p.id) || 0) >= total
  const chosen = useMemo(
    () => (ordered ? ordered.filter((p) => selected.has(p.id) && (membership.get(p.id) || 0) < total) : []),
    [ordered, selected, membership, total],
  )

  const loading = projects === null || links === null
  const noProjects = ordered !== null && ordered.length === 0
  const showForm = creating || noProjects
  const newNameError = nameTouched && !newName.trim() ? 'Ge projektet ett namn.' : ''

  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const createInline = async (e) => {
    e?.preventDefault?.()
    if (createBusy) return
    if (!newName.trim()) {
      setNameTouched(true)
      return
    }
    setCreateBusy(true)
    try {
      const p = await createProject({ name: newName.trim(), date: newDate })
      setSelected((prev) => new Set(prev).add(p.id))
      setNewName('')
      setNewDate('')
      setNameTouched(false)
      setCreating(false)
    } catch {
      toast.error('Projektet kunde inte skapas. Försök igen.')
    } finally {
      setCreateBusy(false)
    }
  }

  const confirm = async () => {
    if (busy || !chosen.length) return
    setBusy(true)
    try {
      for (const p of chosen) await addScoresToProject(p.id, scoreIds)
      toast.success(chosen.length === 1 ? `Tillagt i ”${chosen[0].name}”` : `Tillagt i ${pluralize(chosen.length, 'projekt', 'projekt')}`)
      onClose?.()
    } catch {
      toast.error('Styckena kunde inte läggas till. Försök igen.')
    } finally {
      setBusy(false)
    }
  }

  const titles = (scores || []).filter(Boolean).map((s) => s.title)
  const description =
    total === 0
      ? 'Inga stycken valda.'
      : total === 1
        ? titles[0]
          ? `”${titles[0]}” läggs till i de projekt du markerar.`
          : 'Stycket läggs till i de projekt du markerar.'
        : `${pluralize(total, 'stycke', 'stycken')} läggs till i de projekt du markerar.`

  return (
    <Dialog
      open
      onClose={busy ? undefined : onClose}
      title="Lägg till i projekt"
      description={description}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Avbryt
          </Button>
          <Button onClick={confirm} disabled={!chosen.length || total === 0} loading={busy} data-testid="add-to-project-confirm">
            Lägg till{chosen.length > 1 ? ` (${chosen.length})` : ''}
          </Button>
        </>
      }
    >
      <div data-testid="add-to-project-dialog" className="flex flex-col gap-2">
        {loading ? (
          <div className="flex items-center justify-center py-10 text-gold-300">
            <Spinner className="size-6" />
          </div>
        ) : (
          <>
            {noProjects ? <p className="text-[15px] text-ivory-300">Du har inga projekt ännu. Skapa det första här – stycket läggs till direkt.</p> : null}
            {ordered.length ? (
              <ul className="m-0 flex list-none flex-col gap-1 p-0" aria-label="Projekt">
                {ordered.map((p) => {
                  const inCount = membership.get(p.id) || 0
                  const full = isFull(p)
                  const checked = full || selected.has(p.id)
                  const past = !!p.date && p.date < today
                  const dateLine = describeProjectDate(p.date)
                  const hint = full ? 'Redan tillagd' : inCount > 0 ? `${inCount} av ${total} redan tillagda` : ''
                  return (
                    <li key={p.id}>
                      <label
                        data-testid="project-option"
                        data-project-id={p.id}
                        data-checked={checked ? 'true' : 'false'}
                        aria-disabled={full || undefined}
                        className={cn(
                          'flex min-h-14 items-center gap-3 rounded-xl px-2.5 py-2 transition-colors select-none',
                          full ? 'cursor-default opacity-60' : 'cursor-pointer',
                          checked && !full ? 'bg-gold-500/12 shadow-glow' : !full && 'hover:bg-ink-700/60',
                        )}
                      >
                        <input type="checkbox" className="size-5 shrink-0 accent-gold-500" checked={checked} disabled={full} onChange={() => toggle(p.id)} aria-label={`Välj ${p.name}`} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-display text-[17px] leading-tight text-ivory-50">{p.name}</span>
                          <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[13px] text-ivory-400">
                            {dateLine ? (
                              <span className={cn('truncate', past && 'text-ivory-500')}>{dateLine}</span>
                            ) : (
                              <span className="italic text-ivory-500">Datum ej bestämt</span>
                            )}
                            {p.venue ? (
                              <>
                                <span aria-hidden="true">·</span>
                                <MapPin className="size-3 shrink-0" aria-hidden="true" />
                                <span className="truncate">{p.venue}</span>
                              </>
                            ) : null}
                          </span>
                        </span>
                        {hint ? (
                          <span className="flex shrink-0 items-center gap-1 text-xs text-ivory-400">
                            {full ? <Check className="size-3.5 text-success" aria-hidden="true" /> : null}
                            {hint}
                          </span>
                        ) : null}
                      </label>
                    </li>
                  )
                })}
              </ul>
            ) : null}

            {showForm ? (
              <form onSubmit={createInline} noValidate className="mt-1 rounded-2xl bg-ink-800/70 p-3 hairline animate-fade-in" aria-label="Nytt projekt">
                <div className="flex items-center gap-2 text-sm font-medium text-gold-300">
                  <CalendarDays className="size-4" aria-hidden="true" />
                  Nytt projekt
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
                  <TextField
                    label="Namn"
                    autoComplete="off"
                    maxLength={120}
                    placeholder="T.ex. Vårkonsert"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onBlur={() => setNameTouched(true)}
                    error={newNameError}
                    data-testid="inline-project-name"
                  />
                  <TextField label="Datum" type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} data-testid="inline-project-date" inputClassName="min-w-0 sm:w-44" />
                </div>
                <div className="mt-3 flex justify-end gap-2">
                  {!noProjects ? (
                    <Button variant="ghost" size="sm" onClick={() => setCreating(false)} disabled={createBusy}>
                      Avbryt
                    </Button>
                  ) : null}
                  <Button type="submit" variant="secondary" size="sm" loading={createBusy} data-testid="inline-project-create">
                    Skapa och markera
                  </Button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="mt-1 flex min-h-12 w-full items-center gap-3 rounded-xl border border-dashed border-ivory-50/15 px-3 py-2 text-left text-[15px] text-gold-300 transition-colors hover:bg-gold-500/10 focus-visible:outline-2 focus-visible:outline-gold-400"
                data-testid="inline-project-toggle"
              >
                <Plus className="size-[18px]" aria-hidden="true" />
                Nytt projekt…
              </button>
            )}
          </>
        )}
      </div>
    </Dialog>
  )
}
