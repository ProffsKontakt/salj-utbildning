// Full-screen score viewer: one score, page by page, with annotation tools,
// thumbnails, notes, export and score management.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { BookOpen, Pen, LayoutGrid, NotebookPen, MoreVertical, ListOrdered, Info, FolderPlus, FileDown, Trash2, Library, Music } from 'lucide-react'
import { db, deleteScore, getSetting, setSetting, touchScoreOpened, updateScore } from '../db/db.js'
import { invalidateScoreDocument } from '../lib/pdf.js'
import { usePdfDocument } from '../hooks/usePdfDocument.js'
import { useSetting } from '../hooks/useSetting.js'
import { useWakeLock } from '../hooks/useWakeLock.js'
import { useMediaQuery } from '../hooks/useMediaQuery.js'
import { TopBar, IconButton, Button, ConfirmDialog, EmptyState, Menu, Spinner, useToast, cn } from '../components/ui/index.js'
import { ScoreStage } from '../components/viewer/ScoreStage.jsx'
import { AnnotationToolbar } from '../components/viewer/AnnotationToolbar.jsx'
import { PageNav } from '../components/viewer/PageNav.jsx'
import { ThumbStrip } from '../components/viewer/ThumbStrip.jsx'
import { NotesDrawer } from '../components/viewer/NotesDrawer.jsx'
import { ExportDialog } from '../components/viewer/ExportDialog.jsx'
import { ScoreInfoDialog } from '../components/viewer/ScoreInfoDialog.jsx'
import { useToolSettings } from '../components/viewer/useToolSettings.js'
import { useAnnotationEditor } from '../components/viewer/useAnnotationEditor.js'
import { AddToProjectDialog } from '../components/projects/AddToProjectDialog.jsx'

export default function ScoreViewer() {
  const { scoreId } = useParams()
  // Key by id so switching between scores resets every piece of local state.
  return <ScoreViewerInner key={scoreId} scoreId={scoreId} />
}

function parsePageParam(v) {
  const n = parseInt(v || '', 10)
  return Number.isFinite(n) && n >= 1 ? n - 1 : null
}

