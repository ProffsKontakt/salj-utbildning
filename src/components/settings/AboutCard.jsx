import { Info, Keyboard } from 'lucide-react'
import { SettingsCard } from './SettingsCard.jsx'

export const APP_VERSION = '1.0'

const SHORTCUTS = [
  { keys: ['←', '→'], what: 'Bläddra bakåt / framåt' },
  { keys: ['Mellanslag'], what: 'Nästa sida (Skift + mellanslag: föregående)' },
  { keys: ['PgUp', 'PgDn'], what: 'Föregående / nästa sida' },
  { keys: ['Home', 'End'], what: 'Första / sista sidan' },
]

/** App info and viewer keyboard shortcuts. */
export function AboutCard() {
  return (
    <SettingsCard icon={Info} title="Om" description={`Notställ ${APP_VERSION}`}>
      <p className="text-[13px] leading-relaxed text-ivory-300">
        Dina noter lagras endast på den här enheten. Notställ är byggt för sångare som vill skanna, ordna, anteckna och framföra från skärmen – utan konto och utan moln.
      </p>
      <div className="mt-4 rounded-xl bg-ink-800 p-3.5">
        <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.12em] text-ivory-400">
          <Keyboard className="size-4" aria-hidden="true" />
          Tangentbord i visaren
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[13px]">
          {SHORTCUTS.map((s) => (
            <div key={s.what} className="contents">
              <dt className="flex items-center gap-1">
                {s.keys.map((k) => (
                  <kbd key={k} className="inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-ink-700 px-1.5 font-sans text-[12px] text-ivory-100 hairline">
                    {k}
                  </kbd>
                ))}
              </dt>
              <dd className="m-0 self-center text-ivory-300">{s.what}</dd>
            </div>
          ))}
        </dl>
      </div>
    </SettingsCard>
  )
}
