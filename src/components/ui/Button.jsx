import { forwardRef } from 'react'
import { cn } from './cn.js'

const VARIANTS = {
  primary:
    'bg-gold-500 text-ink-950 hover:bg-gold-400 active:bg-gold-600 shadow-[0_6px_20px_-8px_rgba(201,162,74,0.7)] disabled:bg-ink-600 disabled:text-ivory-400 disabled:shadow-none',
  secondary: 'bg-ink-700 text-ivory-100 hover:bg-ink-600 active:bg-ink-500 hairline disabled:text-ivory-400',
  ghost: 'bg-transparent text-ivory-200 hover:bg-ink-700/70 active:bg-ink-600 disabled:text-ivory-400',
  outline: 'bg-transparent text-gold-300 hairline-strong hover:bg-gold-500/10 active:bg-gold-500/15 disabled:text-ivory-400',
  danger: 'bg-velvet-500 text-ivory-50 hover:bg-velvet-400 active:bg-velvet-600 disabled:bg-ink-600 disabled:text-ivory-400',
}

const SIZES = {
  sm: 'h-9 px-3 text-[13px] gap-1.5 rounded-lg',
  md: 'h-11 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-13 px-6 text-base gap-2.5 rounded-2xl',
}

export const Button = forwardRef(function Button(
  { as: Comp = 'button', variant = 'primary', size = 'md', className, children, loading = false, disabled, type, ...rest },
  ref,
) {
  const isButton = Comp === 'button'
  return (
    <Comp
      ref={ref}
      type={isButton ? type || 'button' : undefined}
      disabled={isButton ? disabled || loading : undefined}
      aria-disabled={!isButton && (disabled || loading) ? true : undefined}
      className={cn(
        'inline-flex items-center justify-center font-medium whitespace-nowrap select-none transition-[background-color,transform,box-shadow] duration-150 active:scale-[0.98] disabled:active:scale-100',
        VARIANTS[variant] || VARIANTS.primary,
        SIZES[size] || SIZES.md,
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner className="size-4" /> : null}
      {children}
    </Comp>
  )
})

export function Spinner({ className }) {
  return (
    <svg className={cn('animate-spin-slow', className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}
