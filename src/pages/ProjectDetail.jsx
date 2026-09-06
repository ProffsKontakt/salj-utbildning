import { useCallback, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { CalendarDays, CalendarX, ChevronLeft, CloudDownload, ListMusic, MapPin, MoreVertical, Pencil, Play, Plus, StickyNote, Trash2 } from 'lucide-react'
import { addScoresToProject, db, deleteProject, getProject, getProjectSetlist, removeScoreFromProject, reorderProjectScores } from '../db/db.js'
import { pluralize } from '../lib/format.js'
import { useSync } from '../lib/sync/useSync.js'
import { Button, ConfirmDialog, EmptyState, IconButton, Menu, Spinner, useToast } from '../components/ui/index.js'
import { cn } from '../components/ui/cn.js'
import { Setlist } from '../components/projects/Setlist.jsx'
import { AddScoresDialog } from '../components/projects/AddScoresDialog.jsx'
import { ProjectDialog } from '../components/projects/ProjectDialog.jsx'
import { describeProjectDate, scorePageCount, summarizeSetlist } from '../components/projects/projectUtils.js'

const NOTES_COLLAPSE_AT = 180

export default function ProjectDetail() {
  const { projectId } = useParams()
  // Keyed so every live query starts fresh when the route changes (no stale previous result).
  return <ProjectDetailView key={projectId} projectId={projectId} />
}

function ProjectDetailView({ projectId }) {
  const navigate = useNavigate()
  const toast = useToast()
  const sync = useSync()
  const { user, online } = sync

  // null = loading, false = missing. getProject resolves undefined for a bad id.
  const project = useLiveQuery(() => getProject(projectId).then((p) => p || false), [projectId], null)
  // liveQuery tracks both tables read inside getProjectSetlist (projectScores + scores).
  const setlist = useLiveQuery(() => getProjectSetlist(projectId), [projectId], null)

  const dbIds = useMemo(() => (setlist || []).map((x) => x.score.id), [setlist])
  const dbKey = dbIds.join('|')
  // Optimistic order: applies while the database still shows an order it was derived from.
  // `bases` holds every order the in-flight writes pass through (rapid consecutive moves chain),
  // so the list does not bounce back to an intermediate order while earlier writes land.
  const [optimistic, setOptimistic] = useState(null) // { ids: string[], bases: string[] }
  const orderedIds = optimistic && optimistic.bases.some((b) => b === dbKey) ? optimistic.ids : dbIds
  const items = useMemo(() => {
    if (!setlist) return []
    const byId = new Map(setlist.map((x) => [x.score.id, x]))
    return orderedIds.map((id) => byId.get(id)).filter(Boolean)
  }, [setlist, orderedIds])
  const totalPages = useMemo(() => items.reduce((n, x) => n + scorePageCount(x.score), 0), [items])

  // Offline availability: a `files` row exists only for scores kept on this device.
  const fileKeys = useLiveQuery(() => db.files.toCollection().primaryKeys(), [], null)
  const downloadedIds = useMemo(() => (fileKeys ? new Set(fileKeys) : null), [fileKeys])
  const downloadingIds = useMemo(() => new Set(sync.status.downloading), [sync.status.downloading])
  const missingCount = useMemo(() => (downloadedIds ? items.filter((x) => !downloadedIds.has(x.score.id)).length : 0), [items, downloadedIds])
  const [downloadTotal, setDownloadTotal] = useState(0) // > 0 while "Ladda ner alla" runs

  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [notesOpen, setNotesOpen] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const removing = useRef(new Set()) // score ids with a removal in flight

  const applyOrder = useCallback(
    (ids) => {
      // If an earlier move is still being written, this one was derived from its optimistic order:
      // keep accepting that order (and everything before it) until the database catches up.
      setOptimistic((prev) => {
        const chained = prev && prev.bases.some((b) => b === dbKey)
        return { ids, bases: chained ? [...prev.bases, prev.ids.join('|')] : [dbKey] }
      })
      reorderProjectScores(projectId, ids).catch(() => {
        setOptimistic(null)
        toast.error('Ordningen kunde inte sparas. Försök igen.')
      })
    },
    [projectId, dbKey, toast],
  )

  const handleMove = useCallback(
    (scoreId, delta) => {
      const from = orderedIds.indexOf(scoreId)
      const to = from + delta
      if (from < 0 || to < 0 || to >= orderedIds.length) return
      const next = [...orderedIds]
      next.splice(from, 1)
      next.splice(to, 0, scoreId)
      applyOrder(next)
      const title = items[from]?.score.title || 'Stycket'
      setAnnouncement(`${title} flyttades till plats ${to + 1} av ${next.length}.`)
    },
    [orderedIds, items, applyOrder],
  )

  const handleRemove = useCallback(
    async (scoreId) => {
      if (removing.current.has(scoreId)) return // double tap
      removing.current.add(scoreId)
      const previous = orderedIds
      const title = items.find((x) => x.score.id === scoreId)?.score.title || 'Stycket'
      try {
        await removeScoreFromProject(projectId, scoreId)
      } catch {
        toast.error('Stycket kunde inte tas bort ur projektet.')
        return
      } finally {
        removing.current.delete(scoreId)
      }
      toast.push('Stycket togs bort ur projektet', {
        duration: 7000,
        action: {
          label: 'Ångra',
          onClick: async () => {
            try {
              if (!(await getProject(projectId))) {
                toast.error('Projektet finns inte längre.')
                return
              }
              await addScoresToProject(projectId, [scoreId])
              await reorderProjectScores(projectId, previous)
              toast.success(`”${title}” är tillbaka i setlistan`)
            } catch {
              toast.error('Det gick inte att ångra. Lägg till stycket igen.')
            }
          },
        },
      })
    },
    [projectId, orderedIds, items, toast],
  )

  const handleOpen = useCallback((scoreId) => navigate(`/noter/${scoreId}`), [navigate])

  const downloadAll = async () => {
    if (downloadTotal > 0) return
    setDownloadTotal(Math.max(1, missingCount))
    try {
      const n = await sync.downloadProject(projectId)
      toast.success(n ? pluralize(n, 'stycke nedladdat', 'stycken nedladdade') : 'Allt är redan nedladdat')
    } catch (err) {
      toast.error(err?.message || 'Nedladdningen misslyckades. Försök igen.')
    } finally {
      setDownloadTotal(0)
    }
  }

  const confirmDelete = async () => {
    if (deleteBusy) return
    setDeleteBusy(true)
    try {
      await deleteProject(projectId)
      toast.success('Projektet togs bort')
      navigate('/projekt', { replace: true })
    } catch {
      toast.error('Projektet kunde inte tas bort. Försök igen.')
      setDeleteBusy(false)
    }
  }

  if (project === null) {
    return (
      <div className="flex min-h-[60dvh] items-center justify-center text-gold-300" aria-busy="true">
        <Spinner className="size-8" />
      </div>
    )
  }

  if (project === false) {
    return (
      <div className="pt-safe px-4 pt-6 sm:px-6 md:px-10 animate-fade-in">
        <BackLink />
        <EmptyState icon={CalendarX} title="Projektet finns inte" description="Det kan ha tagits bort, eller så är länken inte längre giltig.">
          <Button as={Link} to="/projekt" variant="secondary">
            Till alla projekt
          </Button>
        </EmptyState>
      </div>
    )
  }

  const dateLine = describeProjectDate(project.date)
  const isEmpty = setlist !== null && items.length === 0
  const longNotes = (project.notes || '').length > NOTES_COLLAPSE_AT
  const canPerform = items.length > 0
  // Online, the performance view downloads what it needs on the fly; offline it cannot.
  const offlineBlocked = canPerform && missingCount > 0 && !online
  const downloadingAll = downloadTotal > 0
  const downloadDone = Math.min(downloadTotal, Math.max(0, downloadTotal - missingCount))
  const showDownloadAll = !!user && (missingCount > 0 || downloadingAll)

  return (
    <div className="pb-6 animate-fade-in">
      <header className="pt-safe px-4 pt-4 sm:px-6 md:px-10 md:pt-6">
        <div className="flex items-center justify-between gap-2">
          <BackLink />
          <Menu
            align="end"
            testId="project-menu-popover"
            trigger={(props) => (
              <IconButton {...props} label="Fler alternativ" data-testid="project-menu" className="-mr-2 text-ivory-300 hover:text-ivory-50">
                <MoreVertical />
              </IconButton>
            )}
            items={[
              { key: 'edit', label: 'Redigera', icon: Pencil, onSelect: () => setEditing(true) },
              { separator: true },
              { key: 'delete', label: 'Ta bort projekt', icon: Trash2, danger: true, onSelect: () => setDeleting(true) },
            ]}
          />
        </div>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0 flex-1 basis-72">
            {dateLine ? (
              <div className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.18em] text-gold-400">
                <CalendarDays className="size-3.5" aria-hidden="true" />
                {dateLine}
              </div>
            ) : (
              <div className="mb-1 text-xs font-medium uppercase tracking-[0.18em] text-ivory-500">Datum ej bestämt</div>
            )}
            <h1 className="font-display text-4xl leading-none text-ivory-50 md:text-5xl">{project.name}</h1>
            {project.venue ? (
              <p className="mt-2 flex items-center gap-1.5 text-[15px] text-ivory-300">
                <MapPin className="size-4 shrink-0 text-ivory-400" aria-hidden="true" />
                {project.venue}
              </p>
            ) : null}
            {project.notes ? (
              <div className="mt-3 flex max-w-2xl gap-2 rounded-xl bg-ink-800/50 px-3.5 py-3 text-[14px] leading-relaxed text-ivory-300 hairline">
                <StickyNote className="mt-0.5 size-4 shrink-0 text-gold-400/80" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className={cn('whitespace-pre-line', longNotes && !notesOpen && 'line-clamp-2')}>{project.notes}</p>
                  {longNotes ? (
                    <button type="button" className="mt-1 text-[13px] font-medium text-gold-300 hover:underline" onClick={() => setNotesOpen((o) => !o)} aria-expanded={notesOpen}>
                      {notesOpen ? 'Visa mindre' : 'Visa mer'}
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap">
            <Button
              variant="primary"
              className="min-w-0 flex-auto sm:flex-none"
              disabled={!canPerform || offlineBlocked}
              title={!canPerform ? 'Lägg till stycken för att starta konsertläge' : offlineBlocked ? 'Ladda ner alla stycken först' : undefined}
              onClick={() => navigate(`/projekt/${projectId}/spela`)}
              data-testid="start-performance"
            >
              <Play className="size-[18px]" aria-hidden="true" />
              Konsertläge
            </Button>
            {showDownloadAll ? (
              <Button
                variant="secondary"
                className="min-w-0 flex-auto sm:flex-none"
                onClick={downloadAll}
                loading={downloadingAll}
                disabled={!online}
                title={online ? undefined : 'Anslut till internet för att ladda ner'}
                aria-live="polite"
                data-testid="download-project"
              >
                {!downloadingAll ? <CloudDownload className="size-[18px]" aria-hidden="true" /> : null}
                {downloadingAll ? `Laddar ner… ${downloadDone}/${downloadTotal}` : 'Ladda ner alla'}
              </Button>
            ) : null}
            <Button variant="secondary" className="min-w-0 flex-auto sm:flex-none" onClick={() => setAdding(true)} data-testid="add-scores">
              <Plus className="size-[18px]" aria-hidden="true" />
              Lägg till stycken
            </Button>
          </div>
        </div>
        {!canPerform && setlist !== null ? (
          <p className="mt-2 text-xs text-ivory-500 sm:text-right">Lägg till stycken för att kunna starta konsertläget.</p>
        ) : offlineBlocked ? (
          <p className="mt-2 text-xs text-ivory-500 sm:text-right" data-testid="performance-offline-hint">
            Du är offline och {pluralize(missingCount, 'stycke är inte nedladdat', 'stycken är inte nedladdade')}. Ladda ner alla stycken först.
          </p>
        ) : showDownloadAll && !downloadingAll ? (
          <p className="mt-2 text-xs text-ivory-500 sm:text-right">{pluralize(missingCount, 'stycke finns bara i molnet', 'stycken finns bara i molnet')} – ladda ner för att spela offline.</p>
        ) : null}
      </header>

      <section className="mt-6 px-4 sm:px-6 md:mt-8 md:px-10" aria-label="Setlista">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="font-display text-2xl text-ivory-50">Setlista</h2>
          {items.length ? <p className="text-sm tabular-nums text-ivory-400">{summarizeSetlist(items.length, totalPages)}</p> : null}
        </div>

        {setlist === null ? (
          <ol className="m-0 flex list-none flex-col gap-2 p-0" aria-busy="true" aria-label="Läser in setlistan">
            {[0, 1, 2].map((i) => (
              <li key={i} className="h-[68px] rounded-2xl bg-ink-800/40 hairline animate-pulse-soft" style={{ animationDelay: `${i * 60}ms` }} />
            ))}
          </ol>
        ) : isEmpty ? (
          <EmptyState icon={ListMusic} title="Setlistan är tom" description="Lägg till stycken ur biblioteket och ordna dem i den ordning du ska framföra dem." className="py-12">
            <Button onClick={() => setAdding(true)}>
              <Plus className="size-[18px]" aria-hidden="true" />
              Lägg till stycken
            </Button>
          </EmptyState>
        ) : (
          <>
            <Setlist items={items} downloadedIds={downloadedIds} downloadingIds={downloadingIds} onReorder={applyOrder} onMove={handleMove} onRemove={handleRemove} onOpen={handleOpen} />
            <footer className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-ivory-50/8 pt-4 text-sm text-ivory-400">
              <span className="tabular-nums" data-testid="setlist-summary">
                {summarizeSetlist(items.length, totalPages)}
              </span>
              <span className="hidden text-xs text-ivory-500 sm:inline">Dra i handtaget eller använd pilarna för att ändra ordning.</span>
            </footer>
          </>
        )}
      </section>

      {/* Announces button-driven moves (dnd-kit announces drags itself). */}
      <div className="sr-only" role="status" aria-live="polite">
        {announcement}
      </div>

      <AddScoresDialog open={adding} onClose={() => setAdding(false)} projectId={projectId} existingIds={dbIds} />
      <ProjectDialog open={editing} project={project} onClose={() => setEditing(false)} />
      <ConfirmDialog
        open={deleting}
        onClose={() => (deleteBusy ? null : setDeleting(false))}
        onConfirm={confirmDelete}
        loading={deleteBusy}
        title="Ta bort projektet?"
        message={`”${project.name}” och dess setlista tas bort. Noterna ligger kvar i biblioteket och påverkas inte.`}
        confirmLabel="Ta bort projekt"
      />
    </div>
  )
}

function BackLink() {
  return (
    <Link to="/projekt" className="inline-flex min-h-11 items-center gap-1 rounded-lg pr-2 text-sm text-ivory-400 transition-colors hover:text-ivory-50 focus-visible:outline-2 focus-visible:outline-gold-400">
      <ChevronLeft className="size-4" aria-hidden="true" />
      Alla projekt
    </Link>
  )
}
