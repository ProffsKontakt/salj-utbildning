import { memo } from 'react'
import { MoreVertical, Music, BookOpen, ListOrdered, FolderPlus, Pencil, Trash2 } from 'lucide-react'
import { useObjectUrl } from '../../hooks/useObjectUrl.js'
import { pluralize } from '../../lib/format.js'
import { IconButton, Menu } from '../ui/index.js'
import { cn } from '../ui/cn.js'

const MAX_CHIPS = 2

/**
 * One score in the library grid. The card body is a button that opens the
 * viewer; the kebab menu sits over the thumbnail so the two never nest.
 */
export const ScoreCard = memo(function ScoreCard({ score, projects = [], onOpen, onPages, onAddToProject, onEdit, onDelete }) {
  // Keyed on the record, not the buffer: live queries clone `thumb` on every refresh.
  const thumbUrl = useObjectUrl(score.thumb, score.thumbMime || 'image/jpeg', `${score.id}:${score.updatedAt}:${score.thumb?.byteLength ?? 0}`)
  const pageCount = score.pageOrder?.length ?? score.pageCount ?? 0
  const extraChips = projects.length - MAX_CHIPS

  return (
    <li
      data-testid="score-card"
      data-score-id={score.id}
      className="group relative flex flex-col rounded-2xl bg-ink-800/55 p-2.5 hairline transition-[background-color,transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:bg-ink-700/70 hover:shadow-stage animate-fade-in"
    >
      <button
        type="button"
        onClick={() => onOpen(score)}
        className="flex w-full min-w-0 flex-col rounded-xl text-left focus-visible:outline-2 focus-visible:outline-gold-400"
        aria-label={`Öppna ${score.title}`}
      >
        <div className="paper relative aspect-[3/4] w-full overflow-hidden rounded-lg">
          {thumbUrl ? (
            <img src={thumbUrl} alt="" className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.02]" draggable={false} loading="lazy" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-ink-400" aria-hidden="true">
              <Music className="size-10 opacity-60" />
            </div>
          )}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/25 to-transparent" aria-hidden="true" />
        </div>
        <div className="mt-2.5 min-w-0 px-0.5 pb-0.5">
          <h3 className="line-clamp-2 font-display text-[19px] leading-[1.15] text-ivory-50" title={score.title}>
            {score.title}
          </h3>
          <p className={cn('mt-0.5 truncate text-[13px]', score.composer ? 'text-ivory-300' : 'text-ivory-500 italic')} title={score.composer || undefined}>
            {score.composer || 'Okänd kompositör'}
          </p>
          <p className="mt-1 text-xs text-ivory-500 tabular-nums">
            {pluralize(pageCount, 'sida', 'sidor')}
            {score.voice ? ` · ${score.voice}` : ''}
          </p>
          {projects.length ? (
            <ul className="mt-2 flex flex-wrap gap-1" aria-label="Projekt">
              {projects.slice(0, MAX_CHIPS).map((p) => (
                <li key={p.id} className="max-w-full truncate rounded-full bg-gold-500/12 px-2 py-0.5 text-[11px] font-medium text-gold-200" title={p.name}>
                  {p.name}
                </li>
              ))}
              {extraChips > 0 ? <li className="rounded-full bg-ink-700 px-2 py-0.5 text-[11px] font-medium text-ivory-300">+{extraChips}</li> : null}
            </ul>
          ) : null}
        </div>
      </button>

      <Menu
        align="end"
        trigger={(props) => (
          <IconButton
            {...props}
            label={`Fler alternativ för ${score.title}`}
            size="md"
            variant="solid"
            data-testid="score-menu"
            className="absolute right-4 top-4 bg-ink-950/75 text-ivory-50 shadow backdrop-blur-sm transition-opacity hover:bg-ink-900 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:focus-visible:opacity-100 [@media(hover:hover)]:aria-expanded:opacity-100"
          >
            <MoreVertical />
          </IconButton>
        )}
        items={[
          { key: 'open', label: 'Öppna', icon: BookOpen, onSelect: () => onOpen(score) },
          { key: 'pages', label: 'Ordna sidor', icon: ListOrdered, onSelect: () => onPages(score) },
          { key: 'project', label: 'Lägg till i projekt', icon: FolderPlus, onSelect: () => onAddToProject(score) },
          { key: 'edit', label: 'Redigera info', icon: Pencil, onSelect: () => onEdit(score) },
          { separator: true },
          { key: 'delete', label: 'Ta bort', icon: Trash2, danger: true, onSelect: () => onDelete(score) },
        ]}
      />
    </li>
  )
})

/** Placeholder card shown while the library is loading. */
export function ScoreCardSkeleton({ index = 0 }) {
  return (
    <li className="flex flex-col rounded-2xl bg-ink-800/40 p-2.5 hairline" aria-hidden="true" style={{ animationDelay: `${index * 60}ms` }}>
      <div className="aspect-[3/4] w-full rounded-lg bg-ink-700/60 animate-pulse-soft" />
      <div className="mt-3 h-4 w-4/5 rounded bg-ink-700/60 animate-pulse-soft" />
      <div className="mt-2 h-3 w-1/2 rounded bg-ink-700/50 animate-pulse-soft" />
      <div className="mt-2 h-3 w-1/3 rounded bg-ink-700/40 animate-pulse-soft" />
    </li>
  )
}
