// Concert mode: a whole setlist, page by page, on a dark full-screen stage.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { X, Pen, BookOpen, CalendarDays, Music } from 'lucide-react'
import { getProject, getProjectSetlist } from '../db/db.js'
import { usePdfDocument } from '../hooks/usePdfDocument.js'
import { useOfflineFile } from '../hooks/useOfflineFile.js'
import { useSync } from '../lib/sync/useSync.js'
import { useSetting } from '../hooks/useSetting.js'
import { useWakeLock } from '../hooks/useWakeLock.js'
import { IconButton, Button, EmptyState, Spinner, TopBar, useToast, cn } from '../components/ui/index.js'
import { ScoreStage } from '../components/viewer/ScoreStage.jsx'
import { DownloadProgress } from '../components/viewer/DownloadNeeded.jsx'
import { AnnotationToolbar } from '../components/viewer/AnnotationToolbar.jsx'
import { PageNav } from '../components/viewer/PageNav.jsx'
import { useToolSettings } from '../components/viewer/useToolSettings.js'
import { useAnnotationEditor } from '../components/viewer/useAnnotationEditor.js'

const CHROME_HIDE_MS = 3000
const TITLE_MS = 2200

export default function Performance() {
  const { projectId } = useParams()
  return <PerformanceInner key={projectId} projectId={projectId} />
}

