import { describe, expect, it } from 'vitest'
import { makeEntry } from '../domain/entries.ts'
import { emptySnapshot } from '../domain/schema.ts'
import type { JournalSnapshot } from '../domain/types.ts'
import {
  acceptRemote,
  applyRemoteRecord,
  canDuplicate,
  databaseName,
  decideRemote,
  diffSnapshots,
  duplicateRemote,
  isEmptyJournal,
  journalSummary,
  markConflict,
  shouldAttemptSync,
  syncKey,
} from './sync-diff.ts'
import { fromCloudRow, toCloudRow } from './cloud-rows.ts'

const NOW = '2026-09-26T12:00:00.000Z'
const LATER = '2026-09-26T13:00:00.000Z'

function withEntry(snapshot: JournalSnapshot, content: string, id: string, updatedAt = NOW): JournalSnapshot {
  const entry = { ...makeEntry({ id, date: '2026-09-26', content, type: 'task', now: new Date(updatedAt) }), updatedAt }
  return { ...snapshot, entries: [...snapshot.entries.filter((item) => item.id !== id), entry] }
}

describe('account isolation', () => {
  it('gives every account its own local database', () => {
    expect(databaseName('user-a')).not.toBe(databaseName('user-b'))
    expect(databaseName(null)).toBe('MyBulletJournal')
    expect(databaseName('user-a')).toBe('MyBulletJournal-user-a')
  })
})

describe('sync queue', () => {
  it('keeps a local write pending while offline', () => {
    const previous = emptySnapshot()
    const next = withEntry(previous, 'Write this down', 'entry-1')
    const queue = diffSnapshots(previous, next, [], NOW)
    expect(shouldAttemptSync(false)).toBe(false)
    expect(queue).toHaveLength(1)
    const entry = queue.find((op) => op.kind === 'entry')
    expect(entry?.syncStatus).toBe('pending')
    expect(entry?.payload).toMatchObject({ content: 'Write this down' })
  })

  it('does not duplicate a record when the same journal is imported twice', () => {
    const previous = emptySnapshot()
    const next = withEntry(previous, 'One line', 'entry-1')
    const first = diffSnapshots(previous, next, [], NOW)
    const second = diffSnapshots(next, next, first, LATER)
    const entries = second.filter((op) => op.kind === 'entry')
    expect(entries).toHaveLength(1)
    expect(entries[0]?.id).toBe('entry-1')
    expect(entries[0]?.updatedAt).toBe(NOW)
  })

  it('records a deletion as a tombstone', () => {
    const previous = withEntry(emptySnapshot(), 'Let this go', 'entry-1')
    const next = emptySnapshot()
    const queue = diffSnapshots(previous, next, [], LATER)
    const entry = queue.find((op) => op.id === 'entry-1')
    expect(entry?.deletedAt).toBe(LATER)
    expect(entry?.syncStatus).toBe('pending')
    const applied = applyRemoteRecord(previous, {
      kind: 'entry',
      id: 'entry-1',
      updatedAt: LATER,
      deletedAt: LATER,
      payload: entry?.payload,
    })
    expect(applied.entries).toHaveLength(0)
  })

  it('pushes and pulls a row without changing the journal payload', () => {
    const snapshot = withEntry(emptySnapshot(), 'Morning note', 'entry-1')
    const op = diffSnapshots(emptySnapshot(), snapshot, [], NOW).find((item) => item.kind === 'entry')
    expect(op).toBeTruthy()
    const row = toCloudRow('user-1', op!)
    expect(row.user_id).toBe('user-1')
    expect(row.content).toBe('Morning note')
    const remote = fromCloudRow('entry', row)
    const pulled = applyRemoteRecord(emptySnapshot(), remote)
    expect(pulled.entries[0]?.content).toBe('Morning note')
    expect(pulled.entries[0]?.id).toBe('entry-1')
  })
})

describe('conflicts', () => {
  it('detects when both devices changed an entry after the last sync', () => {
    const local = withEntry(emptySnapshot(), 'Laptop version', 'entry-1', LATER)
    const op = diffSnapshots(emptySnapshot(), local, [], LATER).find((item) => item.id === 'entry-1')
    const pending = { ...op!, cloudUpdatedAt: NOW, baseUpdatedAt: NOW }
    const remote = {
      kind: 'entry' as const,
      id: 'entry-1',
      updatedAt: '2026-09-26T14:00:00.000Z',
      deletedAt: null,
      payload: withEntry(emptySnapshot(), 'Phone version', 'entry-1', '2026-09-26T14:00:00.000Z').entries[0],
    }
    expect(decideRemote(pending, remote)).toBe('conflict')
    const conflict = markConflict(pending, remote)
    expect(conflict.syncStatus).toBe('conflict')
    expect(conflict.remotePayload).toMatchObject({ content: 'Phone version' })
  })

  it('keeps both versions as separate records', () => {
    const local = withEntry(emptySnapshot(), 'Laptop version', 'entry-1')
    const remotePayload = withEntry(emptySnapshot(), 'Phone version', 'entry-1').entries[0]
    const both = duplicateRemote(
      local,
      { kind: 'entry', id: 'entry-1', updatedAt: LATER, deletedAt: null, payload: remotePayload },
      'entry-copy',
    )
    expect(both.entries.map((entry) => entry.content).sort()).toEqual(['Laptop version', 'Phone version'])
    expect(both.entries.map((entry) => entry.id).sort()).toEqual(['entry-1', 'entry-copy'])
    expect(canDuplicate('settings')).toBe(false)
  })

  it('accepts the other device when asked', () => {
    const op = diffSnapshots(emptySnapshot(), withEntry(emptySnapshot(), 'Laptop version', 'entry-1'), [], NOW)[0]
    expect(op).toBeTruthy()
    const remote = {
      kind: 'entry' as const,
      id: 'entry-1',
      updatedAt: LATER,
      deletedAt: null,
      payload: withEntry(emptySnapshot(), 'Phone version', 'entry-1', LATER).entries[0],
    }
    const accepted = acceptRemote(op!, remote, LATER)
    const snapshot = applyRemoteRecord(emptySnapshot(), { ...remote, payload: accepted.payload })
    expect(snapshot.entries[0]?.content).toBe('Phone version')
    expect(accepted.syncStatus).toBe('synced')
  })
})

describe('migration', () => {
  it('notices an existing local journal and an empty account', () => {
    const local = withEntry(emptySnapshot(), 'Already here', 'entry-1')
    local.goals = [
      {
        id: 'goal-1',
        title: 'Family',
        category: '',
        quarter: 4,
        year: 2026,
        goalText: 'Be present',
        why: '',
        measures: [],
        nextActions: [],
        status: 'active',
        notes: '',
        startDate: null,
        relatedEntryIds: [],
        sortOrder: 0,
        createdAt: NOW,
        updatedAt: NOW,
      },
    ]
    expect(isEmptyJournal(emptySnapshot())).toBe(true)
    expect(isEmptyJournal(local)).toBe(false)
    expect(journalSummary(local)).toMatchObject({ entries: 1, goals: 1 })
    expect(syncKey('entry', 'entry-1')).toBe('entry:entry-1')
  })
})
