import { createId } from '../domain/ids.ts'
import type { JournalSnapshot } from '../domain/types.ts'
import { getSupabase, isSupabaseConfigured } from '../lib/supabase.ts'
import { ANONYMOUS_DATABASE } from '../storage/db.ts'
import { loadSyncCursor, loadSyncOps, readNamedJournal, saveSyncCursor, saveSyncOp, saveSyncOps } from '../storage/repository.ts'
import { CLOUD_TABLE, fromCloudRow, toCloudRow } from './cloud-rows.ts'
import { journalBridge } from './journal-bridge.ts'
import {
  acceptRemote,
  applyRemoteRecord,
  decideRemote,
  diffSnapshots,
  duplicateRemote,
  isEmptyJournal,
  markConflict,
  markSynced,
  snapshotAfterRemoteApply,
  type EntityKind,
  type RemoteRecord,
  type SyncOp,
  type SyncStatus,
} from './sync-diff.ts'

export type SyncPhase = 'saved' | 'syncing' | 'offline' | 'error'

export interface SyncState {
  phase: SyncPhase
  lastSync: string | null
  pending: number
  conflicts: SyncOp[]
  migration: JournalSnapshot | null
  message: string
}

const listeners = new Set<() => void>()
let state: SyncState = {
  phase: 'saved',
  lastSync: null,
  pending: 0,
  conflicts: [],
  migration: null,
  message: 'Saved on this device',
}
let tail = Promise.resolve()
let timer = 0
let userId: string | null = null
let started = false

function emit() {
  for (const listener of listeners) listener()
}

function publish(ops: SyncOp[], patch: Partial<SyncState> = {}) {
  const pending = ops.filter((op) => op.syncStatus === 'pending' || op.syncStatus === 'error').length
  const conflicts = ops.filter((op) => op.syncStatus === 'conflict')
  const offline = typeof navigator !== 'undefined' && !navigator.onLine
  state = {
    ...state,
    pending,
    conflicts,
    phase: conflicts.length ? 'error' : offline ? 'offline' : pending ? state.phase : 'saved',
    message: conflicts.length
      ? 'This page was also edited on another device'
      : offline
        ? 'Offline — saved locally'
        : pending
          ? 'Saved on this device'
          : 'Saved',
    ...patch,
  }
  emit()
}

function exclusive<T>(task: () => Promise<T>): Promise<T> {
  const run = tail.then(task, task)
  tail = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

export const syncService = {
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  getSnapshot() {
    return state
  },
  async noteChange(previous: JournalSnapshot) {
    if (!userId) return
    await exclusive(async () => {
      const queue = await loadSyncOps()
      const ops = diffSnapshots(previous, journalBridge.getSnapshot(), queue, new Date().toISOString())
      await saveSyncOps(ops)
      publish(ops)
    })
    void this.syncNow()
  },
  async start(nextUserId: string) {
    userId = nextUserId
    if (!started && typeof window !== 'undefined') {
      started = true
      window.addEventListener('online', onOnline)
      window.addEventListener('offline', onOffline)
      timer = window.setInterval(() => void syncService.syncNow(), 60_000)
    }
    await this.syncNow()
    await this.lookForLocalJournal()
  },
  async stop() {
    const current = userId
    userId = null
    if (current && typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        await this.pushPending(current)
      } catch {
        publish(await safeOps(), { phase: 'error', message: 'Saved locally. Cloud sync will retry.' })
      }
    }
    if (started && typeof window !== 'undefined') {
      started = false
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      window.clearInterval(timer)
    }
    state = { ...state, migration: null }
    emit()
  },
  async syncNow() {
    const current = userId
    if (!current || !isSupabaseConfigured()) return
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      publish(await safeOps(), { phase: 'offline', message: 'Offline — saved locally' })
      return
    }
    await exclusive(async () => {
      publish(await safeOps(), { phase: 'syncing', message: 'Syncing' })
      try {
        await pull(current)
        await push(current)
        const syncedAt = new Date().toISOString()
        const cursor = await loadSyncCursor()
        await saveSyncCursor({ lastPullAt: syncedAt, lastSuccessAt: syncedAt || cursor.lastSuccessAt })
        publish(await loadSyncOps(), { phase: 'saved', lastSync: syncedAt, message: 'Saved' })
      } catch {
        publish(await safeOps(), { phase: 'error', message: 'Saved locally. Cloud sync will retry.' })
      }
    })
  },
  async pushPending(current = userId) {
    if (!current) return
    await exclusive(async () => {
      await push(current)
    })
  },
  async resolve(key: string, choice: 'local' | 'remote' | 'both') {
    const current = userId
    if (!current) return
    await exclusive(async () => {
      const ops = await loadSyncOps()
      const op = ops.find((item) => item.key === key)
      if (!op || op.syncStatus !== 'conflict') return
      const now = new Date().toISOString()
      if (choice === 'remote' && op.remoteUpdatedAt) {
        const remote = {
          kind: op.kind,
          id: op.id,
          updatedAt: op.remoteUpdatedAt,
          deletedAt: op.remoteDeletedAt,
          payload: op.remotePayload,
        }
        journalBridge.replaceQuiet(applyRemoteRecord(journalBridge.getSnapshot(), remote))
        await saveSyncOp(acceptRemote(op, remote, now))
      } else if (choice === 'both' && op.remotePayload) {
        const copyId = createId()
        journalBridge.replaceQuiet(
          duplicateRemote(
            journalBridge.getSnapshot(),
            { kind: op.kind, id: op.id, updatedAt: op.remoteUpdatedAt ?? now, deletedAt: null, payload: op.remotePayload },
            copyId,
          ),
        )
        const local = { ...op, syncStatus: 'pending' as SyncStatus, remotePayload: null, remoteUpdatedAt: null, remoteDeletedAt: null }
        await saveSyncOp(local)
        await saveSyncOp({
          ...local,
          key: `${op.kind}:${copyId}`,
          id: copyId,
          payload: { ...(op.remotePayload as Record<string, unknown>), id: copyId },
          updatedAt: now,
          deletedAt: null,
          syncStatus: 'pending',
          baseUpdatedAt: null,
          cloudUpdatedAt: null,
          lastSyncedAt: null,
        })
      } else {
        await saveSyncOp({ ...op, syncStatus: 'pending', remotePayload: null, remoteUpdatedAt: null, remoteDeletedAt: null })
      }
      publish(await loadSyncOps())
    })
    await this.syncNow()
  },
  async lookForLocalJournal() {
    const current = userId
    if (!current) return
    const dismissed = localStorage.getItem(dismissKey(current)) === '1'
    if (dismissed) return
    const local = journalBridge.getSnapshot()
    if (!isEmptyJournal(local)) return
    const anonymous = await readNamedJournal(ANONYMOUS_DATABASE)
    if (!anonymous || isEmptyJournal(anonymous)) return
    state = { ...state, migration: anonymous }
    emit()
  },
  dismissMigration() {
    if (userId) localStorage.setItem(dismissKey(userId), '1')
    state = { ...state, migration: null }
    emit()
  },
}

