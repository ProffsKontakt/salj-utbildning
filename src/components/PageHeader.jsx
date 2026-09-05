import { cn } from './ui/cn.js'
import { Wordmark } from './Logo.jsx'

/** Heading block for shell pages. Shows the wordmark on phones (where the sidebar is hidden). */
export function PageHeader({ eyebrow, title, description, actions, className }) {
  return (
    <div className={cn('pt-safe px-4 pt-4 sm:px-6 md:px-10 md:pt-8', className)}>
      <div className="mb-5 md:hidden">
        <Wordmark />
      </div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          {eyebrow ? <div className="mb-1 text-xs font-medium uppercase tracking-[0.18em] text-gold-400">{eyebrow}</div> : null}
          <h1 className="font-display text-4xl leading-none text-ivory-50 md:text-5xl">{title}</h1>
          {description ? <p className="mt-2 max-w-xl text-[15px] text-ivory-400">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  )
}