function PerformanceInner({ projectId }) {
  const navigate = useNavigate()
  const toast = useToast()
  const sync = useSync()
  const [searchParams] = useSearchParams()
  const project = useLiveQuery(() => getProject(projectId), [projectId], null)
  const setlist = useLiveQuery(() => getProjectSetlist(projectId), [projectId], null)

  // Flat sequence of { scoreId, displayIndex } plus lookup tables.
  const { sequence, scores, starts } = useMemo(() => {
    const seq = []
    const byId = new Map()
    const startAt = new Map()
    for (const { score } of setlist || []) {
      if (!score || byId.has(score.id)) continue
      byId.set(score.id, score)
      startAt.set(score.id, seq.length)
      const order = score.pageOrder || []
      for (let d = 0; d < order.length; d++) seq.push({ scoreId: score.id, displayIndex: d })
    }
    return { sequence: seq, scores: byId, starts: startAt }
  }, [setlist])

  const total = sequence.length
  const startId = searchParams.get('start')
  const [pos, setPos] = useState(null)
  const idx = total ? Math.min(total - 1, Math.max(0, pos ?? (startId && starts.has(startId) ? starts.get(startId) : 0))) : 0
  const cur = total ? sequence[idx] : null
  const score = cur ? scores.get(cur.scoreId) : null
  const scoreCount = scores.size
  const scoreNumber = cur ? [...starts.keys()].indexOf(cur.scoreId) + 1 : 0
  const pageCount = score?.pageOrder?.length || 0

  // Prefetch the next score's document.
  const nextScoreId = useMemo(() => {
    if (!cur) return null
    for (let i = idx + 1; i < total; i++) if (sequence[i].scoreId !== cur.scoreId) return sequence[i].scoreId
    return null
  }, [cur, idx, total, sequence])
  const nextStart = nextScoreId ? (starts.get(nextScoreId) ?? null) : null

  // Cloud-only scores: the current one is fetched on demand when reached (whatever the
  // autoDownload setting says); the next one is prefetched only when the setting allows it.
  const onDownloadError = useCallback((message) => toast.error(message), [toast])
  const offline = useOfflineFile(cur?.scoreId ?? null, { auto: true, onError: onDownloadError })
  const nextOffline = useOfflineFile(nextScoreId)
  const cloudOnly = !!cur && !!score && offline.cloudOnly
  const canOpen = !!cur && !offline.loading && !offline.cloudOnly
  const { doc, error: docError, loading: docLoading } = usePdfDocument(canOpen ? cur.scoreId : null, offline.version)
  usePdfDocument(nextScoreId && nextOffline.ready ? nextScoreId : null, nextOffline.version)
  // Online and signed in: the download starts right away – show progress rather than flashing the message.
  const awaitingDownload = sync.online && !offline.error && (sync.authLoading || (sync.cloudReady && !!sync.user))
  const unavailableMessage = !sync.online ? 'Inte nedladdad – hoppa över' : !sync.user ? 'Logga in för att ladda ner stycket' : offline.error || 'Inte nedladdad – hoppa över'

  // ── Settings & tools ─────────────────────────────────────────────────
  const [keepAwake] = useSetting('keepAwake', true)
  useWakeLock(keepAwake !== false)
  const [fitMode, setFitMode] = useSetting('fitMode')
  const [tapToTurn] = useSetting('tapToTurn')
  const { settings: toolSettings, setSetting: setToolSetting, penOnly, setPenOnly } = useToolSettings()
  const changeFitMode = useCallback((m) => Promise.resolve(setFitMode(m)).catch(() => {}), [setFitMode])

  const [tool, setTool] = useState('none')
  const [lastTool, setLastTool] = useState('pen')
  const drawing = tool !== 'none'
  const changeTool = useCallback((t) => {
    setTool(t)
    setLastTool(t)
  }, [])
  const [zoom, setZoom] = useState(1)
  const onSaveError = useCallback(() => toast.error('Anteckningen kunde inte sparas. Försök igen.'), [toast])
  const editor = useAnnotationEditor(score?.id ?? null, score && cur ? (score.pageOrder || [])[cur.displayIndex] ?? null : null, { onSaveError })

  // ── Navigation across the whole setlist ──────────────────────────────
  const goTo = (i) => {
    if (!total) return
    setPos(Math.min(total - 1, Math.max(0, i)))
    setZoom(1)
  }
  // The stage reports -1 / pageCount at the ends of a score (allowOverflow) so we can
  // step into the previous/next score of the setlist.
  const onStageNavigate = (target) => {
    if (!cur) return
    const start = starts.get(cur.scoreId) ?? 0
    if (target < 0) {
      if (idx > 0) goTo(idx - 1)
      return
    }
    if (target >= pageCount) {
      if (idx < total - 1) goTo(idx + 1)
      return
    }
    goTo(start + target)
  }

  // ── Title overlay (shown for a moment when the score changes) ────────
  const [titleShownFor, setTitleShownFor] = useState(null)
  const curScoreId = cur?.scoreId ?? null
  useEffect(() => {
    if (!curScoreId) return
    const t = setTimeout(() => setTitleShownFor(curScoreId), TITLE_MS)
    return () => clearTimeout(t)
  }, [curScoreId])
  const titleVisible = !!curScoreId && titleShownFor !== curScoreId && !cloudOnly

  // ── Auto-hiding chrome in read mode ──────────────────────────────────
  const [chrome, setChrome] = useState({ hidden: false, shownAt: 0 })
  useEffect(() => {
    if (drawing || chrome.hidden) return
    const t = setTimeout(() => setChrome((c) => (c.hidden ? c : { ...c, hidden: true })), CHROME_HIDE_MS)
    return () => clearTimeout(t)
  }, [drawing, chrome])
  const chromeVisible = drawing || !chrome.hidden
  const showChrome = useCallback(() => setChrome({ hidden: false, shownAt: Date.now() }), [])
  // Hidden chrome is `inert` (not focusable, not clickable), so keyboard users need a way to
  // bring it back: Tab (heading for the controls) or Escape reveals it again.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Tab' || e.key === 'Escape') showChrome()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showChrome])
  const onCenterTap = useCallback(() => setChrome((c) => (c.hidden ? { hidden: false, shownAt: Date.now() } : { ...c, hidden: true })), [])

  const exit = () => navigate(`/projekt/${projectId}`)

  // ── Empty / loading states ───────────────────────────────────────────
  if (project === null || setlist === null) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-ink-950 text-gold-300" role="status" aria-label="Laddar konsertläge">
        <Spinner className="size-9" />
      </div>
    )
  }
  if (project === undefined) {
    return (
      <div className="stage-bg fixed inset-0 flex flex-col text-ivory-100">
        <TopBar title="Konsertläge" onBack={() => navigate('/projekt')} dark />
        <EmptyState icon={CalendarDays} title="Projektet finns inte längre" description="Det kan ha tagits bort.">
          <Button as={Link} to="/projekt" replace>
            Till projekten
          </Button>
        </EmptyState>
      </div>
    )
  }
  if (!total) {
    return (
      <div className="stage-bg fixed inset-0 flex flex-col text-ivory-100">
        <TopBar title={project.name} subtitle="Konsertläge" onBack={exit} dark />
        <EmptyState icon={Music} title="Setlistan är tom" description="Lägg till stycken i projektet för att kunna framföra dem här, sida för sida.">
          <Button as={Link} to={`/projekt/${projectId}`} data-testid="performance-exit">
            Tillbaka till projektet
          </Button>
        </EmptyState>
      </div>
    )
  }

  const indicator = `Stycke ${scoreNumber}/${scoreCount} · sida ${(cur?.displayIndex ?? 0) + 1}/${pageCount || 1}`

  return (
    <div className="fixed inset-0 flex flex-col bg-ink-950 text-ivory-100" data-testid="performance">
      {/* Top chrome */}
      <div
        className={cn(
          'pt-safe pl-safe pr-safe absolute inset-x-0 top-0 z-30 transition-[opacity,transform] duration-300',
          chromeVisible ? 'opacity-100' : 'pointer-events-none -translate-y-2 opacity-0',
        )}
        inert={!chromeVisible}
        onPointerDown={showChrome}
        onFocus={showChrome}
      >
        <div className="flex h-14 items-center gap-1 px-2 bg-gradient-to-b from-ink-950/95 via-ink-950/70 to-ink-950/0">
          <IconButton label="Avsluta konsertläge" onClick={exit} data-testid="performance-exit">
            <X />
          </IconButton>
          <div className="min-w-0 flex-1 px-1">
            <div className="truncate font-display text-lg leading-none text-ivory-50">{score?.title || project.name}</div>
            <div className="mt-0.5 truncate text-xs text-ivory-400">
              {project.name}
              {score?.composer ? ` · ${score.composer}` : ''}
            </div>
          </div>
          {drawing ? (
            <IconButton label="Läsläge" active onClick={() => setTool('none')} data-testid="tool-read">
              <BookOpen />
            </IconButton>
          ) : (
            <IconButton label="Rita och anteckna" onClick={() => setTool(lastTool)} data-testid="performance-draw">
              <Pen />
            </IconButton>
          )}
        </div>
      </div>

      {/* Stage */}
      <div className="relative min-h-0 flex-1">
        {(cur && offline.loading) || (docLoading && !docError) ? (
          <div className="absolute inset-0 flex items-center justify-center text-gold-300" role="status" aria-label="Laddar noter">
            <Spinner className="size-9" />
          </div>
        ) : null}
        {cloudOnly ? (
          <div className="absolute inset-0 flex items-center justify-center px-6" onPointerDown={showChrome}>
            <div
              className="w-full max-w-md rounded-3xl bg-ink-900/90 px-6 py-6 text-center shadow-stage backdrop-blur animate-fade-in"
              data-testid="performance-download"
              data-state={offline.downloading || awaitingDownload ? 'downloading' : 'unavailable'}
            >
              <div className="text-xs font-medium uppercase tracking-[0.18em] text-gold-400">
                Stycke {scoreNumber} av {scoreCount}
              </div>
              <div className="mt-1 font-display text-3xl leading-tight text-ivory-50">{score.title}</div>
              {score.composer ? <div className="mt-1 text-sm text-ivory-300">{score.composer}</div> : null}
              {offline.downloading || awaitingDownload ? (
                <DownloadProgress className="mt-4" />
              ) : (
                <>
                  <p className="mt-3 text-[15px] leading-relaxed text-ivory-300" role="status" data-testid="download-skipped">
                    {unavailableMessage}
                  </p>
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                    {sync.online && sync.user ? (
                      <Button onClick={() => offline.download()} data-testid="download-retry">
                        Försök igen
                      </Button>
                    ) : null}
                    {nextStart != null ? (
                      <Button variant="secondary" onClick={() => goTo(nextStart)} data-testid="performance-skip">
                        Hoppa över
                      </Button>
                    ) : null}
                  </div>
                </>
              )}
            </div>
          </div>
        ) : null}
        {docError ? (
          <EmptyState icon={Music} title="Kunde inte öppna noterna" description={docError} className="absolute inset-0">
            <Button variant="secondary" onClick={() => (idx < total - 1 ? goTo(idx + 1) : exit())}>
              {idx < total - 1 ? 'Hoppa till nästa stycke' : 'Avsluta'}
            </Button>
          </EmptyState>
        ) : null}
        {score && doc && !docError ? (
          <ScoreStage
            key={score.id}
            className="absolute inset-y-0 left-[env(safe-area-inset-left)] right-[env(safe-area-inset-right)]"
            testId="performance-stage"
            scoreId={score.id}
            score={score}
            doc={doc}
            displayIndex={cur.displayIndex}
            onNavigate={onStageNavigate}
            allowOverflow
            tool={tool}
            toolSettings={toolSettings}
            penOnly={penOnly}
            fitMode={fitMode}
            onFitModeChange={changeFitMode}
            zoom={zoom}
            onZoomChange={setZoom}
            tapToTurn={tapToTurn !== false}
            editor={editor}
            onCenterTap={onCenterTap}
          />
        ) : null}

        {/* Title overlay when a new score begins */}
        {score ? (
          <div
            className={cn('pointer-events-none absolute inset-x-0 top-20 z-20 flex justify-center px-6 transition-opacity duration-500', titleVisible ? 'opacity-100' : 'opacity-0')}
            aria-hidden={!titleVisible}
          >
            <div className="max-w-xl rounded-2xl bg-ink-900/90 px-6 py-4 text-center shadow-stage backdrop-blur" data-testid="performance-title" data-visible={titleVisible ? 'true' : 'false'}>
              <div className="text-xs font-medium uppercase tracking-[0.18em] text-gold-400">
                Stycke {scoreNumber} av {scoreCount}
              </div>
              <div className="mt-1 font-display text-3xl leading-tight text-ivory-50">{score.title}</div>
              {score.composer ? <div className="mt-1 text-sm text-ivory-300">{score.composer}</div> : null}
            </div>
          </div>
        ) : null}
      </div>

      {/* Bottom chrome */}
      <div
        className={cn(
          'pb-safe pl-safe pr-safe absolute inset-x-0 bottom-0 z-30 flex flex-col items-center gap-2 px-2 pb-2 transition-[opacity,transform] duration-300 md:items-end md:px-4 md:pb-4',
          chromeVisible ? 'opacity-100' : 'pointer-events-none translate-y-2 opacity-0',
        )}
        inert={!chromeVisible}
        onPointerDown={showChrome}
        onFocus={showChrome}
      >
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
        ) : null}
        <PageNav
          index={idx}
          count={total}
          onNavigate={goTo}
          indicator={indicator}
          fitMode={fitMode}
          onFitModeChange={changeFitMode}
          zoom={zoom}
          onZoomChange={setZoom}
          compact
          testIds={{ prev: 'performance-prev', next: 'performance-next', indicator: 'performance-indicator' }}
        />
      </div>
    </div>
  )
}
