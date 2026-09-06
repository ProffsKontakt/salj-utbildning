// Cloud API backed by Supabase (auth, Postgres via PostgREST, Storage).
import { getSupabase } from '../cloud/supabaseClient.js'
import { STORAGE_BUCKET } from '../../config/supabase.js'
import { REMOTE_TABLE } from './mapping.js'

const PAGE = 500

function mapUser(u) {
  if (!u) return null
  const provider = u.app_metadata?.provider || 'email'
  return { id: u.id, email: u.email || '', provider, name: u.user_metadata?.full_name || u.user_metadata?.name || '' }
}

function describe(err) {
  const m = err?.message || String(err)
  if (/Invalid login credentials/i.test(m)) return 'Fel e-post eller lösenord.'
  if (/Email not confirmed/i.test(m)) return 'E-postadressen är inte bekräftad ännu. Kolla din inkorg.'
  if (/User already registered/i.test(m)) return 'Det finns redan ett konto med den e-postadressen. Logga in i stället.'
  if (/Password should be at least/i.test(m)) return 'Lösenordet måste vara minst 6 tecken.'
  if (/rate limit|too many/i.test(m)) return 'För många försök. Vänta en stund och försök igen.'
  if (/provider is not enabled|Unsupported provider/i.test(m)) return 'Inloggningssättet är inte aktiverat ännu (Supabase → Authentication → Providers).'
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'Ingen kontakt med servern. Kontrollera anslutningen.'
  return m
}

export function createSupabaseCloud() {
  const sb = getSupabase()
  return {
    kind: 'supabase',

    async getUser() {
      const { data } = await sb.auth.getSession()
      return mapUser(data?.session?.user)
    },

    onAuthChange(cb) {
      const { data } = sb.auth.onAuthStateChange((_event, session) => cb(mapUser(session?.user)))
      return () => data?.subscription?.unsubscribe()
    },

    async signInWithGoogle({ redirectTo } = {}) {
      const { error } = await sb.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: redirectTo || `${window.location.origin}/konto`, queryParams: { access_type: 'offline', prompt: 'select_account' } },
      })
      if (error) throw new Error(describe(error))
    },

    async signInWithApple({ redirectTo } = {}) {
      const { error } = await sb.auth.signInWithOAuth({ provider: 'apple', options: { redirectTo: redirectTo || `${window.location.origin}/konto` } })
      if (error) throw new Error(describe(error))
    },

    async signInWithEmail(email, password) {
      const { data, error } = await sb.auth.signInWithPassword({ email, password })
      if (error) throw new Error(describe(error))
      return mapUser(data.user)
    },

    async signUpWithEmail(email, password) {
      const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/konto` } })
      if (error) throw new Error(describe(error))
      // With "Confirm email" enabled the session is null until the link is clicked.
      return { user: mapUser(data.user), needsConfirmation: !data.session }
    },

    async resetPassword(email) {
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/konto?reset=1` })
      if (error) throw new Error(describe(error))
    },

    async updatePassword(password) {
      const { error } = await sb.auth.updateUser({ password })
      if (error) throw new Error(describe(error))
    },

    async signOut() {
      const { error } = await sb.auth.signOut()
      if (error) throw new Error(describe(error))
    },

    /** Rows changed since `since` (ISO), oldest first. */
    async pull(table, { since, offset = 0, limit = PAGE }) {
      const { data, error } = await sb
        .from(REMOTE_TABLE[table])
        .select('*')
        .gte('synced_at', since)
        .order('synced_at', { ascending: true })
        .order(table === 'annotations' ? 'page_index' : 'id', { ascending: true })
        .range(offset, offset + limit - 1)
      if (error) throw new Error(describe(error))
      return data || []
    },

    async upsert(table, rows) {
      if (!rows.length) return []
      const onConflict = table === 'annotations' ? 'score_id,page_index' : 'id'
      const { data, error } = await sb.from(REMOTE_TABLE[table]).upsert(rows, { onConflict }).select('*')
      if (error) throw new Error(describe(error))
      return data || []
    },

    /** Soft delete; a row that never reached the cloud is simply not there (no error). */
    async markDeleted(table, entries) {
      const t = REMOTE_TABLE[table]
      for (const { key, deletedAt } of entries) {
        let q = sb.from(t).update({ deleted_at: deletedAt, updated_at: deletedAt })
        q = table === 'annotations' ? q.match({ score_id: key.scoreId, page_index: key.pageIndex }) : q.eq('id', key)
        const { error } = await q
        if (error) throw new Error(describe(error))
      }
    },

    async uploadFile(path, bytes, contentType) {
      const { error } = await sb.storage.from(STORAGE_BUCKET).upload(path, new Blob([bytes], { type: contentType }), { upsert: true, contentType })
      if (error) throw new Error(describe(error))
    },

    async downloadFile(path) {
      const { data, error } = await sb.storage.from(STORAGE_BUCKET).download(path)
      if (error) throw new Error(describe(error))
      return data.arrayBuffer()
    },

    async removeFiles(paths) {
      if (!paths.length) return
      const { error } = await sb.storage.from(STORAGE_BUCKET).remove(paths)
      if (error) throw new Error(describe(error))
    },
  }
}
