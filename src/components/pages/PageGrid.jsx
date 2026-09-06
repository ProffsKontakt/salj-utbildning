// Sortable grid of page tiles (dnd-kit) with keyboard shortcuts.
import { useCallback, useMemo, useRef, useState } from 'react'
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, TraversalOrder, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { PAGE_DND_A11Y } from '../../lib/dndA11y.js'
import { useElementSize } from '../../hooks/useElementSize.js'
import { PageTile, TilePreview } from './PageTile.jsx'
import { tileId, tileSrcIndex } from './tileUtils.js'

const MIN_COL = 168 // px – four 44 px footer buttons fit at 176 px, two columns fit a 390 px phone
const MAX_COLS = 6
const GAP = 12

// Hoisted so dnd-kit's sensor descriptors (and thus every tile's listeners) stay stable.
const POINTER_OPTIONS = { activationConstraint: { distance: 6 } }
const KEYBOARD_OPTIONS = { coordinateGetter: sortableKeyboardCoordinates }
const AUTO_SCROLL = { order: TraversalOrder.ReversedTreeOrder }
const DROP_ANIMATION = { duration: 180, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)' }

/**
 * @param {object} p
 * @param {object|null} p.doc
 * @param {number[]} p.order              source indices in display order
 * @param {Record<number,number>} p.rotations
 * @param {{current: Element|null}} p.scrollRoot
 * @param {(nextOrder:number[], message?:string)=>void} p.onReorder
 * @param {(from:number, to:number)=>boolean} p.onMove
 * @param {(srcIndex:number)=>void} p.onRotate
 * @param {(srcIndex:number)=>boolean} p.onRemove
 * @param {boolean} [p.disabled]
 */
export function PageGrid({ doc, order, rotations, scrollRoot, onReorder, onMove, onRotate, onRemove, disabled = false }) {
  const gridRef = useRef(null)
  const { width: gridWidth } = useElementSize(gridRef)
  const cols = gridWidth ? Math.max(2, Math.min(MAX_COLS, Math.floor((gridWidth + GAP) / (MIN_COL + GAP)))) : 2
  const tileWidth = gridWidth ? Math.floor((gridWidth - GAP * (cols - 1)) / cols) : 0

  const [activeId, setActiveId] = useState(null)
  const ids = useMemo(() => order.map(tileId), [order])
  const total = order.length
  const canRemove = total > 1

  const sensors = useSensors(useSensor(PointerSensor, POINTER_OPTIONS), useSensor(KeyboardSensor, KEYBOARD_OPTIONS))

  const handleDragStart = useCallback(({ active }) => setActiveId(active.id), [])
  const handleDragCancel = useCallback(() => setActiveId(null), [])
  const handleDragEnd = useCallback(
    ({ active, over }) => {
      setActiveId(null)
      if (!over || active.id === over.id) return
      const from = order.indexOf(tileSrcIndex(active.id))
      const to = order.indexOf(tileSrcIndex(over.id))
      if (from < 0 || to < 0) return
      onReorder(arrayMove(order, from, to), `Sida ${order[from] + 1} flyttad till plats ${to + 1} av ${order.length}.`)
    },
    [order, onReorder],
  )

  const focusTile = useCallback((position) => {
    const tiles = gridRef.current?.querySelectorAll('[data-testid="page-tile"]')
    tiles?.[position]?.focus?.()
  }, [])

  const moveBy = useCallback((position, delta) => onMove(position, position + delta), [onMove])

  // Keyboard shortcuts on a focused tile. Events from the handle/footer buttons
  // are ignored so dnd-kit's own keyboard sensor and the buttons keep working.
  const handleTileKeyDown = useCallback(
    (e, position) => {
      if (e.target !== e.currentTarget || disabled) return
      const src = order[position]
      const cols = Math.max(1, Math.round((gridWidth + GAP) / (tileWidth + GAP)) || 1)
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowLeft': {
          const delta = e.key === 'ArrowRight' ? 1 : -1
          e.preventDefault()
          if (e.shiftKey) moveBy(position, delta)
          else focusTile(Math.min(total - 1, Math.max(0, position + delta)))
          break
        }
        case 'ArrowDown':
        case 'ArrowUp': {
          const delta = e.key === 'ArrowDown' ? cols : -cols
          const target = position + delta
          if (target < 0 || target >= total) return
          e.preventDefault()
          if (e.shiftKey) onMove(position, target)
          else focusTile(target)
          break
        }
        case 'Home':
          e.preventDefault()
          if (e.shiftKey) onMove(position, 0)
          else focusTile(0)
          break
        case 'End':
          e.preventDefault()
          if (e.shiftKey) onMove(position, total - 1)
          else focusTile(total - 1)
          break
        case 'r':
        case 'R':
          if (e.metaKey || e.ctrlKey || e.altKey) return
          e.preventDefault()
          onRotate(src)
          break
        case 'Delete':
        case 'Backspace':
          e.preventDefault()
          if (canRemove && onRemove(src)) {
            // Focus the tile that takes this position (or the new last one).
            requestAnimationFrame(() => focusTile(Math.min(position, total - 2)))
          }
          break
        default:
      }
    },
    [disabled, order, gridWidth, tileWidth, total, moveBy, focusTile, onMove, onRotate, onRemove, canRemove],
  )

  const activeSrc = activeId !== null ? tileSrcIndex(activeId) : null
  const activePosition = activeSrc !== null ? order.indexOf(activeSrc) : -1

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      accessibility={PAGE_DND_A11Y}
      autoScroll={AUTO_SCROLL}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext items={ids} strategy={rectSortingStrategy}>
        <ol
          ref={gridRef}
          data-testid="page-grid"
          aria-label="Sidor i visningsordning"
          className="grid list-none p-0 m-0"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: GAP, visibility: tileWidth ? undefined : 'hidden' }}
        >
          {order.map((srcIndex, position) => (
            <PageTile
              key={srcIndex}
              doc={doc}
              srcIndex={srcIndex}
              position={position}
              total={total}
              rotation={rotations[srcIndex] || 0}
              width={tileWidth}
              scrollRoot={scrollRoot}
              onRotate={onRotate}
              onMove={moveBy}
              onRemove={onRemove}
              onKeyDown={handleTileKeyDown}
              canRemove={canRemove}
              disabled={disabled}
            />
          ))}
        </ol>
      </SortableContext>
      <DragOverlay dropAnimation={DROP_ANIMATION} zIndex={60}>
        {activeSrc !== null && activePosition >= 0 ? <TilePreview doc={doc} srcIndex={activeSrc} position={activePosition} rotation={rotations[activeSrc] || 0} width={tileWidth} /> : null}
      </DragOverlay>
    </DndContext>
  )
}
