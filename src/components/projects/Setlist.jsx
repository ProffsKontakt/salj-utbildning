// Sortable setlist (dnd-kit). Pointer drags start from the grip handle only
// (distance 6 px, so the page still scrolls under a finger); the keyboard
// sensor works on the focused handle. Swedish announcements from dndA11y.
// The DragOverlay is portaled to <body>: ancestors with transform animations
// (the page's fade-in) would otherwise become its containing block and shift it.
import { useCallback, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { SETLIST_DND_A11Y } from '../../lib/dndA11y.js'
import { SetlistItem, SetlistPreview } from './SetlistItem.jsx'

// Hoisted so the sensor descriptors (and every row's listeners) stay stable.
const POINTER_OPTIONS = { activationConstraint: { distance: 6 } }
const KEYBOARD_OPTIONS = { coordinateGetter: sortableKeyboardCoordinates }
const DROP_ANIMATION = { duration: 180, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)' }

/**
 * @param {object} p
 * @param {{link:object, score:object}[]} p.items   in display order
 * @param {(orderedScoreIds:string[]) => void} p.onReorder
 * @param {(scoreId:string, delta:number) => void} p.onMove
 * @param {(scoreId:string) => void} p.onRemove
 * @param {(scoreId:string) => void} p.onOpen
 * @param {boolean} [p.disabled]
 * @param {Set<string>|null} [p.downloadedIds]  score ids whose PDF is on this device (null = unknown)
 * @param {Set<string>} [p.downloadingIds]      score ids currently being downloaded
 */
export function Setlist({ items, onReorder, onMove, onRemove, onOpen, disabled = false, downloadedIds = null, downloadingIds = null }) {
  const [activeId, setActiveId] = useState(null)
  const ids = useMemo(() => items.map((it) => it.score.id), [items])
  const sensors = useSensors(useSensor(PointerSensor, POINTER_OPTIONS), useSensor(KeyboardSensor, KEYBOARD_OPTIONS))

  const handleDragStart = useCallback(({ active }) => setActiveId(active.id), [])
  const handleDragCancel = useCallback(() => setActiveId(null), [])
  const handleDragEnd = useCallback(
    ({ active, over }) => {
      setActiveId(null)
      if (!over || active.id === over.id) return
      const from = ids.indexOf(active.id)
      const to = ids.indexOf(over.id)
      if (from < 0 || to < 0) return
      onReorder(arrayMove(ids, from, to))
    },
    [ids, onReorder],
  )

  const activeIndex = activeId ? ids.indexOf(activeId) : -1
  const activeItem = activeIndex >= 0 ? items[activeIndex] : null

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      accessibility={SETLIST_DND_A11Y}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ol data-testid="setlist" aria-label="Setlista i spelordning" className="m-0 flex list-none flex-col gap-2 p-0">
          {items.map((it, i) => (
            <SetlistItem
              key={it.score.id}
              item={it}
              position={i}
              total={items.length}
              downloaded={!downloadedIds || downloadedIds.has(it.score.id)}
              downloading={!!downloadingIds?.has(it.score.id)}
              onOpen={onOpen}
              onMove={onMove}
              onRemove={onRemove}
              disabled={disabled}
            />
          ))}
        </ol>
      </SortableContext>
      {createPortal(
        <DragOverlay dropAnimation={DROP_ANIMATION} zIndex={60}>
          {activeItem ? <SetlistPreview item={activeItem} position={activeIndex} /> : null}
        </DragOverlay>,
        document.body,
      )}
    </DndContext>
  )
}
