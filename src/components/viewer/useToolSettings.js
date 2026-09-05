// Persisted drawing-tool settings shared by the viewer and the performance mode.
import { useCallback, useMemo } from 'react'
import { useSetting } from '../../hooks/useSetting.js'

export function useToolSettings() {
  const [penColor, setPenColor] = useSetting('penColor')
  const [penWidth, setPenWidth] = useSetting('penWidth')
  const [highlighterColor, setHighlighterColor] = useSetting('highlighterColor')
  const [highlighterWidth, setHighlighterWidth] = useSetting('highlighterWidth')
  const [textColor, setTextColor] = useSetting('textColor')
  const [textSize, setTextSize] = useSetting('textSize')
  const [penOnly, setPenOnly] = useSetting('penOnly')

  const settings = useMemo(
    () => ({ penColor, penWidth, highlighterColor, highlighterWidth, textColor, textSize }),
    [penColor, penWidth, highlighterColor, highlighterWidth, textColor, textSize],
  )

  const setters = useMemo(
    () => ({ penColor: setPenColor, penWidth: setPenWidth, highlighterColor: setHighlighterColor, highlighterWidth: setHighlighterWidth, textColor: setTextColor, textSize: setTextSize }),
    [setPenColor, setPenWidth, setHighlighterColor, setHighlighterWidth, setTextColor, setTextSize],
  )

  const setSetting = useCallback(
    (key, value) => {
      const fn = setters[key]
      if (fn) Promise.resolve(fn(value)).catch(() => {})
    },
    [setters],
  )

  const togglePenOnly = useCallback((v) => Promise.resolve(setPenOnly(!!v)).catch(() => {}), [setPenOnly])

  return { settings, setSetting, penOnly: !!penOnly, setPenOnly: togglePenOnly }
}
