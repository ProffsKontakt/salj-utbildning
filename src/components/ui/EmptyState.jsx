import { cn } from './cn.js'

export function EmptyState({ icon: Icon, title, description, children, className }) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-16 text-center animate-fade-in', className)}>
      {Icon ? (
        <div className="mb-5 flex size-16 items-center justify-center rounded-full bg-gold-500/10 text-gold-300 shadow-glow">
          <Icon className="size-7" />
        </div>
      ) : null}
      <h3 className="font-display text-3xl text-ivory-50">{title}</h3>
      {description ? <p className="mt-2 max-w-sm text-[15px] leading-relaxed text-ivory-400">{description}</p> : null}
      {children ? <div className="mt-6 flex flex-wrap items-center justify-center gap-3">{children}</div> : null}
    </div>
  )
}
