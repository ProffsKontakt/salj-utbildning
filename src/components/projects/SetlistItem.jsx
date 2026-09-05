import { memo } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ChevronDown, ChevronUp, GripVertical, X } from 'lucide-react'
import { pluralize } from '../../lib/format.js'
import { IconButton } from '../ui/index.js'
import { cn } from '../ui/cn.js'
import { ScoreThumb } from './ScoreThumb.jsx'
import { scorePageCount } from './projectUtils.js'

/**
 * One row of the setlist. Sortable via the grip handle (pointer + keyboard);
 * the body opens the score; explicit up/down/remove buttons for everyone else.
 * All callbacks receive the score id.
 */
export const SetlistItem = memo(function SetlistItem({ item, position, total, onOpen, onMove, onRemove, disabled = false }) {
  const { score } = item
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: score.id,
    disabled,
    attributes: { roleDescription: 'sorterbart stycke' },
  })
  const pages = scorePageCount(score)

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      data-testid="setlist-item"
      data-score-id={score.id}
      data-position={position}
      className={cn(
        'relative flex flex-wrap items-center gap-x-1 gap-y-1 rounded-2xl bg-ink-800/55 py-1.5 pl-1 pr-1.5 hairline transition-[background-color,box-shadow,opacity] duration-150 sm:flex-nowrap sm:py-2 sm:pr-2',
        isDragging ? 'z-10 opacity-35' : 'hover:bg-ink-700/60',
      )}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        {...attributes}
        {...listeners}
        disabled={disabled}
        data-testid="setlist-handle"
        aria-label={`Flytta ${score.title}`}
        title="Dra för att ändra ordning"
        className="touch-none select-none inline-flex size-11 shrink-0 cursor-grab items-center justify-center rounded-xl text-ivory-500 transition-colors hover:bg-ink-700 hover:text-ivory-200 active:cursor-grabbing disabled:cursor-default disabled:opacity-40"
      >
        <GripVertical className="size-5" aria-hidden="true" />
      </button>

      <span className="w-7 shrink-0 text-center font-display text-xl leading-none tabular-nums text-gold-300" aria-hidden="true">
        {position + 1}
      </span>

      <button
        type="button"
        onClick={() => onOpen(score.id)}
        className="flex min-w-0 flex-1 basis-40 items-center gap-3 rounded-xl px-1.5 py-1 text-left transition-colors hover:bg-ink-700/60 focus-visible:outline-2 focus-visible:outline-gold-400"
        aria-label={`Öppna ${score.title}, plats ${position + 1} av ${total}`}
      >
        <ScoreThumb score={score} className="h-14 w-11 rounded-md" />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-display text-[19px] leading-tight text-ivory-50" title={score.title}>
            {score.title}
          </span>
          <span className="mt-0.5 block truncate text-[13px] text-ivory-400">
            <span className={cn(!score.composer && 'italic')}>{score.composer || 'Okänd kompositör'}</span>
            <span className="text-ivory-500"> · {pluralize(pages, 'sida', 'sidor')}</span>
            {score.voice ? <span className="text-ivory-500"> · {score.voice}</span> : null}
          </span>
        </span>
      </button>

      <div className="flex basis-full items-center justify-end sm:basis-auto" role="group" aria-label={`Åtgärder för ${score.title}`}>
        <IconButton label="Flytta upp" data-testid="setlist-move-up" disabled={disabled || position === 0} onClick={() => onMove(score.id, -1)}>
          <ChevronUp />
        </IconButton>
        <IconButton label="Flytta ned" data-testid="setlist-move-down" disabled={disabled || position >= total - 1} onClick={() => onMove(score.id, 1)}>
          <ChevronDown />
        </IconButton>
        <IconButton label="Ta bort ur projektet" data-testid="remove-from-project" disabled={disabled} onClick={() => onRemove(score.id)} className="text-ivory-400 hover:text-ivory-50">
          <X />
        </IconButton>
      </div>
    </li>
  )
})

/** Light card rendered under the pointer while dragging. */
export function SetlistPreview({ item, position }) {
  const { score } = item
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-ink-800 px-3 py-2 shadow-stage ring-1 ring-gold-400/60" aria-hidden="true">
      <GripVertical className="size-5 text-ivory-500" />
      <span className="w-7 text-center font-display text-xl leading-none tabular-nums text-gold-300">{position + 1}</span>
      <ScoreThumb score={score} className="h-14 w-11 rounded-md" />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-display text-[19px] leading-tight text-ivory-50">{score.title}</span>
        <span className="block truncate text-[13px] text-ivory-400">{score.composer || 'Okänd kompositör'}</span>
      </span>
    </div>
  )
}
