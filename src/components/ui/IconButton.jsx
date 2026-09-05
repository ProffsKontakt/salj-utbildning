import { forwardRef } from 'react'
import { cn } from './cn.js'

const SIZES = { sm: 'size-9 rounded-lg [&>svg]:size-4', md: 'size-11 rounded-xl [&>svg]:size-5', lg: 'size-12 rounded-2xl [&>svg]:size-6' }
const VARIANTS = {
  ghost: 'text-ivory-200 hover:bg-ink-700/80 active:bg-ink-600 disabled:text-ivory-500',
  solid: 'bg-ink-700 text-ivory-100 hover:bg-ink-600 active:bg-ink-500 hairline disabled:text-ivory-500',
  primary: 'bg-gold-500 text-ink-950 hover:bg-gold-400 active:bg-gold-600 disabled:bg-ink-600 disabled:text-ivory-400',
  active: 'bg-gold-500/20 text-gold-300 shadow-glow',
}

/** Square icon-only button. Always give it a `label` (used as aria-label + title). */
export const IconButton = forwardRef(function IconButton(
  { label, size = 'md', variant = 'ghost', active = false, className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      aria-pressed={active || undefined}
      className={cn(
        'inline-flex shrink-0 items-center justify-center transition-[background-color,transform,box-shadow] duration-150 active:scale-95 disabled:active:scale-100 select-none',
        SIZES[size] || SIZES.md,
        active ? VARIANTS.active : VARIANTS[variant] || VARIANTS.ghost,
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
})
