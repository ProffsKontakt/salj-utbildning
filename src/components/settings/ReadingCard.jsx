import { BookOpen } from 'lucide-react'
import { Select, Toggle, useToast } from '../ui/index.js'
import { useSetting } from '../../hooks/useSetting.js'
import { SettingsCard } from './SettingsCard.jsx'

function SettingToggle({ settingKey, label, description, testId }) {
  const toast = useToast()
  const [value, setValue] = useSetting(settingKey)
  return (
    <Toggle
      label={label}
      description={description}
      checked={!!value}
      data-testid={testId}
      onChange={(v) => setValue(v).catch(() => toast.error('Inställningen kunde inte sparas.'))}
    />
  )
}

/** Reading & drawing preferences (bound to the settings table). */
export function ReadingCard() {
  const toast = useToast()
  const [fitMode, setFitMode] = useSetting('fitMode')
  return (
    <SettingsCard icon={BookOpen} title="Läsning & ritning" description="Hur noterna visas och hur du antecknar i dem.">
      <div className="divide-y divide-ivory-50/8">
        <SettingToggle settingKey="penOnly" label="Rita endast med penna" description="Fingrar bläddrar och zoomar, Apple Pencil ritar." testId="setting-penOnly" />
        <SettingToggle settingKey="tapToTurn" label="Bläddra genom att trycka på sidkanterna" description="Ett tryck till höger går framåt, till vänster bakåt." testId="setting-tapToTurn" />
        <SettingToggle settingKey="keepAwake" label="Håll skärmen tänd" description="Skärmen släcks inte medan du läser noter." testId="setting-keepAwake" />
        <SettingToggle settingKey="enhanceScans" label="Förbättra skanningar automatiskt" description="Gör kamerabilder gråskaliga med högre kontrast, som en ren skanning." testId="setting-enhanceScans" />
        <div className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <span className="min-w-0">
            <span className="block text-[15px] text-ivory-50">Sidanpassning</span>
            <span className="mt-0.5 block text-[13px] leading-snug text-ivory-400">Standardläge när ett stycke öppnas.</span>
          </span>
          <Select
            aria-label="Sidanpassning"
            data-testid="setting-fitMode"
            className="w-full sm:w-56"
            value={fitMode}
            onChange={(e) => setFitMode(e.target.value).catch(() => toast.error('Inställningen kunde inte sparas.'))}
          >
            <option value="page">Anpassa hel sida</option>
            <option value="width">Anpassa bredd</option>
          </Select>
        </div>
      </div>
    </SettingsCard>
  )
}
