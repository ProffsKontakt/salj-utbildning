import { useEffect } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { applyPendingReload } from '../pwa.js'
import { Library, CalendarDays, Settings } from 'lucide-react'
import { cn } from './ui/cn.js'
import { Wordmark } from './Logo.jsx'

const NAV = [
  { to: '/', label: 'Bibliotek', icon: Library, end: true },
  { to: '/projekt', label: 'Projekt', icon: CalendarDays },
  { to: '/installningar', label: 'Inställningar', icon: Settings },
]

/** App frame: sidebar on desktop, bottom tab bar on phones/tablets in portrait. */
export function Shell() {
  const location = useLocation()
  // Apply a deferred app update once the user is back in the library.
  useEffect(() => {
    applyPendingReload()
  }, [])
  return (
    <div className="stage-bg flex min-h-dvh text-ivory-100">
      <aside className="pt-safe pl-safe sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-ivory-50/8 bg-ink-950/40 px-4 pb-6 md:flex">
        <div className="flex h-20 items-center px-2">
          <Wordmark />
        </div>
        <nav className="mt-2 flex flex-col gap-1" aria-label="Huvudmeny">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] transition-colors',
                  isActive ? 'bg-gold-500/12 text-gold-200 shadow-glow' : 'text-ivory-300 hover:bg-ink-700/60 hover:text-ivory-50',
                )
              }
            >
              <n.icon className="size-5" />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto px-3 text-xs leading-relaxed text-ivory-500">
          Dina noter sparas lokalt på den här enheten.
        </div>
      </aside>

      <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
        <main key={location.pathname} className="pl-safe pr-safe flex-1 pb-[calc(env(safe-area-inset-bottom)+5rem)] md:pb-10">
          <Outlet />
        </main>
      </div>

      <nav
        className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-ivory-50/8 bg-ink-950/85 backdrop-blur md:hidden"
        aria-label="Huvudmeny"
      >
        <div className="grid h-16 grid-cols-3">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                cn('flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors', isActive ? 'text-gold-300' : 'text-ivory-400 hover:text-ivory-100')
              }
            >
              <n.icon className="size-[22px]" />
              {n.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
