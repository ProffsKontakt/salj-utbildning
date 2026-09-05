import { memo } from 'react'
import { Link } from 'react-router-dom'
import { MapPin, MoreVertical, Pencil, Play, Trash2 } from 'lucide-react'
import { IconButton, Menu } from '../ui/index.js'
import { cn } from '../ui/cn.js'
import { ScoreThumb } from './ScoreThumb.jsx'
import { describeProjectDate, summarizeSetlist } from './projectUtils.js'

/**
 * One project in the list. The whole card is a link to the detail page; the
 * kebab menu floats over it as a sibling so interactive elements never nest.
 * `summary` = { count, pages, scores } from summarizeProjects().
 */
export const ProjectCard = memo(function ProjectCard({ project, summary, past = false, onEdit, onPerform, onDelete }) {
  const { count = 0, pages = 0, scores = [] } = summary || {}
  const dateLine = describeProjectDate(project.date)
  const extra = count - scores.length

  return (
    <li
      data-testid="project-card"
      data-project-id={project.id}
      className={cn(
        'group relative flex rounded-2xl bg-ink-800/55 hairline transition-[background-color,transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:bg-ink-700/70 hover:shadow-stage animate-fade-in',
        past && 'bg-ink-850/70',
      )}
    >
      <Link
        to={`/projekt/${project.id}`}
        className="flex min-w-0 flex-1 flex-col rounded-2xl p-4 pr-16 focus-visible:outline-2 focus-visible:outline-gold-400 sm:p-5 sm:pr-16"
        aria-label={`Öppna projektet ${project.name}`}
      >
        <div className={cn('truncate text-xs font-medium uppercase tracking-[0.14em]', past ? 'text-ivory-500' : dateLine ? 'text-gold-400' : 'text-ivory-500')}>
          {dateLine || 'Datum ej bestämt'}
        </div>
        <h3 className="mt-1 line-clamp-2 font-display text-2xl leading-tight text-ivory-50" title={project.name}>
          {project.name}
        </h3>
        {project.venue ? (
          <p className="mt-1.5 flex min-w-0 items-center gap-1.5 text-[13px] text-ivory-300">
            <MapPin className="size-3.5 shrink-0 text-ivory-400" aria-hidden="true" />
            <span className="truncate">{project.venue}</span>
          </p>
        ) : null}

        <div className="mt-auto flex min-h-14 items-end justify-between gap-3 pt-5">
          <div className="flex min-w-0 items-center gap-1.5">
            {scores.map((s) => (
              <ScoreThumb key={s.id} score={s} className="h-14 w-10 rounded-[5px] shadow-[0_2px_6px_rgba(0,0,0,0.5)] ring-1 ring-ink-950/60" iconClassName="size-4" />
            ))}
            {extra > 0 ? <span className="ml-1 rounded-full bg-ink-700 px-2 py-0.5 text-[11px] font-medium text-ivory-300">+{extra}</span> : null}
          </div>
          <p className={cn('shrink-0 text-right text-xs tabular-nums', count === 0 ? 'italic text-ivory-500' : 'text-ivory-400')}>
            {count === 0 ? 'Inga stycken ännu' : summarizeSetlist(count, pages)}
          </p>
        </div>
      </Link>

      <Menu
        align="end"
        testId="project-menu-popover"
        trigger={(props) => (
          <IconButton {...props} label={`Fler alternativ för ${project.name}`} variant="ghost" data-testid="project-menu" className="absolute right-3 top-3 text-ivory-300 hover:text-ivory-50">
            <MoreVertical />
          </IconButton>
        )}
        items={[
          { key: 'edit', label: 'Redigera', icon: Pencil, onSelect: () => onEdit(project) },
          { key: 'perform', label: 'Starta konsertläge', icon: Play, disabled: count === 0, hint: count === 0 ? 'Tom setlista' : undefined, onSelect: () => onPerform(project) },
          { separator: true },
          { key: 'delete', label: 'Ta bort', icon: Trash2, danger: true, onSelect: () => onDelete(project) },
        ]}
      />
    </li>
  )
})

/** Placeholder card shown while projects load. */
export function ProjectCardSkeleton({ index = 0 }) {
  return (
    <li className="flex flex-col rounded-2xl bg-ink-800/40 p-5 hairline" aria-hidden="true" style={{ animationDelay: `${index * 60}ms` }}>
      <div className="h-3 w-1/3 rounded bg-ink-700/60 animate-pulse-soft" />
      <div className="mt-3 h-6 w-3/4 rounded bg-ink-700/60 animate-pulse-soft" />
      <div className="mt-2 h-3 w-1/2 rounded bg-ink-700/50 animate-pulse-soft" />
      <div className="mt-6 flex items-center gap-1">
        <div className="h-14 w-10 rounded bg-ink-700/50 animate-pulse-soft" />
        <div className="h-14 w-10 rounded bg-ink-700/40 animate-pulse-soft" />
        <div className="h-14 w-10 rounded bg-ink-700/30 animate-pulse-soft" />
      </div>
    </li>
  )
}
