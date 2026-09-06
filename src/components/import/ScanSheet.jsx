// CONTRACT: <ScanSheet open onClose onDone={(files: File[], { enhance: boolean }) => void} title? />
// Full-screen sheet for capturing several photos with the camera (one per
// shot, looped), reviewing/reordering/removing them, toggling scan enhancement,
// then handing the ordered File[] back through onDone.
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Camera, ChevronLeft, ChevronRight, Images, Trash2, X, ScanLine } from 'lucide-react'
import { IMAGE_ACCEPT, useFilePicker } from '../../hooks/useFilePicker.js'
import { useSetting } from '../../hooks/useSetting.js'
import { imageFilePreview, isImageFile } from '../../lib/image.js'
import { pluralize } from '../../lib/format.js'
import { uid } from '../../lib/ids.js'
import { Button, IconButton, Spinner, Toggle, useToast } from '../ui/index.js'
import { cn } from '../ui/cn.js'

export function ScanSheet({ open, onClose, onDone, title = 'Skanna noter' }) {
  // Mount a fresh inner component per opening so page state and previews reset.
  if (!open) return null
  return <ScanSheetInner onClose={onClose} onDone={onDone} title={title} />
}

const PREVIEW_SIDE = 480

function ScanSheetInner({ onClose, onDone, title }) {
  const toast = useToast()
  const { pickCamera, pickFiles } = useFilePicker()
  const [enhance, setEnhance] = useSetting('enhanceScans')
  const [pages, setPages] = useState([]) // [{ id, file }]
  // id → { url, enhance, error } – the ref is the source of truth for URL revocation.
  const previewsRef = useRef(new Map())
  const [previews, setPreviews] = useState(() => new Map())
  const takeRef = useRef(null)
  // Consumers often pass an inline onClose; keep the latest in a ref so the
  // one-time effect below never re-runs (and never steals focus again).
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  // Escape closes, lock body scroll, focus the primary action.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCloseRef.current?.()
      }
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const t = setTimeout(() => takeRef.current?.focus?.(), 30)
    return () => {
      clearTimeout(t)
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [])

  // Revoke every preview URL when the sheet unmounts.
  useEffect(() => {
    const map = previewsRef.current
    return () => {
      for (const p of map.values()) if (p.url) URL.revokeObjectURL(p.url)
      map.clear()
    }
  }, [])

  // Generate previews for new pages immediately; re-generate all when the
  // enhancement toggle changes (debounced so rapid toggling does not thrash).
  useEffect(() => {
    const map = previewsRef.current
    const missing = pages.some((p) => !map.has(p.id))
    const stale = pages.some((p) => map.has(p.id) && map.get(p.id).enhance !== enhance && !map.get(p.id).error)
    if (!missing && !stale) return
    let cancelled = false
    const timer = setTimeout(async () => {
      for (const p of pages) {
        if (cancelled) return
        const cur = map.get(p.id)
        if (cur && (cur.enhance === enhance || cur.error)) continue
        try {
          const url = await imageFilePreview(p.file, { maxSide: PREVIEW_SIDE, enhance })
          if (cancelled) {
            // Effect re-ran (page added/removed or toggle changed) – drop this result.
            URL.revokeObjectURL(url)
            return
          }
          const old = map.get(p.id)
          if (old?.url) URL.revokeObjectURL(old.url)
          map.set(p.id, { url, enhance, error: null })
        } catch (err) {
          if (cancelled) return
          map.set(p.id, { url: null, enhance, error: err?.message || 'Bilden kunde inte läsas.' })
        }
        setPreviews(new Map(map))
      }
    }, missing ? 0 : 250)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [pages, enhance])

  const addFiles = (files) => {
    if (!files?.length) return // picker cancelled
    const images = files.filter(isImageFile)
    if (!images.length) {
      toast.error('Bara bilder (JPEG, PNG, WebP) kan läggas till som sidor.')
      return
    }
    if (images.length < files.length) toast.info('Filer som inte är bilder hoppades över.')
    // New ids have no preview yet, so the effect renders them right away.
    setPages((prev) => [...prev, ...images.map((file) => ({ id: uid(), file }))])
  }

  const takePhoto = async () => addFiles(await pickCamera())
  const chooseImages = async () => addFiles(await pickFiles({ accept: IMAGE_ACCEPT, multiple: true }))

  const removePage = (id) => {
    const map = previewsRef.current
    const entry = map.get(id)
    if (entry?.url) URL.revokeObjectURL(entry.url)
    map.delete(id)
    setPreviews(new Map(map))
    setPages((prev) => prev.filter((p) => p.id !== id))
  }

  const movePage = (index, delta) => {
    setPages((prev) => {
      const to = index + delta
      if (to < 0 || to >= prev.length) return prev
      const next = prev.slice()
      const [item] = next.splice(index, 1)
      next.splice(to, 0, item)
      return next
    })
  }

  // Pages whose preview failed cannot be decoded by this browser (e.g. HEIC/AVIF
  // picked from the library). Handing them on would fail the whole import and
  // lose every other photo, so block "Klar" until the user removes them.
  const unreadable = pages.filter((p) => previews.get(p.id)?.error).length

  const finish = () => {
    if (!pages.length || unreadable) return
    onDone?.(
      pages.map((p) => p.file),
      { enhance: !!enhance },
    )
  }

  const count = pages.length

  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col bg-ink-900 text-ivory-100 animate-fade-in-plain" role="dialog" aria-modal="true" aria-label={title} data-testid="scan-sheet">
      <header className="pt-safe pl-safe pr-safe z-10 shrink-0 border-b border-ivory-50/8 bg-ink-900/90 px-2 backdrop-blur">
        <div className="flex h-14 items-center gap-1">
          <IconButton label="Avbryt skanning" onClick={onClose} data-close>
            <X />
          </IconButton>
          <div className="min-w-0 flex-1 px-1">
            <div className="truncate font-display text-xl leading-none text-ivory-50">{title}</div>
            <div className="mt-0.5 truncate text-xs text-ivory-400">Ta en bild per sida</div>
          </div>
          <span className="rounded-full bg-ink-700 px-3 py-1 text-xs font-medium text-ivory-200 tabular-nums" aria-live="polite">
            {pluralize(count, 'sida', 'sidor')}
          </span>
        </div>
      </header>

      <div className="pl-safe pr-safe min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-5xl px-4 py-5 sm:px-6">
          <section className="rounded-3xl bg-ink-850 p-5 shadow-stage sm:p-6" aria-label="Fotografera">
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Button ref={takeRef} size="lg" onClick={takePhoto} data-testid="scan-take" className="w-full sm:w-auto sm:min-w-56">
                <Camera className="size-5" aria-hidden="true" />
                Ta bild
              </Button>
              <Button variant="secondary" size="lg" onClick={chooseImages} className="w-full sm:w-auto">
                <Images className="size-5" aria-hidden="true" />
                Välj från bilder
              </Button>
            </div>
            <p className="mt-3 text-center text-[13px] leading-relaxed text-ivory-400">
              Håll kameran rakt över sidan i bra ljus. Varje bild blir en sida i stycket – i den ordning de ligger här.
            </p>
            <div className="mt-3 border-t border-ivory-50/8">
              <Toggle
                label="Förbättra skanning"
                description="Svartvitt med högre kontrast, som en riktig skanner."
                checked={!!enhance}
                onChange={(v) => setEnhance(v).catch(() => toast.error('Inställningen kunde inte sparas.'))}
              />
            </div>
          </section>

          <section className="mt-6" aria-label="Sidor">
            <div className="mb-3 flex items-baseline justify-between px-0.5">
              <h2 className="font-display text-2xl text-ivory-50">Sidor</h2>
              {count > 1 ? <span className="text-xs text-ivory-500">Flytta sidorna för att ändra ordning</span> : null}
            </div>
            {count === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-ivory-50/12 px-6 py-12 text-center">
                <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-gold-500/10 text-gold-300">
                  <ScanLine className="size-6" aria-hidden="true" />
                </div>
                <p className="font-display text-xl text-ivory-100">Inga sidor än</p>
                <p className="mt-1 max-w-xs text-sm text-ivory-400">Ta en bild av första sidan så visas den här.</p>
              </div>
            ) : (
              <ol className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6" aria-label="Skannade sidor">
                {pages.map((p, i) => (
                  <PageTile
                    key={p.id}
                    index={i}
                    total={count}
                    preview={previews.get(p.id)}
                    stale={previews.get(p.id) ? previews.get(p.id).enhance !== enhance && !previews.get(p.id).error : false}
                    onMove={(d) => movePage(i, d)}
                    onRemove={() => removePage(p.id)}
                  />
                ))}
              </ol>
            )}
          </section>
        </div>
      </div>

      <footer className="pb-safe pl-safe pr-safe shrink-0 border-t border-ivory-50/8 bg-ink-900/95 backdrop-blur">
        {unreadable ? (
          <p className="mx-auto w-full max-w-5xl px-4 pt-3 text-center text-[13px] leading-snug text-danger sm:px-6" role="status">
            {unreadable === 1 ? 'En sida kunde inte läsas.' : `${unreadable} sidor kunde inte läsas.`} Ta bort {unreadable === 1 ? 'den' : 'dem'} för att fortsätta.
          </p>
        ) : null}
        <div className="mx-auto flex w-full max-w-5xl items-center justify-end gap-2 px-4 py-3 sm:px-6">
          <Button variant="ghost" onClick={onClose} className="flex-1 sm:flex-none">
            Avbryt
          </Button>
          <Button onClick={finish} disabled={count === 0 || unreadable > 0} data-testid="scan-done" className="flex-[2] sm:flex-none sm:min-w-44">
            Klar ({pluralize(count, 'sida', 'sidor')})
          </Button>
        </div>
      </footer>
    </div>,
    document.body,
  )
}

