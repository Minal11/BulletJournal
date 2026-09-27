import { useState } from 'react'
import { canDuplicate, recordLabel } from '../services/sync-diff.ts'
import { syncService } from '../services/syncService.ts'
import { useSync } from '../state/use-sync.ts'
import { PaperDialog } from './ui.tsx'

export function SyncChip() {
  const sync = useSync()
  const [open, setOpen] = useState(false)
  const label =
    sync.phase === 'syncing' ? '↻ Syncing' : sync.phase === 'offline' ? 'Offline — saved locally' : sync.phase === 'error' ? '! Sync issue' : '✓ Saved'

  return (
    <>
      <button type="button" className="sync-chip" onClick={() => setOpen(true)}>
        {label}
      </button>
      <PaperDialog open={open} title="This journal" confirmLabel="" dismissLabel="Close" onClose={() => setOpen(false)} onConfirm={() => setOpen(false)}>
        <p>{sync.message}</p>
        <p className="whisper">Last cloud sync: {sync.lastSync ? new Date(sync.lastSync).toLocaleString() : 'Not yet'}</p>
        <p className="whisper">Pending changes: {sync.pending}</p>
        <button type="button" className="quiet-btn" onClick={() => void syncService.syncNow()}>
          Sync now
        </button>
        {sync.conflicts.map((conflict) => (
          <div key={conflict.key} className="conflict-card">
            <p>This was edited on another device.</p>
            <p>{recordLabel(conflict)}</p>
            <div className="choice-row">
              <button type="button" className="quiet-btn" onClick={() => void syncService.resolve(conflict.key, 'local')}>
                Keep this version
              </button>
              <button type="button" className="quiet-btn" onClick={() => void syncService.resolve(conflict.key, 'remote')}>
                Keep the other version
              </button>
              {canDuplicate(conflict.kind) && (
                <button type="button" className="quiet-btn" onClick={() => void syncService.resolve(conflict.key, 'both')}>
                  Keep both
                </button>
              )}
            </div>
          </div>
        ))}
      </PaperDialog>
    </>
  )
}
