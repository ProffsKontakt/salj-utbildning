// Same interface as cloudSupabase.js, backed by the in-process fake server
// (scripts/fakeCloudPlugin.js) that the e2e dev server exposes under /__cloud.
// Any email + password signs in; the user id is derived from the email so two
// browser contexts share one account (multi-device tests).
import { REMOTE_TABLE } from './mapping.js'

const SESSION_KEY = 'notstall-fake-auth'
const listeners = new Set()

function currentUser() {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function setUser(user) {
  if (user) localStorage.setItem(SESSION_KEY, JSON.stringify(user))
  else localStorage.removeItem(SESSION_KEY)
  for (const cb of listeners) cb(user)
}

async function api(path, { method = 'GET', body, raw = false, headers = {} } = {}) {
  const user = currentUser()
  const res = await fetch(`/__cloud${path}`, {
    method,
    headers: { ...(user ? { 'x-user': user.id } : {}), ...(body && !(body instanceof ArrayBuffer) ? { 'content-type': 'application/json' } : {}), ...headers },
    body: body instanceof ArrayBuffer ? body : body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`Fake cloud ${method} ${path} → ${res.status}`)
  return raw ? res.arrayBuffer() : res.json()
}

export function createFakeCloud() {
  return {
    kind: 'fake',
    async getUser() {
      return currentUser()
    },
    onAuthChange(cb) {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    async signInWithGoogle() {
      throw new Error('Google-inloggning är inte tillgänglig i testläget.')
    },
    async signInWithApple() {
      throw new Error('Apple-inloggning är inte tillgänglig i testläget.')
    },
    async signInWithEmail(email, password) {
      const { user } = await api('/auth/signin', { method: 'POST', body: { email, password } })
      setUser(user)
      return user
    },
    async signUpWithEmail(email, password) {
      const { user } = await api('/auth/signin', { method: 'POST', body: { email, password } })
      setUser(user)
      return { user, needsConfirmation: false }
    },
    async resetPassword() {},
    async updatePassword() {},
    async signOut() {
      setUser(null)
    },
    async pull(table, { since, offset = 0, limit = 500 }) {
      return api(`/pull?table=${REMOTE_TABLE[table]}&since=${encodeURIComponent(since)}&offset=${offset}&limit=${limit}`)
    },
    async upsert(table, rows) {
      if (!rows.length) return []
      return api('/upsert', { method: 'POST', body: { table: REMOTE_TABLE[table], rows } })
    },
    async markDeleted(table, entries) {
      if (!entries.length) return
      await api('/delete', { method: 'POST', body: { table: REMOTE_TABLE[table], entries } })
    },
    async uploadFile(path, bytes, contentType) {
      await api(`/files/${path}`, { method: 'PUT', body: bytes, headers: { 'content-type': contentType } })
    },
    async downloadFile(path) {
      return api(`/files/${path}`, { raw: true })
    },
    async removeFiles(paths) {
      for (const p of paths) await api(`/files/${p}`, { method: 'DELETE' })
    },
  }
}
