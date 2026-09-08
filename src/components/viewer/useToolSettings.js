// Persisted drawing-tool settings shared by the viewer and the performance mode.
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useSetting } from '../../hooks/useSetting.js'
import { onPenSeen } from '../../lib/penState.js'
import { useToast } from '../ui/index.js'

export function useToolSettings() {
  const toast = useToast()
  const [penColor, setPenColor] = useSetting('penColor')
  const [penWidth, setPenWidth] = useSetting('penWidth')
  const [highlighterColor, setHighlighterColor] = useSetting('highlighterColor')
  const [highlighterWidth, setHighlighterWidth] = useSetting('highlighterWidth')
  const [textColor, setTextColor] = useSetting('textColor')
  const [textSize, setTextSize] = useSetting('textSize')
  const [penOnly, setPenOnly] = useSetting('penOnly')
  const [penOnlyChosen, setPenOnlyChosen, chosenLoaded] = useSetting('penOnlyChosen')

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

  // An explicit choice is remembered; the automatic switch below then stays out of the way.
  const togglePenOnly = useCallback(
    (v) => {
      Promise.resolve(setPenOnly(!!v)).catch(() => {})
      Promise.resolve(setPenOnlyChosen(true)).catch(() => {})
    },
    [setPenOnly, setPenOnlyChosen],
  )

  // The first time an Apple Pencil (or any stylus) draws, switch to pen-only so the
  // resting hand never leaves marks – the way Notes and Files behave with a Pencil.
  const latest = useRef({ penOnly, penOnlyChosen, chosenLoaded })
  useEffect(() => {
    latest.current = { penOnly, penOnlyChosen, chosenLoaded }
  }, [penOnly, penOnlyChosen, chosenLoaded])
  useEffect(
    () =>
      onPenSeen(() => {
        const { penOnly: on, penOnlyChosen: chosen, chosenLoaded: loaded } = latest.current
        if (!loaded || chosen || on) return
        Promise.resolve(setPenOnly(true)).catch(() => {})
        Promise.resolve(setPenOnlyChosen(true)).catch(() => {})
        toast.info('Endast penna är på – fingrar bläddrar och zoomar.', {
          action: { label: 'Rita med fingret också', onClick: () => Promise.resolve(setPenOnly(false)).catch(() => {}) },
        })
      }),
    [setPenOnly, setPenOnlyChosen, toast],
  )

  return { settings, setSetting, penOnly: !!penOnly, setPenOnly: togglePenOnly }
}
