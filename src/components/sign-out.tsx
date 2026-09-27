import { useState } from 'react'
import { shouldConfirmSignOut } from '../lib/sign-out.ts'
import { syncService } from '../services/syncService.ts'
import { useAuth } from '../state/auth.tsx'
import { journal } from '../state/store.ts'
import { PaperDialog } from './ui.tsx'

export function SignOutButton() {
  const auth = useAuth()
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)

  async function requestSignOut() {
    if (busy) return
    setBusy(true)
    await journal.flush()
    await syncService.syncNow()
    const latest = syncService.getSnapshot()
    const online = typeof navigator === 'undefined' ? true : navigator.onLine
    const failed = latest.phase === 'error' || latest.phase === 'offline'
    if (shouldConfirmSignOut(online, latest.pending, failed)) {
      setBusy(false)
      setConfirm(true)
      return
    }
    await auth.signOut()
    setBusy(false)
  }

  return (
    <>
      <button type="button" className="quiet-btn" onClick={() => void requestSignOut()} disabled={busy}>
        Sign out
      </button>
      <PaperDialog
        open={confirm}
        title="Still on this page"
        confirmLabel="Sign out anyway"
        dismissLabel="Stay signed in"
        confirmDanger={false}
        onClose={() => setConfirm(false)}
        onConfirm={() => {
          setConfirm(false)
          void auth.signOut()
        }}
      >
        <p>Some changes are saved locally but have not synced to the cloud yet.</p>
      </PaperDialog>
    </>
  )
}