function ScoreViewerInner({ scoreId }) {
  const navigate = useNavigate()
  const toast = useToast()
  const [searchParams] = useSearchParams()
  const isWide = useMediaQuery('(min-width: 768px)')

  // null = loading, undefined = missing
  const scoreRow = useLiveQuery(() => db.scores.get(scoreId), [scoreId], null)
  // A stale row from a previous query (different id) is treated as still loading.
  const score = scoreRow && scoreRow.id !== scoreId ? null : scoreRow
  const missing = score === undefined
  const loadingScore = score === null

  // Reload the document when the page manager replaced the file bytes.
  const version = score ? `${score.pageCount}:${score.fileSize || 0}` : 0
  const { doc, error: docError, loading: docLoading } = usePdfDocument(score ? scoreId : null, version)

  const pageOrder = useMemo(() => score?.pageOrder || [], [score])
  const count = pageOrder.length

  // ── Position ─────────────────────────────────────────────────────────
  const [pos, setPos] = useState(() => parsePageParam(searchParams.get('sida')))
  useEffect(() => {
    if (pos !== null) return
    let alive = true
    getSetting(`lastPage:${scoreId}`, 0).then((v) => {
      if (alive) setPos((p) => (p === null ? (Number.isInteger(v) && v >= 0 ? v : 0) : p))
    })
    return () => {
      alive = false
    }
  }, [scoreId, pos])
  const idx = count ? Math.min(count - 1, Math.max(0, pos ?? 0)) : 0

  const navigateTo = useCallback(
    (i) => {
      setPos(Math.min(Math.max(0, count - 1), Math.max(0, i)))
    },
    [count],
  )

  // Remember the last viewed page (also for deep links and thumbnail jumps).
  useEffect(() => {
    if (pos === null || !count) return
    setSetting(`lastPage:${scoreId}`, idx).catch(() => {})
  }, [scoreId, idx, pos, count])

  useEffect(() => {
    touchScoreOpened(scoreId).catch(() => {})
  }, [scoreId])

  // ── Settings ─────────────────────────────────────────────────────────
  const [keepAwake] = useSetting('keepAwake')
  useWakeLock(!!keepAwake)
  const [fitMode, setFitMode] = useSetting('fitMode')
  const [tapToTurn] = useSetting('tapToTurn')
  const { settings: toolSettings, setSetting: setToolSetting, penOnly, setPenOnly } = useToolSettings()
  const changeFitMode = useCallback((m) => Promise.resolve(setFitMode(m)).catch(() => {}), [setFitMode])

  // ── Mode & tools ─────────────────────────────────────────────────────
  const [tool, setTool] = useState('none')
  const [lastTool, setLastTool] = useState('pen')
  const drawing = tool !== 'none'
  const enterDraw = useCallback((t) => setTool(t || lastTool), [lastTool])
  const exitDraw = useCallback(() => setTool('none'), [])
  const changeTool = useCallback((t) => {
    setTool(t)
    setLastTool(t)
  }, [])

  const [zoom, setZoom] = useState(1)
  const [showThumbs, setShowThumbs] = useState(false)
  const [showNotes, setShowNotes] = useState(false)

  // The annotation editor for the current page lives here so the notes drawer and the
  // toolbar share it synchronously with the stage.
  const pageIndex = count ? pageOrder[idx] : null
  const onSaveError = useCallback(() => toast.error('Anteckningen kunde inte sparas. Försök igen.'), [toast])
  const editor = useAnnotationEditor(score ? scoreId : null, pageIndex, { onSaveError })

  // ── Dialogs ──────────────────────────────────────────────────────────
  const [infoOpen, setInfoOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const confirmDelete = async () => {
    if (deleting) return
    setDeleting(true)
    try {
      await editor.flush()
      await deleteScore(scoreId)
      invalidateScoreDocument(scoreId)
      toast.success('Stycket togs bort')
      navigate('/', { replace: true })
    } catch {
      toast.error('Stycket kunde inte tas bort.')
      setDeleting(false)
    }
  }

  const saveScoreNotes = useCallback(
    (notes) => {
      updateScore(scoreId, { notes }).catch(() => toast.error('Anteckningen om stycket kunde inte sparas.'))
    },
    [scoreId, toast],
  )

  const menuItems = [
    { label: 'Ordna sidor', icon: ListOrdered, onSelect: () => navigate(`/noter/${scoreId}/sidor`), testId: 'page-manager-link', key: 'pages' },
    { label: 'Redigera info', icon: Info, onSelect: () => setInfoOpen(true), testId: 'edit-info', key: 'info' },
    { label: 'Lägg till i projekt', icon: FolderPlus, onSelect: () => setAddOpen(true), testId: 'add-to-project', key: 'add' },
    { label: 'Exportera PDF', icon: FileDown, onSelect: () => setExportOpen(true), testId: 'export-pdf', key: 'export', disabled: !count },
    { separator: true },
    { label: 'Ta bort stycke', icon: Trash2, danger: true, onSelect: () => setDeleteOpen(true), testId: 'delete-score', key: 'delete' },
  ]

  // ── States: missing / loading ────────────────────────────────────────
  if (missing) {
    return (
      <div className="stage-bg fixed inset-0 flex flex-col text-ivory-100">
        <TopBar title="Notställ" fallbackTo="/" dark />
        <EmptyState icon={Music} title="Stycket finns inte längre" description="Det kan ha tagits bort från biblioteket eller från en annan enhet.">
          <Button as={Link} to="/" replace>
            <Library className="size-4" />
            Till biblioteket
          </Button>
        </EmptyState>
      </div>
    )
  }

  const subtitle = score ? `${score.composer ? `${score.composer} · ` : ''}${count ? `Sida ${idx + 1} av ${count}` : 'Inga sidor'}` : ''

  return (
    <div className="fixed inset-0 flex flex-col bg-ink-950 text-ivory-100" data-testid="score-viewer">
      <TopBar
        title={score?.title || ' '}
        subtitle={subtitle}
        fallbackTo="/"
        dark
        actions={
          <>
            {drawing ? (
              <IconButton label="Läsläge" onClick={exitDraw} active data-testid="tool-read">
                <BookOpen />
              </IconButton>
            ) : (
              <IconButton label="Rita och anteckna" onClick={() => enterDraw()} disabled={!count} data-testid="mode-draw">
                <Pen />
              </IconButton>
            )}
            <IconButton label={showThumbs ? 'Dölj sidöversikt' : 'Visa sidöversikt'} active={showThumbs} onClick={() => setShowThumbs((v) => !v)} disabled={!count} data-testid="thumbs-toggle">
              <LayoutGrid />
            </IconButton>
            <IconButton label={showNotes ? 'Dölj anteckningar' : 'Visa anteckningar'} active={showNotes} onClick={() => setShowNotes((v) => !v)} data-testid="notes-toggle">
              <NotebookPen />
            </IconButton>
            <Menu
              trigger={(props) => (
                <IconButton label="Meny" {...props} data-testid="viewer-menu">
                  <MoreVertical />
                </IconButton>
              )}
              items={menuItems}
            />
          </>
        }
      />

      <div className="flex min-h-0 flex-1">
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="relative min-h-0 flex-1">
            {loadingScore || (score && docLoading && !docError) ? (
              <div className="absolute inset-0 flex items-center justify-center text-gold-300" role="status">
                <Spinner className="size-9" />
                <span className="sr-only">Laddar noter…</span>
              </div>
            ) : null}

            {score && docError ? (
              <EmptyState icon={Music} title="Kunde inte öppna noterna" description={docError} className="absolute inset-0">
                <Button as={Link} to="/" variant="secondary">
                  Till biblioteket
                </Button>
              </EmptyState>
            ) : null}

            {score && !docError && count === 0 ? (
              <EmptyState icon={ListOrdered} title="Inga sidor kvar" description="Alla sidor i stycket har tagits bort. Lägg till sidor igen i sidhanteraren." className="absolute inset-0">
                <Button as={Link} to={`/noter/${scoreId}/sidor`}>
                  Ordna sidor
                </Button>
              </EmptyState>
            ) : null}

            {score && doc && count > 0 ? (
              <ScoreStage
                className="absolute inset-y-0 left-[env(safe-area-inset-left)] right-[env(safe-area-inset-right)]"
                scoreId={scoreId}
                score={score}
                doc={doc}
                displayIndex={idx}
                onNavigate={navigateTo}
                tool={tool}
                toolSettings={toolSettings}
                penOnly={penOnly}
                fitMode={fitMode}
                onFitModeChange={changeFitMode}
                zoom={zoom}
                onZoomChange={setZoom}
                tapToTurn={!!tapToTurn}
                editor={editor}
              />
            ) : null}

            {showNotes && !isWide ? (
              <NotesDrawer
                variant="sheet"
                open
                onClose={() => setShowNotes(false)}
                pageNumber={idx + 1}
                pageNote={editor.note}
                onPageNoteChange={editor.setNote}
                scoreNotes={score?.notes || ''}
                onScoreNotesChange={saveScoreNotes}
              />
            ) : null}
          </div>

          {/* Bottom controls (layout-reserved so the fitted page is never covered). */}
          {score && count > 0 ? (
            <div className={cn('pb-safe pl-safe pr-safe z-20 flex shrink-0 flex-col items-center px-2 pt-2 pb-2', drawing ? 'gap-2' : '')} data-testid="viewer-controls">
              {drawing ? (
                <AnnotationToolbar
                  tool={tool}
                  onToolChange={changeTool}
                  settings={toolSettings}
                  onSettingChange={setToolSetting}
                  penOnly={penOnly}
                  onPenOnlyChange={setPenOnly}
                  canUndo={editor.canUndo}
                  canRedo={editor.canRedo}
                  onUndo={editor.undo}
                  onRedo={editor.redo}
                  onClearPage={editor.clearPage}
                  canClear={editor.hasInk}
                />
              ) : (
                <PageNav
                  index={idx}
                  count={count}
                  onNavigate={navigateTo}
                  fitMode={fitMode}
                  onFitModeChange={changeFitMode}
                  zoom={zoom}
                  onZoomChange={setZoom}
                  onDraw={() => enterDraw('pen')}
                  compact={!isWide}
                />
              )}
            </div>
          ) : null}

          {showThumbs && score && doc && count > 0 ? (
            <div className="pb-safe shrink-0 border-t border-ivory-50/8 bg-ink-900/90 backdrop-blur">
              <ThumbStrip doc={doc} pageOrder={pageOrder} rotations={score.rotations || {}} displayIndex={idx} onSelect={navigateTo} />
            </div>
          ) : null}
        </div>

        {showNotes && isWide ? (
          <NotesDrawer
            variant="side"
            open
            onClose={() => setShowNotes(false)}
            pageNumber={idx + 1}
            pageNote={editor.note}
            onPageNoteChange={editor.setNote}
            scoreNotes={score?.notes || ''}
            onScoreNotesChange={saveScoreNotes}
          />
        ) : null}
      </div>

      <ScoreInfoDialog open={infoOpen} onClose={() => setInfoOpen(false)} score={score || null} />
      <AddToProjectDialog open={addOpen} onClose={() => setAddOpen(false)} scoreIds={[scoreId]} />
      <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} score={score || null} doc={doc} />
      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={confirmDelete}
        loading={deleting}
        title="Ta bort stycket?"
        message={`”${score?.title || 'Stycket'}” och alla dess anteckningar tas bort från den här enheten. Det går inte att ångra.`}
        confirmLabel="Ta bort"
      />
    </div>
  )
}
