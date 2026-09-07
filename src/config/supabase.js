// Supabase project for Notställ accounts and the cloud library.
// The publishable key is safe to ship in the client; row level security
// restricts every table and storage object to its owner.
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://jzwimqddhjzpmnuyoyhv.supabase.co'
export const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || 'sb_publishable_90nX2yNAKgGM-REzDcP8Tg_ikcI4e69'
export const STORAGE_BUCKET = 'scores'
/** Set VITE_FAKE_CLOUD=1 (e2e) to replace Supabase with the in-process fake. */
export const USE_FAKE_CLOUD = import.meta.env.VITE_FAKE_CLOUD === '1'
