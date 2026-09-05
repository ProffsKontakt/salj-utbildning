import { useCallback } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, DEFAULT_SETTINGS, setSetting } from '../db/db.js'

/**
 * Reactive setting backed by the settings table.
 * Returns [value, setValue, loaded]. `value` is the default until loaded.
 */
export function useSetting(key, fallback = DEFAULT_SETTINGS[key]) {
  const row = useLiveQuery(() => db.settings.get(key), [key], undefined)
  const loaded = row !== undefined
  const value = row === undefined || row === null ? fallback : row.value
  const set = useCallback((v) => setSetting(key, typeof v === 'function' ? v(value) : v), [key, value])
  return [value, set, loaded]
}
