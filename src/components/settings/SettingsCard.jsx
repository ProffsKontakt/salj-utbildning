import { cn } from '../ui/cn.js'

/**
 * One section of the settings page. `tone="danger"` gives the card a velvet hairline.
 */
export function SettingsCard({ icon: Icon, title, description, children, tone = 'default', className, testId }) {
  return (
    <section
      data-testid={testId}
      className={cn(
        'rounded-2xl bg-ink-850 p-5 animate-fade-in',
        tone === 'danger' ? 'shadow-[inset_0_0_0_1px_rgba(163,64,90,0.45)]' : 'hairline',
        className,
      )}
    >
      <header className="flex items-start gap-3">
        {Icon ? (
          <span className={cn('mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl', tone === 'danger' ? 'bg-velvet-500/20 text-[#f08a86]' : 'bg-gold-500/12 text-gold-300')}>
            <Icon className="size-[18px]" aria-hidden="true" />
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-2xl leading-tight text-ivory-50">{title}</h2>
          {description ? <p className="mt-1 text-[13px] leading-snug text-ivory-400">{description}</p> : null}
        </div>
      </header>
      <div className="mt-4">{children}</div>
    </section>
  )
}

/** Soft notice box used inside cards. */
export function Notice({ icon: Icon, tone = 'info', children, className, ...rest }) {
  const tones = {
    info: 'bg-ink-800 text-ivory-200',
    warn: 'bg-gold-500/10 text-gold-200 shadow-[inset_0_0_0_1px_rgba(201,162,74,0.25)]',
    success: 'bg-success/10 text-ivory-100 shadow-[inset_0_0_0_1px_rgba(76,175,125,0.3)]',
    danger: 'bg-velvet-500/15 text-ivory-100 shadow-[inset_0_0_0_1px_rgba(163,64,90,0.4)]',
  }
  return (
    <div className={cn('flex items-start gap-3 rounded-xl px-3.5 py-3 text-[13px] leading-relaxed', tones[tone] || tones.info, className)} {...rest}>
      {Icon ? <Icon className="mt-0.5 size-4 shrink-0 opacity-90" aria-hidden="true" /> : null}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
