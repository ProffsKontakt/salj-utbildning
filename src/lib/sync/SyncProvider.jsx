// React context around the cloud client + sync engine.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { USE_FAKE_CLOUD } from '../../config/supabase.js'
import { db, dbEvents, adoptLocalLibrary, clearForeignUserData, clearUserData, countLocalOnly, countUnsynced, getProjectLinks } from '../../db/db.js'
import { createSyncEngine } from './engine.js'
import { SyncContext } from './useSync.js'

async function loadCloud() {
  if (USE_FAKE_CLOUD) {
    const m = await import('./cloudFake.js')
    return m.createFakeCloud()
  }
  const m = await import('./cloudSupabase.js')
  return m.createSupabaseCloud()
}

export function SyncProvider({ children }) {
  const [cloud, setCloud] = useState(null)
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [status, setStatus] = useState({ phase: 'idle', lastSyncAt: 0, error: null, pending: 0, progress: null, downloading: [] })
  const [localOnly, setLocalOnly] = useState(null) // { scores, projects } when a signed-in user has device-only rows
  const keptLocalRef = useRef(0) // device-only rows the user chose to keep local; re-ask only when more appear
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine !== false)
  const engineRef = useRef(null)

  // Boot: load the cloud client, restore the session, subscribe to auth changes.
  useEffect(() => {
    let disposed = false
    let unsubscribe = null
    ;(async () => {
      try {
        const c = await loadCloud()
        if (disposed) return
        const engine = createSyncEngine({ cloud: c, onStatus: (s) => !disposed && setStatus(s) })
        engineRef.current = engine
        engine.start()
        setCloud(c)
        const u = await c.getUser()
        if (disposed) return
        setUser(u)
        engine.setUser(u)
        unsubscribe = c.onAuthChange((next) => {
          if (disposed) return
          setUser((prev) => {
            if (prev?.id === next?.id) return prev
            engine.setUser(next)
            return next
          })
        })
      } catch (err) {
        console.warn('Cloud unavailable', err)
      } finally {
        if (!disposed) setAuthLoading(false)
      }
    })()
    const onOnline = () => setOnline(true)
    const onOffline = () => setOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      disposed = true
      unsubscribe?.()
      engineRef.current?.stop()
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  // After sign-in: drop another account's cache and ask about device-only rows.
  // Re-check after local writes (e.g. a backup import while signed in), but do not
  // nag: once the user chose "keep local", ask again only when more rows appear.
  useEffect(() => {
    if (!user) return
    let active = true
    let timer = null
    const check = async () => {
      const counts = await countLocalOnly()
      const total = counts.scores + counts.projects
      if (active && total > 0 && total > keptLocalRef.current) setLocalOnly(counts)
    }
    ;(async () => {
      await clearForeignUserData(user.id)
      await check()
    })()
    const onDirty = () => {
      clearTimeout(timer)
      timer = setTimeout(check, 2000)
    }
    dbEvents.addEventListener('dirty', onDirty)
    return () => {
      active = false
      clearTimeout(timer)
      dbEvents.removeEventListener('dirty', onDirty)
    }
  }, [user])

  const requireCloud = useCallback(() => {
    if (!cloud) throw new Error('Molntjänsten är inte tillgänglig just nu.')
    return cloud
  }, [cloud])

  const api = useMemo(
    () => ({
      user,
      authLoading,
      cloudReady: !!cloud,
      online,
      status,
      localOnly,
      isDownloading: (id) => status.downloading.includes(id),

      signInWithGoogle: () => requireCloud().signInWithGoogle(),
      signInWithApple: () => requireCloud().signInWithApple(),
      signInWithEmail: (email, password) => requireCloud().signInWithEmail(email, password),
      signUpWithEmail: (email, password) => requireCloud().signUpWithEmail(email, password),
      resetPassword: (email) => requireCloud().resetPassword(email),
      updatePassword: (password) => requireCloud().updatePassword(password),

      /** Pending local changes (dirty rows + tombstones) for the signed-in user. */
      countUnsynced: () => (user ? countUnsynced(user.id) : Promise.resolve(0)),

      /** Sign out; with clearDevice the account's cached library is removed from this device. */
      signOut: async ({ clearDevice = true } = {}) => {
        const c = requireCloud()
        const uid = user?.id
        await c.signOut()
        engineRef.current?.setUser(null)
        setUser(null)
        setLocalOnly(null)
        if (clearDevice && uid) await clearUserData(uid)
      },

      syncNow: () => engineRef.current?.sync('manual'),
      downloadScore: (id) => engineRef.current?.downloadScore(id),
      removeDownload: (id) => engineRef.current?.removeDownload(id),
      downloadProject: async (projectId) => {
        const links = await getProjectLinks(projectId)
        let n = 0
        for (const l of links) {
          if (await db.files.get(l.scoreId)) continue
          await engineRef.current?.downloadScore(l.scoreId)
          n++
        }
        return n
      },
      downloadAll: async () => {
        if (!user) return 0
        const ids = await db.scores.where('ownerId').equals(user.id).primaryKeys()
        const have = new Set(await db.files.toCollection().primaryKeys())
        let n = 0
        for (const id of ids) {
          if (have.has(id)) continue
          await engineRef.current?.downloadScore(id)
          n++
        }
        return n
      },
      removeAllDownloads: async () => {
        if (!user) return 0
        const ids = await db.files.toCollection().primaryKeys()
        let n = 0
        for (const id of ids) {
          try {
            await engineRef.current?.removeDownload(id)
            n++
          } catch {
            /* keep files with unsynced changes */
          }
        }
        return n
      },

      adoptLocal: async () => {
        if (!user) return 0
        const n = await adoptLocalLibrary(user.id)
        keptLocalRef.current = 0
        setLocalOnly(null)
        engineRef.current?.schedule(0)
        return n
      },
      keepLocal: () => {
        setLocalOnly((counts) => {
          keptLocalRef.current = counts ? counts.scores + counts.projects : 0
          return null
        })
      },
    }),
    [user, authLoading, cloud, online, status, localOnly, requireCloud],
  )

  // Dev/e2e hook: lets tests trigger and observe sync without UI.
  useEffect(() => {
    if (import.meta.env.DEV) window.__notstallSync = api
  }, [api])

  return <SyncContext.Provider value={api}>{children}</SyncContext.Provider>
}
