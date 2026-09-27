import { createId } from '../domain/ids.ts'
import type {
  Collection,
  DayPage,
  FutureLogItem,
  Goal,
  IndexOverride,
  JournalEntry,
  JournalSnapshot,
  MonthlyLog,
  MonthlyReflection,
  QuarterlyReview,
} from '../domain/types.ts'

export type EntityKind =
  | 'entry'
  | 'day'
  | 'monthlyLog'
  | 'goal'
  | 'review'
  | 'reflection'
  | 'collection'
  | 'future'
  | 'index'
  | 'settings'

export type SyncStatus = 'synced' | 'pending' | 'conflict' | 'error'

export interface SyncOp {
  key: string
  kind: EntityKind
  id: string
  updatedAt: string
  deletedAt: string | null
  payload: unknown
  syncStatus: SyncStatus
  lastSyncedAt: string | null
  cloudUpdatedAt: string | null
  baseUpdatedAt: string | null
  remotePayload: unknown | null
  remoteUpdatedAt: string | null
  remoteDeletedAt: string | null
}

export interface RemoteRecord {
  kind: EntityKind
  id: string
  updatedAt: string
  deletedAt: string | null
  payload: unknown
}

export type RemoteDecision = 'apply' | 'keep-local' | 'conflict' | 'ignore'

export function syncKey(kind: EntityKind, id: string): string {
  return `${kind}:${id}`
}

export function databaseName(userId: string | null): string {
  return userId ? `MyBulletJournal-${userId}` : 'MyBulletJournal'
}

export function canDuplicate(kind: EntityKind): boolean {
  return kind === 'entry' || kind === 'goal' || kind === 'collection' || kind === 'future' || kind === 'review' || kind === 'reflection'
}

export function journalSummary(snapshot: JournalSnapshot) {
  return {
    entries: snapshot.entries.length,
    goals: snapshot.goals.length,
    collections: snapshot.collections.length,
    reflections: snapshot.reflections.length,
    reviews: snapshot.reviews.length,
    futureItems: snapshot.futureItems.length,
  }
}

export function isEmptyJournal(snapshot: JournalSnapshot): boolean {
  const summary = journalSummary(snapshot)
  return (
    summary.entries + summary.goals + summary.collections + summary.reflections + summary.reviews + summary.futureItems === 0 &&
    snapshot.monthlyLogs.every((log) => log.calendar.length === 0 && log.goalFocus.length === 0) &&
    snapshot.days.every((day) => day.planItems.length === 0)
  )
}

export function shouldAttemptSync(online: boolean): boolean {
  return online
}

export function diffSnapshots(previous: JournalSnapshot, next: JournalSnapshot, queue: SyncOp[], now: string): SyncOp[] {
  const before = indexSnapshot(previous)
  const after = indexSnapshot(next)
  const byKey = new Map(queue.map((op) => [op.key, op]))

  for (const [key, item] of after) {
    const prior = before.get(key)
    if (prior && fingerprint(prior.payload) === fingerprint(item.payload)) continue
    const existing = byKey.get(key)
    if (existing?.syncStatus === 'conflict') continue
    const wasSynced = existing?.syncStatus === 'synced'
    byKey.set(key, {
      key,
      kind: item.kind,
      id: item.id,
      updatedAt: now,
      deletedAt: null,
      payload: item.payload,
      syncStatus: 'pending',
      lastSyncedAt: existing?.lastSyncedAt ?? null,
      cloudUpdatedAt: existing?.cloudUpdatedAt ?? null,
      baseUpdatedAt: wasSynced ? existing.updatedAt : (existing?.baseUpdatedAt ?? null),
      remotePayload: null,
      remoteUpdatedAt: null,
      remoteDeletedAt: null,
    })
  }

  for (const [key, item] of before) {
    if (after.has(key)) continue
    const existing = byKey.get(key)
    if (existing?.syncStatus === 'conflict') continue
    byKey.set(key, {
      key,
      kind: item.kind,
      id: item.id,
      updatedAt: now,
      deletedAt: now,
      payload: item.payload,
      syncStatus: 'pending',
      lastSyncedAt: existing?.lastSyncedAt ?? null,
      cloudUpdatedAt: existing?.cloudUpdatedAt ?? null,
      baseUpdatedAt: existing?.syncStatus === 'synced' ? existing.updatedAt : (existing?.baseUpdatedAt ?? null),
      remotePayload: null,
      remoteUpdatedAt: null,
      remoteDeletedAt: null,
    })
  }

  return [...byKey.values()]
}

