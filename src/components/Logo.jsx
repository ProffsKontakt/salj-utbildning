import { cn } from './ui/cn.js'

/** Fermata-inspired mark: a held note, the singer's breath. */
export function LogoMark({ className }) {
  return (
    <svg viewBox="0 0 64 64" className={cn('size-8', className)} aria-hidden="true">
      <defs>
        <linearGradient id="nsg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e8cf86" />
          <stop offset="1" stopColor="#c9a24a" />
        </linearGradient>
      </defs>
      <path d="M8 40c6-16 42-16 48 0" fill="none" stroke="url(#nsg)" strokeWidth="4.5" strokeLinecap="round" />
      <circle cx="32" cy="44" r="5.5" fill="url(#nsg)" />
    </svg>
  )
}

export function Wordmark({ className }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark />
      <span className="font-display text-2xl font-semibold tracking-wide text-ivory-50">
        Not<span className="text-gold-300">ställ</span>
      </span>
    </span>
  )
}