function PageTile({ index, total, preview, stale, onMove, onRemove }) {
  const url = preview?.url || null
  const error = preview?.error || null
  return (
    <li className="w-40 shrink-0 snap-start animate-fade-in sm:w-auto" data-testid="scan-page">
      <div className={cn('relative aspect-[3/4] overflow-hidden rounded-xl bg-ink-800 hairline', url && 'bg-ink-950')}>
        {url ? (
          <img src={url} alt={`Sida ${index + 1}`} className={cn('h-full w-full object-contain transition-opacity', stale && 'opacity-60')} draggable={false} />
        ) : error ? (
          <div className="flex h-full items-center justify-center p-3 text-center text-xs leading-snug text-danger" role="alert">
            {error}
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center animate-pulse-soft bg-ink-700/50 text-ivory-400">
            <Spinner className="size-5" />
          </div>
        )}
        <span className="absolute left-2 top-2 rounded-full bg-ink-950/85 px-2 py-0.5 text-xs font-semibold text-ivory-50 tabular-nums shadow">{index + 1}</span>
        {stale && url ? <Spinner className="absolute right-2 top-2 size-4 text-gold-300" /> : null}
      </div>
      <div className="mt-1.5 flex items-center justify-between">
        <IconButton label="Flytta åt vänster" size="md" onClick={() => onMove(-1)} disabled={index === 0} data-testid="scan-move-left">
          <ChevronLeft />
        </IconButton>
        <IconButton label="Ta bort sidan" size="md" onClick={onRemove} className="text-[#f08a86] hover:bg-velvet-600/40" data-testid="scan-remove">
          <Trash2 />
        </IconButton>
        <IconButton label="Flytta åt höger" size="md" onClick={() => onMove(1)} disabled={index === total - 1} data-testid="scan-move-right">
          <ChevronRight />
        </IconButton>
      </div>
    </li>
  )
}