export function decideRemote(op: SyncOp | undefined, remote: RemoteRecord): RemoteDecision {
  if (op?.syncStatus === 'conflict') return 'ignore'
  const same = op ? fingerprint(op.payload) === fingerprint(remote.payload) && Boolean(op.deletedAt) === Boolean(remote.deletedAt) : false
  if (!op || op.syncStatus === 'synced') {
    if (op?.cloudUpdatedAt && remote.updatedAt <= op.cloudUpdatedAt && same) return 'ignore'
    return 'apply'
  }
  if (same) return 'ignore'
  const base = op.cloudUpdatedAt ?? op.baseUpdatedAt
  if (!base || remote.updatedAt > base) return 'conflict'
  return 'keep-local'
}

export function applyRemoteRecord(snapshot: JournalSnapshot, remote: RemoteRecord): JournalSnapshot {
  if (remote.deletedAt) return removeEntity(snapshot, remote.kind, remote.id)
  return upsertEntity(snapshot, remote.kind, remote.id, remote.payload)
}

export function markSynced(op: SyncOp, syncedAt: string): SyncOp {
  return {
    ...op,
    syncStatus: 'synced',
    deletedAt: op.deletedAt,
    lastSyncedAt: syncedAt,
    cloudUpdatedAt: op.updatedAt,
    baseUpdatedAt: op.updatedAt,
    remotePayload: null,
    remoteUpdatedAt: null,
    remoteDeletedAt: null,
  }
}

export function markConflict(op: SyncOp, remote: RemoteRecord): SyncOp {
  return {
    ...op,
    syncStatus: 'conflict',
    remotePayload: remote.payload,
    remoteUpdatedAt: remote.updatedAt,
    remoteDeletedAt: remote.deletedAt,
  }
}

export function acceptRemote(op: SyncOp, remote: RemoteRecord, syncedAt: string): SyncOp {
  return {
    ...op,
    payload: remote.payload,
    updatedAt: remote.updatedAt,
    deletedAt: remote.deletedAt,
    syncStatus: 'synced',
    lastSyncedAt: syncedAt,
    cloudUpdatedAt: remote.updatedAt,
    baseUpdatedAt: remote.updatedAt,
    remotePayload: null,
    remoteUpdatedAt: null,
    remoteDeletedAt: null,
  }
}

export function duplicateRemote(snapshot: JournalSnapshot, remote: RemoteRecord, newId = createId()): JournalSnapshot {
  if (!canDuplicate(remote.kind) || !remote.payload || typeof remote.payload !== 'object') return snapshot
  const payload = { ...(remote.payload as Record<string, unknown>), id: newId }
  return upsertEntity(snapshot, remote.kind, newId, payload)
}

export function recordLabel(op: SyncOp): string {
  if (!op.payload || typeof op.payload !== 'object') return op.id
  const payload = op.payload as { content?: string; title?: string; date?: string; month?: number; year?: number }
  return payload.title || payload.content || payload.date || op.id
}

