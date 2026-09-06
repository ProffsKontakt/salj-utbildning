import { Share, SquarePlus, Check } from 'lucide-react'

const STEPS = [
  { icon: Share, text: 'Tryck på Dela-knappen i Safari (rutan med pilen uppåt).' },
  { icon: SquarePlus, text: 'Välj ”Lägg till på hemskärmen”.' },
  { icon: Check, text: 'Tryck på ”Lägg till”. Öppna sedan Notställ från hemskärmen.' },
]

/** Step-by-step guide for adding the app to the iOS home screen. */
export function IosInstallSteps({ compact = false }) {
  return (
    <ol className={compact ? 'space-y-2.5 pt-1.5 pl-1.5' : 'space-y-3 pt-1.5 pl-1.5'} aria-label="Så här installerar du Notställ">
      {STEPS.map((s, i) => (
        <li key={i} className="flex items-start gap-3">
          <span className="relative mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-gold-500/12 text-gold-300">
            <s.icon className="size-4" aria-hidden="true" />
            <span className="absolute -top-1.5 -left-1.5 flex size-4 items-center justify-center rounded-full bg-gold-500 text-[10px] font-semibold text-ink-950">{i + 1}</span>
          </span>
          <span className="text-[14px] leading-relaxed text-ivory-100">{s.text}</span>
        </li>
      ))}
    </ol>
  )
}
