import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { FileText, Images, CheckCircle2, AlertTriangle, X } from 'lucide-react'
import { db } from '../../db/db.js'
import { useSetting } from '../../hooks/useSetting.js'
import { pluralize } from '../../lib/format.js'
import { Button, Dialog, IconButton, Select, Spinner, TextField, Toggle, useToast } from '../ui/index.js'
import { cn } from '../ui/cn.js'

/**
 * Review-and-confirm step for an import. `items` come from planImport() (or a
 * ScanSheet result). Imports run sequentially; each row shows its own status.
 * Mount with a fresh `key` per import session so the form state resets.
 *
 * Props: { open, items, initialEnhance: boolean|null, onClose }
 */
export function ImportDialog({ open, items, initialEnhance = null, onClose }) {
  const toast = useToast()
  const navigate = useNavigate()
  const projects = useLiveQuery(() => db.projects.toArray(), [], null)
  const [settingEnhance] = useSetting('enhanceScans')
  const [enhanceOverride, setEnhanceOverride] = useState(null)
  const enhance = enhanceOverride ?? initialEnhance ?? settingEnhance
  const [projectId, setProjectId] = useState('')
  const [running, setRunning] = useState(false)
  const [rows, setRows] = useState(() =>
    items.map((item, i) => ({
      id: `${i}-${item.kind}`,
      kind: item.kind,
      files: item.files,
      suggestedTitle: item.suggestedTitle || '',
      title: item.suggestedTitle || '',
      composer: '',
      status: 'idle', // idle | working | done | error
      progress: null, // { done, total }
      error: null,
      scoreId: null,
    })),
  )

  const sortedProjects = useMemo(() => (projects || []).slice().sort((a, b) => a.name.localeCompare(b.name, 'sv')), [projects])
  const hasImages = rows.some((r) => r.kind === 'images')
  const pending = rows.filter((r) => r.status !== 'done')
  const doneCount = rows.length - pending.length
  const hasErrors = rows.some((r) => r.status === 'error')

  const patch = (id, changes) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...changes } : r)))

  const removeRow = (id) => {
    if (running) return
    const next = rows.filter((r) => r.id !== id)
    if (!next.length) {
      onClose?.()
      return
    }
    setRows(next)
  }

  const close = () => {
    if (!running) onClose?.()
  }

  const run = async () => {
    if (running || !pending.length) return
    setRunning(true)
    // Loaded lazily (pdf.js + pdf-lib); useImportFlow has normally warmed it already.
    let mod
    try {
      mod = await import('../../lib/importScore.js')
    } catch {
      setRunning(false)
      toast.error('Importen kunde inte startas. Kontrollera anslutningen och försök igen.')
      return
    }
    const created = []
    let flattenedAny = false
    let failed = 0
    for (const row of pending) {
      patch(row.id, { status: 'working', progress: null, error: null })
      try {
        const { score, flattened } = await mod.importFilesAsScore(row.files, {
          title: row.title.trim() || row.suggestedTitle || mod.defaultTitle(row.files),
          composer: row.composer.trim(),
          projectId: projectId || null,
          enhance: row.kind === 'images' ? !!enhance : false,
          onProgress: (done, total) => patch(row.id, { progress: { done, total } }),
        })
        created.push(score)
        if (flattened) flattenedAny = true
        patch(row.id, { status: 'done', scoreId: score.id, progress: null })
      } catch (err) {
        failed++
        patch(row.id, { status: 'error', progress: null, error: err?.message || 'Importen misslyckades.' })
      }
    }
    setRunning(false)

    if (created.length) toast.success(created.length === 1 ? '1 stycke importerat' : `${created.length} stycken importerade`)
    if (flattenedAny) toast.info('PDF:en var skyddad och sparades som bilder', { duration: 6000 })
    if (failed) {
      toast.error(failed === 1 ? 'Ett stycke kunde inte importeras.' : `${failed} stycken kunde inte importeras.`)
      return // keep the dialog open so the user can fix or remove the failing rows
    }
    const allIds = [...rows.filter((r) => r.status === 'done').map((r) => r.scoreId), ...created.map((s) => s.id)]
    onClose?.()
    if (allIds.length === 1) navigate(`/noter/${allIds[0]}`)
  }

  const confirmLabel = running
    ? 'Importerar…'
    : hasErrors && doneCount > 0
      ? `Försök igen (${pending.length})`
      : `Importera ${pluralize(pending.length, 'stycke', 'stycken')}`

  return (
    <Dialog
      open={open}
      onClose={close}
      title={rows.length === 1 ? 'Importera stycke' : 'Importera stycken'}
      description="Kontrollera titlar och kompositörer innan du importerar."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={running}>
            {doneCount > 0 && !pending.length ? 'Stäng' : 'Avbryt'}
          </Button>
          <Button onClick={run} loading={running} disabled={running || !pending.length} data-testid="import-confirm">
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div data-testid="import-dialog" className="space-y-5">
        <ul className="space-y-3" aria-label="Stycken att importera">
          {rows.map((row) => (
            <ImportRow
              key={row.id}
              row={row}
              locked={running || row.status === 'done'}
              canRemove={!running && rows.length > 1 && row.status !== 'done'}
              onChange={(changes) => patch(row.id, changes)}
              onRemove={() => removeRow(row.id)}
            />
          ))}
        </ul>

        <div className="rounded-2xl bg-ink-800/50 px-4 py-3 hairline">
          <Select label="Lägg till i projekt (valfritt)" value={projectId} onChange={(e) => setProjectId(e.target.value)} disabled={running}>
            <option value="">Inget projekt</option>
            {sortedProjects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.date ? ` · ${p.date}` : ''}
              </option>
            ))}
          </Select>
          {hasImages ? (
            <div className="mt-2 border-t border-ivory-50/8">
              <Toggle
                label="Förbättra skanning"
                description="Svartvitt med högre kontrast – gör fotograferade sidor lättare att läsa."
                checked={!!enhance}
                onChange={setEnhanceOverride}
                disabled={running}
              />
            </div>
          ) : null}
        </div>
      </div>
    </Dialog>
  )
}

