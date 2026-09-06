// Page manager: reorder, rotate, hide/restore and append pages of one score.
// Full-screen view outside the Shell; every change is persisted immediately.
import { useCallback, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Camera, FolderOpen, Library, ListRestart, MoreVertical, Music } from 'lucide-react'
import { getScore, getScoreFile } from '../db/db.js'
import { appendFilesToScore } from '../lib/importScore.js'
import { isImageFile, isPdfFile } from '../lib/image.js'
import { pluralize } from '../lib/format.js'
import { usePdfDocument } from '../hooks/usePdfDocument.js'
import { useOfflineFile } from '../hooks/useOfflineFile.js'
import { IMPORT_ACCEPT, useFilePicker } from '../hooks/useFilePicker.js'
import { useSetting } from '../hooks/useSetting.js'
import { TopBar, Button, IconButton, Menu, ConfirmDialog, EmptyState, Spinner, useToast } from '../components/ui/index.js'
import { ScanSheet } from '../components/import/ScanSheet.jsx'
import { DownloadNeeded } from '../components/viewer/DownloadNeeded.jsx'
import { PageGrid } from '../components/pages/PageGrid.jsx'
import { RemovedPages } from '../components/pages/RemovedPages.jsx'
import { AddPagesMenu } from '../components/pages/AddPagesMenu.jsx'
import { addPagesItems } from '../components/pages/addPagesItems.js'
import { ProgressOverlay } from '../components/pages/ProgressOverlay.jsx'
import { usePageEditor } from '../components/pages/usePageEditor.js'

const ENCRYPTED_MESSAGE = 'Den här PDF:en är skyddad och kan inte utökas. Exportera den först som platt PDF från visaren.'

export default function PageManager() {
  const { scoreId } = useParams()
  // Key by id so switching scores resets all local state.
  return <PageManagerInner key={scoreId} scoreId={scoreId} />
}

