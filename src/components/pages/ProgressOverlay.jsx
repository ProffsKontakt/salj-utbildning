// Blocking progress overlay used while pages are appended to the PDF.
import { createPortal } from 'react-dom'
import { Spinner } from '../ui/index.js'

/**
 * @param {object} p
 * @param {boolean} p.open
 * @param {string} p.title
 * @param {{done:number,total:number}|null} [p.progress]
 * @param {string} [p.hint]
 */
export function ProgressOverlay({ open, title, progress, hint }) {
  if (!open) return null
  const pct = progress && progress.total ? Math.round((progress.done / progress.total) * 100) : null
  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-ink-950/75 p-6 backdrop-blur-sm animate-fade-in-plain" role="dialog" aria-modal="true" aria-busy="true" aria-label={title} data-testid="pages-progress">
      <div className="flex w-full max-w-xs flex-col items-center rounded-3xl bg-ink-850 px-6 py-7 text-center shadow-stage">
        <Spinner className="size-8 text-gold-300" />
        <p className="mt-4 font-display text-2xl leading-tight text-ivory-50">{title}</p>
        {pct !== null ? (
          <>
            <p className="mt-1 text-sm text-ivory-400 tabular-nums" aria-live="polite">
              {progress.done} av {progress.total}
            </p>
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-ink-700" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
              <div className="h-full rounded-full bg-gold-500 transition-[width] duration-200" style={{ width: `${pct}%` }} />
            </div>
          </>
        ) : hint ? (
          <p className="mt-1 text-sm text-ivory-400">{hint}</p>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}