function ImportRow({ row, locked, canRemove, onChange, onRemove }) {
  const isPdf = row.kind === 'pdf'
  const Icon = isPdf ? FileText : Images
  const meta = isPdf ? `PDF · ${row.files[0]?.name || ''}` : pluralize(row.files.length, 'bild', 'bilder')
  const progressText = row.progress ? `Bearbetar sida ${row.progress.done}/${row.progress.total}` : 'Bearbetar…'

  return (
    <li
      className={cn(
        'rounded-2xl bg-ink-800/70 p-3.5 hairline transition-colors sm:p-4',
        row.status === 'done' && 'bg-success/8',
        row.status === 'error' && 'shadow-[inset_0_0_0_1px_rgba(217,83,79,0.5)]',
      )}
      data-import-status={row.status}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-gold-500/10 text-gold-300" aria-hidden="true">
          <Icon className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex min-w-0 items-center gap-2 text-xs text-ivory-500">
            <span className="min-w-0 truncate">{meta}</span>
            {row.status === 'done' ? (
              <span className="inline-flex shrink-0 items-center gap-1 text-success">
                <CheckCircle2 className="size-3.5" aria-hidden="true" /> Importerad
              </span>
            ) : null}
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <TextField
              data-testid="import-title"
              aria-label="Titel"
              placeholder="Titel"
              value={row.title}
              onChange={(e) => onChange({ title: e.target.value })}
              disabled={locked}
              autoComplete="off"
              enterKeyHint="next"
            />
            <TextField
              data-testid="import-composer"
              aria-label="Kompositör"
              placeholder="Kompositör"
              value={row.composer}
              onChange={(e) => onChange({ composer: e.target.value })}
              disabled={locked}
              autoComplete="off"
              enterKeyHint="done"
            />
          </div>
          {row.status === 'working' ? (
            <div className="mt-2.5 flex items-center gap-2 text-sm text-gold-200" role="status">
              <Spinner className="size-4" />
              <span>{progressText}</span>
            </div>
          ) : null}
          {row.status === 'error' ? (
            <p className="mt-2.5 flex items-start gap-2 text-sm leading-snug text-danger" role="alert">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>{row.error}</span>
            </p>
          ) : null}
        </div>
        {canRemove ? (
          <IconButton label="Ta bort från importen" size="sm" onClick={onRemove} className="-mr-1.5 -mt-1 text-ivory-400">
            <X />
          </IconButton>
        ) : null}
      </div>
    </li>
  )
}