function PageManagerInner({ scoreId }) {
  const navigate = useNavigate()
  const toast = useToast()
  const { pickFiles } = useFilePicker()
  const [enhanceSetting] = useSetting('enhanceScans')

  // null = loading, undefined = missing. A stale row for another id counts as loading.
  const scoreRow = useLiveQuery(() => getScore(scoreId), [scoreId], null)
  const score = scoreRow && scoreRow.id !== scoreId ? null : scoreRow
  const missing = score === undefined

  // Page management needs the PDF bytes: a cloud-only score must be downloaded first.
  const onDownloadError = useCallback((message) => toast.error(message), [toast])
  const offline = useOfflineFile(scoreId, { onError: onDownloadError })
  const cloudOnly = !!score && offline.cloudOnly
  const canOpen = !!score && !offline.loading && !offline.cloudOnly

  const editor = usePageEditor(scoreId, score || null, toast)
  const { doc, error: docError, loading: docLoading } = usePdfDocument(canOpen ? scoreId : null, `${editor.version}:${offline.version}`)

  const scrollRef = useRef(null)
  const [resetOpen, setResetOpen] = useState(false)
  const [scanOpen, setScanOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(null)

  const viewerPath = `/noter/${scoreId}`

  const finish = useCallback(() => {
    editor.flushThumbRefresh()
    navigate(viewerPath, { replace: true })
  }, [editor, navigate, viewerPath])

  // ── Append pages ─────────────────────────────────────────────────────
  // Every PDF is appended on its own; all images together form one batch.
  const append = useCallback(
    async (files, { enhance = false } = {}) => {
      if (!files?.length || busy) return
      setBusy(true)
      setProgress(null)
      let added = 0
      try {
        const pdfs = files.filter(isPdfFile)
        const images = files.filter((f) => !isPdfFile(f) && isImageFile(f))
        const batches = [...pdfs.map((f) => [f]), ...(images.length ? [images] : [])]
        if (!batches.length) throw new Error('Inga filer som stöds valdes (PDF, JPEG, PNG, WebP).')
        for (let i = 0; i < batches.length; i++) {
          const fresh = await getScore(scoreId)
          const file = await getScoreFile(scoreId)
          if (!fresh || !file) throw new Error('Stycket hittades inte längre i biblioteket.')
          if (batches.length > 1) setProgress({ done: i, total: batches.length })
          const result = await appendFilesToScore(fresh, file, batches[i], {
            enhance,
            onProgress: batches.length > 1 ? undefined : (done, total) => setProgress({ done, total }),
          })
          added += result.added
        }
        toast.success(`${pluralize(added, 'sida', 'sidor')} ${added === 1 ? 'tillagd' : 'tillagda'}.`)
      } catch (err) {
        toast.error(err?.code === 'ENCRYPTED' ? ENCRYPTED_MESSAGE : err?.message || 'Sidorna kunde inte läggas till.')
      } finally {
        if (added > 0) {
          const updated = await getScore(scoreId).catch(() => null)
          if (updated) editor.adoptAppended(updated)
        }
        setBusy(false)
        setProgress(null)
      }
    },
    [busy, scoreId, editor, toast],
  )

  // Removing hides the page; offer a one-tap undo that puts it back where it was.
  // Depends only on stable callbacks so the memoised tiles are not invalidated.
  const { remove: removePage, restore: restorePage } = editor
  const removeWithUndo = useCallback(
    (srcIndex) => {
      const position = removePage(srcIndex)
      if (position < 0) return false
      toast.info(`Sida ${srcIndex + 1} är dold – den finns kvar i filen.`, {
        action: { label: 'Ångra', onClick: () => restorePage(srcIndex, position) },
      })
      return true
    },
    [removePage, restorePage, toast],
  )

  const addFromFiles = useCallback(async () => {
    if (busy) return
    const files = await pickFiles({ accept: IMPORT_ACCEPT, multiple: true })
    if (!files.length) return // picker cancelled
    // Pictures picked from disk are usually photos too – honour the scan setting.
    await append(files, { enhance: !!enhanceSetting })
  }, [busy, pickFiles, append, enhanceSetting])

  const addFromScan = useCallback(() => {
    if (!busy) setScanOpen(true)
  }, [busy])

  const onScanDone = useCallback(
    (files, { enhance } = {}) => {
      setScanOpen(false)
      append(files, { enhance: !!enhance })
    },
    [append],
  )

  // ── Render states ────────────────────────────────────────────────────
  if (missing) {
    return (
      <div className="stage-bg flex h-dvh flex-col text-ivory-100">
        <TopBar title="Ordna sidor" fallbackTo="/" />
        <EmptyState icon={Music} title="Stycket hittades inte" description="Det kan ha tagits bort från biblioteket." className="flex-1">
          <Button as={Link} to="/">
            <Library className="size-4" aria-hidden="true" />
            Till biblioteket
          </Button>
        </EmptyState>
      </div>
    )
  }

  const count = editor.order.length
  const subtitle = score ? `${pluralize(count, 'sida', 'sidor')} · ${score.title}` : 'Läser in…'

  const menuItems = [
    ...addPagesItems({ onScan: addFromScan, onFiles: addFromFiles, disabled: busy || !score || cloudOnly }),
    { separator: true },
    {
      key: 'reset',
      label: 'Återställ ursprunglig ordning',
      icon: ListRestart,
      onSelect: () => setResetOpen(true),
      disabled: busy || !score || cloudOnly || editor.isOriginal,
    },
  ]

  return (
    <div className="stage-bg flex h-dvh flex-col text-ivory-100" data-testid="page-manager">
      <TopBar
        title="Ordna sidor"
        subtitle={subtitle}
        fallbackTo={viewerPath}
        actions={
          <>
            <Menu
              items={menuItems}
              trigger={(props) => (
                <IconButton label="Fler åtgärder" data-testid="pages-menu" {...props}>
                  <MoreVertical />
                </IconButton>
              )}
            />
            <Button size="md" onClick={finish} data-testid="pages-done" className="ml-1 px-4">
              Klar
            </Button>
          </>
        }
      />

      <div ref={scrollRef} className="pl-safe pr-safe min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto w-full max-w-7xl px-3 pb-[calc(env(safe-area-inset-bottom)+2rem)] pt-4 sm:px-6 sm:pt-5">
          {/* Toolbar */}
          {!cloudOnly ? (
            <div className="mb-4 flex flex-wrap items-center gap-3 sm:mb-5">
              <AddPagesMenu onScan={addFromScan} onFiles={addFromFiles} disabled={busy || !score} />
              <p className="min-w-0 flex-1 basis-56 text-[13px] leading-snug text-ivory-400">
                Dra i handtaget eller använd pilarna för att ändra ordning. Ändringar sparas direkt.
                <span className="hidden md:inline"> Tangentbord: piltangenter flyttar fokus, Skift + pil flyttar sidan, R roterar, Delete tar bort.</span>
              </p>
            </div>
          ) : null}

          {/* Content */}
          {!score || offline.loading ? (
            <div className="flex items-center justify-center py-24 text-gold-300" role="status" aria-label="Läser in">
              <Spinner className="size-8" />
            </div>
          ) : cloudOnly ? (
            <DownloadNeeded score={score} offline={offline} backTo={viewerPath} backLabel="Till visaren" className="py-6" />
          ) : docError ? (
            <EmptyState icon={Music} title="Filen kunde inte öppnas" description={docError} className="py-12">
              <Button as={Link} to={viewerPath} variant="secondary">
                Till visaren
              </Button>
            </EmptyState>
          ) : count === 0 ? (
            <EmptyState
              icon={Music}
              title="Inga sidor visas"
              description={editor.removed.length ? 'Alla sidor är dolda. Återställ dem nedan eller lägg till nya sidor.' : 'Stycket har inga sidor. Lägg till sidor för att komma igång.'}
              className="py-10"
            >
              <Button variant="secondary" onClick={addFromScan} disabled={busy}>
                <Camera className="size-4" aria-hidden="true" />
                Skanna med kameran
              </Button>
              <Button variant="secondary" onClick={addFromFiles} disabled={busy}>
                <FolderOpen className="size-4" aria-hidden="true" />
                Från filer
              </Button>
            </EmptyState>
          ) : (
            <PageGrid
              doc={doc}
              order={editor.order}
              rotations={editor.rotations}
              scrollRoot={scrollRef}
              onReorder={editor.reorder}
              onMove={editor.move}
              onRotate={editor.rotate}
              onRemove={removeWithUndo}
              disabled={busy}
            />
          )}

          {canOpen && docLoading && count > 0 ? (
            <p className="mt-3 flex items-center justify-center gap-2 text-xs text-ivory-500" role="status">
              <Spinner className="size-3.5" /> Läser in sidorna…
            </p>
          ) : null}

          {score && !cloudOnly ? (
            <div className="mt-6">
              <RemovedPages doc={doc} removed={editor.removed} rotations={editor.rotations} scrollRoot={scrollRef} onRestore={editor.restore} disabled={busy} />
            </div>
          ) : null}
        </div>
      </div>

      {/* Live announcements for keyboard/button actions (dnd-kit has its own). */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {editor.announcement}
      </div>

      <ConfirmDialog
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        onConfirm={() => {
          setResetOpen(false)
          editor.resetOrder()
          toast.success('Ursprunglig ordning återställd.')
        }}
        title="Återställ ursprunglig ordning?"
        message="Sidorna visas i filens ordning igen, alla rotationer tas bort och dolda sidor visas. Dina anteckningar påverkas inte."
        confirmLabel="Återställ"
        danger={false}
      />

      <ScanSheet open={scanOpen} onClose={() => setScanOpen(false)} onDone={onScanDone} title="Skanna fler sidor" />
      <ProgressOverlay open={busy} title="Lägger till sidor…" progress={progress} hint="Det kan ta en stund för stora filer." />
    </div>
  )
}
