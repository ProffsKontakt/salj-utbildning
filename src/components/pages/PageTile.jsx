// One sortable page tile in the page manager grid.
//
// Split in two: the thin outer <li> owns useSortable (dnd-kit re-runs it in
// every tile when the sort order changes) while the memoised TileBody holds
// the thumbnail, badges and buttons and only re-renders when its own primitive
// props change. With 300 pages a reorder therefore costs 300 trivial renders
// plus two real ones.
import { memo } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ChevronLeft, ChevronRight, GripVertical, RotateCw, Trash2 } from 'lucide-react'
import { PageThumb } from './PageThumb.jsx'
import { TILE_PADDING, THUMB_ASPECT, tileId, tileLabel } from './tileUtils.js'
import { IconButton } from '../ui/index.js'
import { cn } from '../ui/cn.js'

/** Footer action that stretches to a quarter of the tile so four fit on a phone. */
function TileButton({ label, onClick, disabled, danger = false, testId, children }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      data-testid={testId}
      className={cn(
        'inline-flex h-11 min-w-0 flex-1 items-center justify-center rounded-lg transition-[background-color,transform] duration-150 active:scale-95 disabled:active:scale-100 select-none [&>svg]:size-5',
        danger ? 'text-[#f08a86] hover:bg-velvet-600/40 active:bg-velvet-600/60' : 'text-ivory-200 hover:bg-ink-700/80 active:bg-ink-600',
        'disabled:text-ivory-500 disabled:hover:bg-transparent',
      )}
    >
      {children}
    </button>
  )
}

const TileBody = memo(function TileBody({
  doc,
  srcIndex,
  position,
  total,
  rotation,
  thumbW,
  thumbH,
  scrollRoot,
  handleRef,
  handleAttributes,
  handleListeners,
  isDragging,
  disabled,
  canRemove,
  onRotate,
  onMove,
  onRemove,
}) {
  return (
    <>
      <div className="relative rounded-xl bg-ink-950/50" style={{ padding: TILE_PADDING, paddingBottom: 0 }}>
        <PageThumb doc={doc} pageIndex={srcIndex} rotation={rotation} width={thumbW} height={thumbH} root={scrollRoot} className="mx-auto rounded-lg" />

        <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-ink-950/85 px-2.5 py-1 text-xs font-semibold tabular-nums text-ivory-50 shadow" aria-hidden="true">
          {position + 1}
        </span>

        <IconButton
          ref={handleRef}
          label="Dra för att flytta sidan"
          size="md"
          variant="solid"
          data-testid="tile-handle"
          className={cn('no-callout absolute right-3 top-3 touch-none select-none bg-ink-950/85 text-ivory-100 shadow', isDragging ? 'cursor-grabbing' : 'cursor-grab')}
          {...handleAttributes}
          {...handleListeners}
          disabled={disabled}
        >
          <GripVertical />
        </IconButton>

        {rotation ? (
          <span className="pointer-events-none absolute bottom-2 right-3 rounded-full bg-gold-500/90 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-ink-950 shadow" aria-hidden="true">
            {rotation}°
          </span>
        ) : null}
      </div>

      <div className="flex items-center py-1" role="group" aria-label={`Åtgärder för sida ${srcIndex + 1}`}>
        <TileButton label="Rotera 90 grader" onClick={() => onRotate(srcIndex)} disabled={disabled} testId="tile-rotate">
          <RotateCw />
        </TileButton>
        <TileButton label="Flytta åt vänster" onClick={() => onMove(position, -1)} disabled={disabled || position === 0} testId="tile-move-left">
          <ChevronLeft />
        </TileButton>
        <TileButton label="Flytta åt höger" onClick={() => onMove(position, 1)} disabled={disabled || position >= total - 1} testId="tile-move-right">
          <ChevronRight />
        </TileButton>
        <TileButton label={canRemove ? 'Ta bort sidan (göms – finns kvar i filen)' : 'Den sista sidan kan inte tas bort'} onClick={() => onRemove(srcIndex)} disabled={disabled || !canRemove} danger testId="tile-remove">
          <Trash2 />
        </TileButton>
      </div>
    </>
  )
})

/**
 * @param {object} p
 * @param {object|null} p.doc
 * @param {number} p.srcIndex        source page index (0-based)
 * @param {number} p.position        display index (0-based)
 * @param {number} p.total           number of displayed pages
 * @param {number} p.rotation
 * @param {number} p.width           tile width in CSS px (0 while measuring)
 * @param {{current: Element|null}} p.scrollRoot
 * @param {(srcIndex:number)=>void} p.onRotate       stable
 * @param {(position:number, delta:number)=>void} p.onMove   stable
 * @param {(srcIndex:number)=>void} p.onRemove       stable
 * @param {(e:KeyboardEvent, position:number)=>void} p.onKeyDown
 * @param {boolean} p.canRemove
 * @param {boolean} [p.disabled]
 */
export const PageTile = memo(function PageTile({ doc, srcIndex, position, total, rotation, width, scrollRoot, onRotate, onMove, onRemove, onKeyDown, canRemove, disabled = false }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: tileId(srcIndex),
    disabled,
    attributes: { roleDescription: 'sorterbar sida' },
  })
  const thumbW = Math.max(0, width - TILE_PADDING * 2)
  const thumbH = Math.round(thumbW * THUMB_ASPECT)

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      tabIndex={0}
      aria-label={tileLabel(srcIndex, position, total, rotation)}
      data-testid="page-tile"
      data-source-index={srcIndex}
      data-position={position}
      onKeyDown={(e) => onKeyDown?.(e, position)}
      className={cn(
        'group relative flex list-none flex-col rounded-2xl bg-ink-800/60 hairline outline-none transition-[background-color,box-shadow] duration-150',
        'focus-visible:shadow-glow focus-visible:bg-ink-700/70',
        isDragging ? 'z-10 opacity-35' : 'hover:bg-ink-700/70',
      )}
    >
      <TileBody
        doc={doc}
        srcIndex={srcIndex}
        position={position}
        total={total}
        rotation={rotation}
        thumbW={thumbW}
        thumbH={thumbH}
        scrollRoot={scrollRoot}
        handleRef={setActivatorNodeRef}
        handleAttributes={attributes}
        handleListeners={listeners}
        isDragging={isDragging}
        disabled={disabled}
        canRemove={canRemove}
        onRotate={onRotate}
        onMove={onMove}
        onRemove={onRemove}
      />
    </li>
  )
})

/** Lightweight card shown under the pointer while dragging. */
export function TilePreview({ doc, srcIndex, position, rotation, width }) {
  const thumbW = Math.max(0, width - TILE_PADDING * 2)
  const thumbH = Math.round(thumbW * THUMB_ASPECT)
  return (
    <div className="rounded-2xl bg-ink-800 shadow-stage ring-1 ring-gold-400/60" style={{ width }} aria-hidden="true">
      <div className="relative rounded-xl bg-ink-950/50" style={{ padding: TILE_PADDING }}>
        <PageThumb doc={doc} pageIndex={srcIndex} rotation={rotation} width={thumbW} height={thumbH} lazy={false} className="mx-auto rounded-lg" />
        <span className="absolute left-3 top-3 rounded-full bg-gold-500 px-2.5 py-1 text-xs font-semibold tabular-nums text-ink-950 shadow">{position + 1}</span>
      </div>
      <div className="px-3 py-2 text-center text-xs text-ivory-300">Sida {srcIndex + 1} i filen</div>
    </div>
  )
}
