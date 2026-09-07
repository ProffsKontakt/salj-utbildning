import { createContext, useContext } from 'react'

export const SyncContext = createContext(null)

/**
 * Cloud account + sync state. Returns:
 *   user {id,email,provider,name}|null, authLoading, cloudReady, online,
 *   status {phase:'idle'|'syncing'|'error'|'offline', pending, lastSyncAt, error, progress, downloading:string[]},
 *   localOnly {scores,projects}|null,
 *   isDownloading(id), downloadScore(id), removeDownload(id), downloadProject(projectId),
 *   downloadAll(), removeAllDownloads(), syncNow(), countUnsynced(),
 *   signInWithGoogle(), signInWithApple(), signInWithEmail(e,p), signUpWithEmail(e,p),
 *   resetPassword(e), updatePassword(p), signOut({clearDevice}), adoptLocal(), keepLocal()
 */
export function useSync() {
  const ctx = useContext(SyncContext)
  if (!ctx) throw new Error('useSync must be used inside <SyncProvider>')
  return ctx
}
