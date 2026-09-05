import { forwardRef, useId } from 'react'
import { cn } from './cn.js'

const base =
  'w-full rounded-xl bg-ink-800 px-3.5 text-[15px] text-ivory-50 placeholder:text-ivory-500 hairline focus:outline-none focus:shadow-glow transition-shadow disabled:opacity-60'

export const TextField = forwardRef(function TextField({ label, hint, error, className, inputClassName, id: idProp, ...rest }, ref) {
  const auto = useId()
  const id = idProp || auto
  return (
    <label htmlFor={id} className={cn('block', className)}>
      {label ? <span className="mb-1.5 block text-xs font-medium uppercase tracking-[0.12em] text-ivory-400">{label}</span> : null}
      <input ref={ref} id={id} className={cn(base, 'h-11', error && 'shadow-[inset_0_0_0_1px_var(--color-danger)]', inputClassName)} {...rest} />
      {error ? <span className="mt-1 block text-xs text-danger">{error}</span> : hint ? <span className="mt-1 block text-xs text-ivory-500">{hint}</span> : null}
    </label>
  )
})

export const TextArea = forwardRef(function TextArea({ label, hint, className, inputClassName, id: idProp, rows = 3, ...rest }, ref) {
  const auto = useId()
  const id = idProp || auto
  return (
    <label htmlFor={id} className={cn('block', className)}>
      {label ? <span className="mb-1.5 block text-xs font-medium uppercase tracking-[0.12em] text-ivory-400">{label}</span> : null}
      <textarea ref={ref} id={id} rows={rows} className={cn(base, 'resize-y py-2.5 leading-relaxed', inputClassName)} {...rest} />
      {hint ? <span className="mt-1 block text-xs text-ivory-500">{hint}</span> : null}
    </label>
  )
})

export function Select({ label, className, children, id: idProp, ...rest }) {
  const auto = useId()
  const id = idProp || auto
  return (
    <label htmlFor={id} className={cn('block', className)}>
      {label ? <span className="mb-1.5 block text-xs font-medium uppercase tracking-[0.12em] text-ivory-400">{label}</span> : null}
      <select id={id} className={cn(base, 'h-11 appearance-none')} {...rest}>
        {children}
      </select>
    </label>
  )
}

export function Toggle({ label, description, checked, onChange, disabled }) {
  return (
    <label className={cn('flex items-center justify-between gap-4 py-3', disabled && 'opacity-60')}>
      <span className="min-w-0">
        <span className="block text-[15px] text-ivory-50">{label}</span>
        {description ? <span className="mt-0.5 block text-[13px] leading-snug text-ivory-400">{description}</span> : null}
      </span>
      <span className="relative inline-flex shrink-0">
        <input type="checkbox" role="switch" className="peer sr-only" checked={!!checked} disabled={disabled} onChange={(e) => onChange?.(e.target.checked)} />
        <span className="h-7 w-12 rounded-full bg-ink-600 transition-colors peer-checked:bg-gold-500 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-gold-400 peer-focus-visible:outline-offset-2" />
        <span className="pointer-events-none absolute top-1 left-1 size-5 rounded-full bg-ivory-50 shadow transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  )
}
