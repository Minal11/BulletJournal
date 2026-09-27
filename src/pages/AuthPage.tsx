import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../state/auth.tsx'

type Mode = 'sign-in' | 'create' | 'forgot'

export function AuthPage() {
  const auth = useAuth()
  const [mode, setMode] = useState<Mode>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  if (!auth.configured) {
    return (
      <main className="auth-desk">
        <section className="auth-sheet">
          <p className="kicker">My Bullet Journal</p>
          <h1>The journal needs a key</h1>
          <p>{auth.configError}</p>
        </section>
      </main>
    )
  }
  if (auth.user) return <Navigate to="/" replace />

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    const error =
      mode === 'forgot' ? await auth.resetPassword(email) : mode === 'create' ? await auth.signUp(email, password) : await auth.signIn(email, password)
    setBusy(false)
    if (mode === 'forgot' && !error) setMessage('Check your email for a link back to the journal.')
    else if (error) setMessage(error)
  }

  return (
    <main className="auth-desk">
      <section className="auth-sheet">
        <p className="kicker">My Bullet Journal</p>
        <h1>{mode === 'create' ? 'A fresh notebook' : mode === 'forgot' ? 'Find your way back' : 'Open your journal'}</h1>
        <p className="whisper">Your thoughts. Your plans. Your life, in pages.</p>
        <form className="auth-form" onSubmit={(event) => void submit(event)}>
          <label>
            Email
            <input className="ink-input auth-field" type="email" autoComplete="email" value={email} required onChange={(event) => setEmail(event.target.value)} />
          </label>
          {mode !== 'forgot' && (
            <label>
              Password
              <input
                className="ink-input auth-field"
                type="password"
                autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
                minLength={6}
                value={password}
                required
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
          )}
          <button className="ink-button" type="submit" disabled={busy}>
            {busy ? 'One moment' : mode === 'create' ? 'Create a journal' : mode === 'forgot' ? 'Send a link' : 'Sign in'}
          </button>
        </form>
        {message && <p className="whisper">{message}</p>}
        <div className="auth-links">
          {mode !== 'sign-in' && (
            <button type="button" className="quiet-btn" onClick={() => setMode('sign-in')}>
              Sign in
            </button>
          )}
          {mode !== 'create' && (
            <button type="button" className="quiet-btn" onClick={() => setMode('create')}>
              Create a journal
            </button>
          )}
          {mode !== 'forgot' && (
            <button type="button" className="quiet-btn" onClick={() => setMode('forgot')}>
              Forgot password?
            </button>
          )}
        </div>
      </section>
    </main>
  )
}
