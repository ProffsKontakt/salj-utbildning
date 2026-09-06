import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Music, Search, SearchX, X } from 'lucide-react'
import { db, deleteScore } from '../db/db.js'
import { pluralize } from '../lib/format.js'
import { useSetting } from '../hooks/useSetting.js'
import { PageHeader } from '../components/PageHeader.jsx'
import { InstallBanner } from '../components/InstallBanner.jsx'
import { AddToProjectDialog } from '../components/projects/AddToProjectDialog.jsx'
import { Button, ConfirmDialog, EmptyState, IconButton, TextField, useToast } from '../components/ui/index.js'
import { useImportFlow } from '../components/import/useImportFlow.js'
import { ImportButtons } from '../components/import/ImportButtons.jsx'
import { ImportOverlays } from '../components/import/ImportOverlays.jsx'
import { ScoreGrid } from '../components/library/ScoreGrid.jsx'
import { SortMenu } from '../components/library/SortMenu.jsx'
import { DEFAULT_SORT, sortScores } from '../components/library/librarySort.js'
import { ScoreInfoDialog } from '../components/library/ScoreInfoDialog.jsx'

/** Lower-case and strip diacritics so "handel" matches "Händel" (and vice versa). */
function fold(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

export default function Library() {
  const navigate = useNavigate()
  const toast = useToast()
  const flow = useImportFlow()

  const scores = useLiveQuery(() => db.scores.toArray(), [], null)
  const links = useLiveQuery(() => db.projectScores.toArray(), [], null)
  const projects = useLiveQuery(() => db.projects.toArray(), [], null)

  const [query, setQuery] = useState('')
  const [sort, setSort] = useSetting('librarySort', DEFAULT_SORT)

  const [editing, setEditing] = useState(null) // score
  const [addingTo, setAddingTo] = useState(null) // score
  const [deleting, setDeleting] = useState(null) // score
  const [deleteBusy, setDeleteBusy] = useState(false)

  // Map<scoreId, project[]> – one pass over all links, sorted by project name.
  const projectsByScore = useMemo(() => {
    const map = new Map()
    if (!links || !projects) return map
    const byId = new Map(projects.map((p) => [p.id, p]))
    for (const l of links) {
      const p = byId.get(l.projectId)
      if (!p) continue
      if (!map.has(l.scoreId)) map.set(l.scoreId, [])
      map.get(l.scoreId).push(p)
    }
    for (const list of map.values()) list.sort((a, b) => a.name.localeCompare(b.name, 'sv'))
    return map
  }, [links, projects])

  const visible = useMemo(() => {
    if (!scores) return null
    const q = fold(query.trim())
    const filtered = q
      ? scores.filter((s) => {
          const hay = fold(`${s.title} ${s.composer} ${s.voice}`)
          return hay.includes(q) || `${s.title} ${s.composer} ${s.voice}`.toLowerCase().includes(query.trim().toLowerCase())
        })
      : scores
    return sortScores(filtered, sort)
  }, [scores, query, sort])

  const totalPages = useMemo(() => (scores || []).reduce((n, s) => n + (s.pageOrder?.length ?? s.pageCount ?? 0), 0), [scores])

  const description =
    scores === null ? 'Läser in ditt bibliotek…' : scores.length === 0 ? 'Skanna eller importera dina första noter.' : `${pluralize(scores.length, 'stycke', 'stycken')} · ${pluralize(totalPages, 'sida', 'sidor')}`

  const openScore = (score) => navigate(`/noter/${score.id}`)
  const openPages = (score) => navigate(`/noter/${score.id}/sidor`)

  const confirmDelete = async () => {
    if (!deleting || deleteBusy) return
    setDeleteBusy(true)
    try {
      await deleteScore(deleting.id)
      // pdf.js is lazy-loaded (only the viewer needs it). If it was loaded this session
      // the LRU cache may still hold this score's document; otherwise this is a no-op.
      import('../lib/pdf.js')
        .then((m) => m.invalidateScoreDocument(deleting.id))
        .catch(() => {})
      toast.success('Stycket togs bort')
      setDeleting(null)
    } catch {
      toast.error('Stycket kunde inte tas bort. Försök igen.')
    } finally {
      setDeleteBusy(false)
    }
  }

  const isEmpty = scores !== null && scores.length === 0
  const noHits = visible !== null && visible.length === 0 && !isEmpty

  return (
    <div className="pb-6 animate-fade-in">
      <PageHeader eyebrow="Bibliotek" title="Dina noter" description={description} actions={isEmpty ? null : <ImportButtons flow={flow} />} />

      <div className="px-4 sm:px-6 md:px-10">
        {!isEmpty ? (
          <div className="mt-6 flex items-center gap-2 sm:gap-3">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-ivory-500" aria-hidden="true" />
              <TextField
                type="search"
                inputMode="search"
                enterKeyHint="search"
                autoComplete="off"
                spellCheck={false}
                placeholder="Sök titel eller kompositör…"
                aria-label="Sök i biblioteket"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape' && query) {
                    e.preventDefault()
                    setQuery('')
                  }
                }}
                data-testid="library-search"
                inputClassName="pl-10 pr-11 [&::-webkit-search-cancel-button]:hidden"
              />
              {query ? (
                <IconButton label="Rensa sökning" size="sm" onClick={() => setQuery('')} className="absolute right-1 top-1/2 -translate-y-1/2 text-ivory-400">
                  <X />
                </IconButton>
              ) : null}
            </div>
            <SortMenu value={sort} onChange={(v) => setSort(v).catch(() => toast.error('Sorteringen kunde inte sparas.'))} />
          </div>
        ) : null}

        <div className="mt-5">
          <InstallBanner />
        </div>

        {isEmpty ? (
          <EmptyState icon={Music} title="Ditt notställ är tomt" description="Fotografera sidorna med kameran eller importera PDF:er och bilder. Allt sparas lokalt på den här enheten.">
            <ImportButtons flow={flow} size="lg" />
          </EmptyState>
        ) : noHits ? (
          <EmptyState icon={SearchX} title="Inga träffar" description={`Inget stycke matchar ”${query.trim()}”. Prova ett annat ord eller rensa sökningen.`} className="py-12">
            <Button variant="secondary" onClick={() => setQuery('')}>
              Rensa sökningen
            </Button>
          </EmptyState>
        ) : (
          <div className="mt-2">
            {query && visible ? (
              <p className="mb-3 text-sm text-ivory-400" role="status">
                {pluralize(visible.length, 'träff', 'träffar')} för ”{query.trim()}”
              </p>
            ) : null}
            <ScoreGrid scores={visible} projectsByScore={projectsByScore} onOpen={openScore} onPages={openPages} onAddToProject={setAddingTo} onEdit={setEditing} onDelete={setDeleting} />
          </div>
        )}
      </div>

      <ImportOverlays flow={flow} />
      <ScoreInfoDialog score={editing} open={!!editing} onClose={() => setEditing(null)} />
      <AddToProjectDialog open={!!addingTo} onClose={() => setAddingTo(null)} scoreIds={addingTo ? [addingTo.id] : []} />
      <ConfirmDialog
        open={!!deleting}
        onClose={() => (deleteBusy ? null : setDeleting(null))}
        onConfirm={confirmDelete}
        loading={deleteBusy}
        title="Ta bort stycket?"
        message={deleting ? `”${deleting.title}” och alla dess anteckningar tas bort från den här enheten. Det går inte att ångra.` : ''}
        confirmLabel="Ta bort"
      />
    </div>
  )
}
