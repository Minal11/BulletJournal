import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../state/auth.tsx'

export function ResetPasswordPage() {
  const auth = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  if (auth.loading) {
    return (
      <main className="auth-desk">
        <p className="auth-waiting">Opening your journal…</p>
      </main>
    )
  }
  if (!auth.configured) return <Navigate to="/sign-in" replace />
  if (!auth.user) {
    return (
      <main className="auth-desk">
        <section className="auth-sheet">
          <p className="kicker">My Bullet Journal</p>
          <h1>That link has expired</h1>
          <p>Ask for a new password link from the sign-in page.</p>
        </section>
      </main>
    )
  }

  return (
    <main className="auth-desk">
      <section className="auth-sheet">
        <p className="kicker">My Bullet Journal</p>
        <h1>Choose a new password</h1>
        <form
          className="auth-form"
          onSubmit={(event) => {
            event.preventDefault()
            setBusy(true)
            void auth.updatePassword(password).then((error) => {
              setBusy(false)
              if (error) setMessage(error)
              else navigate('/')
            })
          }}
        >
          <label>
            New password
            <input className="ink-input auth-field" type="password" autoComplete="new-password" minLength={6} required value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          <button className="ink-button" type="submit" disabled={busy}>
            {busy ? 'Saving' : 'Save password'}
          </button>
        </form>
        {message && <p className="whisper">{message}</p>}
      </section>
    </main>
  )
}