function indexSnapshot(snapshot: JournalSnapshot): Map<string, { kind: EntityKind; id: string; payload: unknown }> {
  const rows = new Map<string, { kind: EntityKind; id: string; payload: unknown }>()
  const add = (kind: EntityKind, id: string, payload: unknown) => {
    rows.set(syncKey(kind, id), { kind, id, payload })
  }
  for (const entry of snapshot.entries) add('entry', entry.id, entry)
  for (const day of snapshot.days) add('day', day.date, day)
  for (const log of snapshot.monthlyLogs) add('monthlyLog', log.id, log)
  for (const goal of snapshot.goals) add('goal', goal.id, goal)
  for (const review of snapshot.reviews) add('review', review.id, review)
  for (const reflection of snapshot.reflections) add('reflection', reflection.id, reflection)
  for (const collection of snapshot.collections) add('collection', collection.id, collection)
  for (const item of snapshot.futureItems) add('future', item.id, item)
  for (const row of snapshot.indexOverrides) add('index', row.id, row)
  add('settings', 'app', snapshot.settings)
  return rows
}

export function upsertEntity(snapshot: JournalSnapshot, kind: EntityKind, _id: string, payload: unknown): JournalSnapshot {
  switch (kind) {
    case 'entry':
      return { ...snapshot, entries: upsertById(snapshot.entries, payload as JournalEntry) }
    case 'day':
      return { ...snapshot, days: upsertBy(snapshot.days, payload as DayPage, (day) => day.date) }
    case 'monthlyLog':
      return { ...snapshot, monthlyLogs: upsertById(snapshot.monthlyLogs, payload as MonthlyLog) }
    case 'goal':
      return { ...snapshot, goals: upsertById(snapshot.goals, payload as Goal) }
    case 'review':
      return { ...snapshot, reviews: upsertById(snapshot.reviews, payload as QuarterlyReview) }
    case 'reflection':
      return { ...snapshot, reflections: upsertById(snapshot.reflections, payload as MonthlyReflection) }
    case 'collection':
      return { ...snapshot, collections: upsertById(snapshot.collections, payload as Collection) }
    case 'future':
      return { ...snapshot, futureItems: upsertById(snapshot.futureItems, payload as FutureLogItem) }
    case 'index':
      return { ...snapshot, indexOverrides: upsertById(snapshot.indexOverrides, payload as IndexOverride) }
    case 'settings':
      return { ...snapshot, settings: payload as JournalSnapshot['settings'] }
    default:
      return snapshot
  }
}

export function removeEntity(snapshot: JournalSnapshot, kind: EntityKind, id: string): JournalSnapshot {
  switch (kind) {
    case 'entry':
      return { ...snapshot, entries: snapshot.entries.filter((item) => item.id !== id) }
    case 'day':
      return { ...snapshot, days: snapshot.days.filter((item) => item.date !== id) }
    case 'monthlyLog':
      return { ...snapshot, monthlyLogs: snapshot.monthlyLogs.filter((item) => item.id !== id) }
    case 'goal':
      return { ...snapshot, goals: snapshot.goals.filter((item) => item.id !== id) }
    case 'review':
      return { ...snapshot, reviews: snapshot.reviews.filter((item) => item.id !== id) }
    case 'reflection':
      return { ...snapshot, reflections: snapshot.reflections.filter((item) => item.id !== id) }
    case 'collection':
      return { ...snapshot, collections: snapshot.collections.filter((item) => item.id !== id) }
    case 'future':
      return { ...snapshot, futureItems: snapshot.futureItems.filter((item) => item.id !== id) }
    case 'index':
      return { ...snapshot, indexOverrides: snapshot.indexOverrides.filter((item) => item.id !== id) }
    default:
      return snapshot
  }
}

function upsertById<T extends { id: string }>(items: T[], item: T): T[] {
  return upsertBy(items, item, (row) => row.id)
}

function upsertBy<T>(items: T[], item: T, idOf: (item: T) => string): T[] {
  const id = idOf(item)
  const index = items.findIndex((candidate) => idOf(candidate) === id)
  if (index < 0) return [...items, item]
  const next = items.slice()
  next[index] = item
  return next
}

function fingerprint(value: unknown): string {
  return stableStringify(value)
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
      .join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}
