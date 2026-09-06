import { ChevronLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { cn } from './cn.js'
import { IconButton } from './IconButton.jsx'

/**
 * Compact top bar for full-screen views. `onBack` defaults to history back
 * (falls back to `fallbackTo` when there is no history).
 */
export function TopBar({ title, subtitle, onBack, fallbackTo = '/', actions, className, children, dark = false }) {
  const navigate = useNavigate()
  const back = () => {
    if (onBack) return onBack()
    if (window.history.length > 1) navigate(-1)
    else navigate(fallbackTo, { replace: true })
  }
  return (
    <header
      className={cn(
        'pt-safe pl-safe pr-safe z-30 flex shrink-0 items-center gap-1 border-b border-ivory-50/8 px-2',
        dark ? 'bg-ink-950/85 backdrop-blur' : 'bg-ink-900/90 backdrop-blur',
        className,
      )}
    >
      <div className="flex h-14 min-w-0 flex-1 items-center gap-1">
        {onBack !== null ? (
          <IconButton label="Tillbaka" onClick={back}>
            <ChevronLeft />
          </IconButton>
        ) : null}
        <div className="min-w-0 flex-1 px-1">
          {title ? <div className="truncate font-display text-xl leading-none text-ivory-50">{title}</div> : null}
          {subtitle ? <div className="mt-0.5 truncate text-xs text-ivory-400">{subtitle}</div> : null}
        </div>
        {children}
        {actions ? <div className="flex items-center gap-0.5">{actions}</div> : null}
      </div>
    </header>
  )
}
