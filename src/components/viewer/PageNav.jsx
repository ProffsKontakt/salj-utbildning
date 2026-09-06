// Bottom navigation pill for read mode: prev/next, page indicator, fit toggle, zoom.
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, MoveHorizontal, Maximize, Pen } from 'lucide-react'
import { IconButton, cn } from '../ui/index.js'
import { ZOOM_MAX, ZOOM_MIN } from './useViewerGestures.js'

const ZOOM_STEP = 0.25

function zoomIn(z) {
  return Math.min(ZOOM_MAX, Math.round((z + ZOOM_STEP) * 100) / 100)
}
function zoomOut(z) {
  return Math.max(ZOOM_MIN, Math.round((z - ZOOM_STEP) * 100) / 100)
}

/**
 * @param {object} p
 * @param {number} p.index        0-based display index
 * @param {number} p.count
 * @param {(i:number) => void} p.onNavigate
 * @param {string} [p.indicator]  custom indicator text (default "3 / 12")
 * @param {'page'|'width'} [p.fitMode]
 * @param {(m:'page'|'width') => void} [p.onFitModeChange]
 * @param {number} [p.zoom]
 * @param {(z:number) => void} [p.onZoomChange]
 * @param {() => void} [p.onDraw]  show the pen button (enters drawing mode with the pen tool)
 * @param {{prev?:string,next?:string,indicator?:string}} [p.testIds]
 * @param {boolean} [p.compact]   hide zoom buttons (narrow screens)
 */
export function PageNav({ index, count, onNavigate, indicator, fitMode = 'page', onFitModeChange, zoom = 1, onZoomChange, onDraw, testIds = {}, compact = false, className }) {
  const hasPages = count > 0
  const atStart = !hasPages || index <= 0
  const atEnd = !hasPages || index >= count - 1
  const label = indicator ?? (hasPages ? `${index + 1} / ${count}` : '– / –')
  return (
    <div className={cn('pointer-events-auto flex max-w-full items-center gap-0.5 rounded-2xl bg-ink-800/95 p-1 text-ivory-100 shadow-stage backdrop-blur', className)} role="group" aria-label="Sidnavigering">
      <IconButton label="Föregående sida" onClick={() => onNavigate(index - 1)} disabled={atStart} data-testid={testIds.prev || 'page-prev'}>
        <ChevronLeft />
      </IconButton>
      <div className="min-w-[4.5rem] px-1 text-center text-sm tabular-nums text-ivory-100 whitespace-nowrap" data-testid={testIds.indicator || 'page-indicator'} aria-live="polite" aria-atomic="true">
        {label}
      </div>
      <IconButton label="Nästa sida" onClick={() => onNavigate(index + 1)} disabled={atEnd} data-testid={testIds.next || 'page-next'}>
        <ChevronRight />
      </IconButton>
      {onFitModeChange ? (
        <>
          <span className="mx-0.5 h-6 w-px bg-ivory-50/10" aria-hidden="true" />
          <IconButton
            label={fitMode === 'page' ? 'Anpassa till bredd' : 'Anpassa hela sidan'}
            onClick={() => {
              onFitModeChange(fitMode === 'page' ? 'width' : 'page')
              if (zoom !== 1) onZoomChange?.(1)
            }}
            data-testid="fit-toggle"
          >
            {fitMode === 'page' ? <MoveHorizontal /> : <Maximize />}
          </IconButton>
        </>
      ) : null}
      {onZoomChange && !compact ? (
        <>
          <IconButton label="Zooma ut" onClick={() => onZoomChange(zoomOut(zoom))} disabled={zoom <= ZOOM_MIN} data-testid="zoom-out">
            <ZoomOut />
          </IconButton>
          <button
            type="button"
            onClick={() => onZoomChange(1)}
            disabled={zoom === 1}
            className={cn('h-11 min-w-11 rounded-xl px-1.5 text-xs font-medium tabular-nums transition-colors', zoom === 1 ? 'text-ivory-500' : 'text-gold-300 hover:bg-ink-700/70')}
            title="Anpassa"
            aria-label={`Zoom ${Math.round(zoom * 100)} %. Återställ till anpassad storlek`}
            data-testid="zoom-reset"
          >
            {zoom === 1 ? 'Anpassa' : `${Math.round(zoom * 100)} %`}
          </button>
          <IconButton label="Zooma in" onClick={() => onZoomChange(zoomIn(zoom))} disabled={zoom >= ZOOM_MAX} data-testid="zoom-in">
            <ZoomIn />
          </IconButton>
        </>
      ) : null}
      {onDraw ? (
        <>
          <span className="mx-0.5 h-6 w-px bg-ivory-50/10" aria-hidden="true" />
          <IconButton label="Rita och anteckna" variant="primary" onClick={onDraw} data-testid="tool-pen">
            <Pen />
          </IconButton>
        </>
      ) : null}
    </div>
  )
}