function dismissKey(id: string) {
  return `bj-migration-dismissed:${id}`
}

async function safeOps(): Promise<SyncOp[]> {
  try {
    return await loadSyncOps()
  } catch {
    return []
  }
}

async function pull(currentUserId: string) {
  const cursor = await loadSyncCursor()
  const since = cursor.lastPullAt
  const accepted: RemoteRecord[] = []
  let ops = await loadSyncOps()
  const kinds = Object.keys(CLOUD_TABLE) as EntityKind[]
  for (const kind of kinds) {
    let query = getSupabase().from(CLOUD_TABLE[kind]).select('*').eq('user_id', currentUserId)
    if (since) query = query.gt('updated_at', since)
    const { data, error } = await query
    if (error) throw new Error(error.message)
    for (const row of data ?? []) {
      const remote = fromCloudRow(kind, row as Record<string, unknown>)
      const op = ops.find((item) => item.key === `${kind}:${remote.id}`)
      const decision = decideRemote(op, remote)
      if (decision === 'apply') {
        accepted.push(remote)
        const synced = acceptRemote(
          op ?? {
            key: `${kind}:${remote.id}`,
            kind,
            id: remote.id,
            updatedAt: remote.updatedAt,
            deletedAt: remote.deletedAt,
            payload: remote.payload,
            syncStatus: 'synced',
            lastSyncedAt: null,
            cloudUpdatedAt: null,
            baseUpdatedAt: null,
            remotePayload: null,
            remoteUpdatedAt: null,
            remoteDeletedAt: null,
          },
          remote,
          remote.updatedAt,
        )
        ops = ops.filter((item) => item.key !== synced.key).concat(synced)
      } else if (decision === 'conflict' && op) {
        ops = ops.map((item) => (item.key === op.key ? markConflict(item, remote) : item))
      } else if (decision === 'ignore' && op) {
        ops = ops.map((item) => (item.key === op.key ? { ...item, syncStatus: 'synced', cloudUpdatedAt: remote.updatedAt } : item))
      }
    }
  }
  journalBridge.replaceQuiet(snapshotAfterRemoteApply(journalBridge.getSnapshot(), accepted))
  await saveSyncOps(ops)
}

async function push(currentUserId: string) {
  const ops = await loadSyncOps()
  const now = new Date().toISOString()
  for (const op of ops) {
    if (op.syncStatus !== 'pending' && op.syncStatus !== 'error') continue
    const { error } = await getSupabase().from(CLOUD_TABLE[op.kind]).upsert(toCloudRow(currentUserId, op), { onConflict: 'user_id,id' })
    if (error) {
      await saveSyncOp({ ...op, syncStatus: 'error' })
      throw new Error(error.message)
    }
    await saveSyncOp(markSynced(op, now))
  }
}

function onOnline() {
  void syncService.syncNow()
}

function onOffline() {
  void loadSyncOps().then((ops) => publish(ops, { phase: 'offline', message: 'Offline — saved locally' }))
}

export function useSyncExternal() {
  return state
}
