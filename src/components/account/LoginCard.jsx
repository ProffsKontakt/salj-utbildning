import { useState } from 'react'
import { Mail, LogIn, UserPlus, KeyRound } from 'lucide-react'
import { Button, TextField, useToast, cn } from '../ui/index.js'
import { useSync } from '../../lib/sync/useSync.js'

function GoogleMark({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={cn('size-5', className)} aria-hidden="true">
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.8-5.5 3.8-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.9 1.5l2.6-2.6C16.8 3.1 14.6 2 12 2 6.5 2 2 6.5 2 12s4.5 10 10 10c5.8 0 9.6-4.1 9.6-9.8 0-.7-.1-1.2-.2-1.7H12z" />
    </svg>
  )
}

/**
 * Sign-in / sign-up / password reset. Google is the primary path; e-mail +
 * password is the fallback that works before any OAuth provider is configured.
 */
export function LoginCard({ compact = false }) {
  const sync = useSync()
  const toast = useToast()
  const [mode, setMode] = useState('login') // 'login' | 'signup' | 'reset'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)

  const google = async () => {
    setError(null)
    setBusy(true)
    try {
      await sync.signInWithGoogle()
      // The browser navigates to Google; nothing more to do here.
    } catch (err) {
      setError(err?.message || 'Inloggningen misslyckades.')
      setBusy(false)
    }
  }

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    setNotice(null)
    const em = email.trim()
    if (!em) return setError('Ange din e-postadress.')
    if (mode !== 'reset' && password.length < 6) return setError('Lösenordet måste vara minst 6 tecken.')
    setBusy(true)
    try {
      if (mode === 'login') {
        await sync.signInWithEmail(em, password)
        toast.success('Inloggad')
      } else if (mode === 'signup') {
        const { needsConfirmation } = await sync.signUpWithEmail(em, password)
        if (needsConfirmation) setNotice('Vi har skickat ett bekräftelsemejl. Klicka på länken i det och logga sedan in.')
        else toast.success('Kontot är skapat')
      } else {
        await sync.resetPassword(em)
        setNotice('Om adressen finns har vi skickat en länk för att byta lösenord.')
      }
    } catch (err) {
      setError(err?.message || 'Något gick fel.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={cn('rounded-3xl bg-ink-850 p-5 shadow-stage sm:p-6', compact && 'p-4')} data-testid="login-card">
      <h2 className="font-display text-3xl text-ivory-50">Logga in</h2>
      <p className="mt-1 text-[15px] text-ivory-400">Med ett konto finns dina noter, anteckningar och projekt på alla dina enheter. Ladda ner det du vill ha offline.</p>

      <Button variant="secondary" size="lg" className="mt-5 w-full gap-3" onClick={google} disabled={busy || !sync.cloudReady} data-testid="login-google">
        <GoogleMark />
        Fortsätt med Google
      </Button>

      <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-[0.18em] text-ivory-500">
        <span className="h-px flex-1 bg-ivory-50/10" />
        eller med e-post
        <span className="h-px flex-1 bg-ivory-50/10" />
      </div>

      <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
        <TextField label="E-post" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} data-testid="login-email" required />
        {mode !== 'reset' ? (
          <TextField
            label="Lösenord"
            type="password"
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            data-testid="login-password"
            hint={mode === 'signup' ? 'Minst 6 tecken.' : undefined}
            required
          />
        ) : null}
        {error ? (
          <p className="text-sm text-[#f08a86]" role="alert" data-testid="login-error">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p className="rounded-xl bg-gold-500/10 px-3 py-2 text-sm text-gold-200" role="status" data-testid="login-notice">
            {notice}
          </p>
        ) : null}
        <Button type="submit" size="lg" loading={busy} disabled={!sync.cloudReady} data-testid="login-submit" className="mt-1 w-full">
          {mode === 'login' ? <LogIn className="size-4" /> : mode === 'signup' ? <UserPlus className="size-4" /> : <Mail className="size-4" />}
          {mode === 'login' ? 'Logga in' : mode === 'signup' ? 'Skapa konto' : 'Skicka återställningslänk'}
        </Button>
      </form>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-ivory-400">
        {mode === 'login' ? (
          <>
            <button type="button" className="text-gold-300 hover:underline" onClick={() => setMode('signup')} data-testid="login-mode-signup">
              Skapa konto
            </button>
            <button type="button" className="inline-flex items-center gap-1 hover:text-ivory-100" onClick={() => setMode('reset')} data-testid="login-mode-reset">
              <KeyRound className="size-3.5" /> Glömt lösenordet?
            </button>
          </>
        ) : (
          <button type="button" className="text-gold-300 hover:underline" onClick={() => setMode('login')} data-testid="login-mode-login">
            Har du redan ett konto? Logga in
          </button>
        )}
      </div>
      {!sync.cloudReady ? <p className="mt-3 text-xs text-ivory-500">Ansluter till molntjänsten…</p> : null}
    </div>
  )
}
