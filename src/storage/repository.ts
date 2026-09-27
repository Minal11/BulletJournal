import { SCHEMA_VERSION } from '../domain/types.ts'
import type { JournalSnapshot } from '../domain/types.ts'
import { migrateSnapshot } from '../domain/schema.ts'
import type { SyncOp } from '../services/sync-diff.ts'
import { activateDatabase, currentDatabase, openNamedDatabase } from './db.ts'

function database() {
  return currentDatabase()
}

export async function loadJournal(): Promise<JournalSnapshot | null> {
  return readFrom(database())
}

export async function readNamedJournal(name: string): Promise<JournalSnapshot | null> {
  const named = openNamedDatabase(name)
  await named.open()
  return readFrom(named)
}

async function readFrom(db: ReturnType<typeof currentDatabase>): Promise<JournalSnapshot | null> {
  const meta = await db.meta.get('main')
  if (!meta) return null
  const [entries, days, monthlyLogs, goals, reviews, reflections, collections, futureItems, indexOverrides, settingsRow] =
    await Promise.all([
      db.entries.toArray(),
      db.days.toArray(),
      db.monthlyLogs.toArray(),
      db.goals.toArray(),
      db.reviews.toArray(),
      db.reflections.toArray(),
      db.collections.toArray(),
      db.futureItems.toArray(),
      db.indexOverrides.toArray(),
      db.settings.get('app'),
    ])
  const loaded = migrateSnapshot({
    schemaVersion: meta.schemaVersion,
    app: 'my-bullet-journal',
    exportedAt: new Date().toISOString(),
    entries,
    days,
    monthlyLogs,
    goals,
    reviews,
    reflections,
    collections,
    futureItems,
    indexOverrides,
    settings: settingsRow?.settings,
  })
  if (!loaded.snapshot) throw new Error(loaded.errors[0] ?? 'The saved journal could not be opened.')
  return loaded.snapshot
}

export async function saveJournal(snapshot: JournalSnapshot): Promise<void> {
  const db = database()
  await db.transaction(
    'rw',
    [db.entries, db.days, db.monthlyLogs, db.goals, db.reviews, db.reflections, db.collections, db.futureItems, db.indexOverrides, db.settings, db.meta],
    async () => {
      await Promise.all([
        db.entries.clear(),
        db.days.clear(),
        db.monthlyLogs.clear(),
        db.goals.clear(),
        db.reviews.clear(),
        db.reflections.clear(),
        db.collections.clear(),
        db.futureItems.clear(),
        db.indexOverrides.clear(),
        db.settings.clear(),
      ])
      if (snapshot.entries.length) await db.entries.bulkAdd(snapshot.entries)
      if (snapshot.days.length) await db.days.bulkAdd(snapshot.days)
      if (snapshot.monthlyLogs.length) await db.monthlyLogs.bulkAdd(snapshot.monthlyLogs)
      if (snapshot.goals.length) await db.goals.bulkAdd(snapshot.goals)
      if (snapshot.reviews.length) await db.reviews.bulkAdd(snapshot.reviews)
      if (snapshot.reflections.length) await db.reflections.bulkAdd(snapshot.reflections)
      if (snapshot.collections.length) await db.collections.bulkAdd(snapshot.collections)
      if (snapshot.futureItems.length) await db.futureItems.bulkAdd(snapshot.futureItems)
      if (snapshot.indexOverrides.length) await db.indexOverrides.bulkAdd(snapshot.indexOverrides)
      await db.settings.put({ id: 'app', settings: snapshot.settings })
      await db.meta.put({ id: 'main', schemaVersion: SCHEMA_VERSION, seeded: true })
    },
  )
}

export async function saveBackup(snapshot: JournalSnapshot): Promise<void> {
  const db = database()
  const createdAt = new Date().toISOString()
  await db.backups.put({ id: `backup-${createdAt}`, createdAt, snapshot })
  const all = await db.backups.orderBy('createdAt').toArray()
  const extra = all.slice(0, Math.max(0, all.length - 5))
  if (extra.length) await db.backups.bulkDelete(extra.map((row) => row.id))
}

export async function latestBackup(): Promise<{ createdAt: string; snapshot: JournalSnapshot } | null> {
  const row = await database().backups.orderBy('createdAt').last()
  return row ? { createdAt: row.createdAt, snapshot: row.snapshot } : null
}

export async function loadSyncOps(): Promise<SyncOp[]> {
  return database().syncOps.toArray()
}

export async function saveSyncOp(op: SyncOp): Promise<void> {
  await database().syncOps.put(op)
}

export async function saveSyncOps(ops: SyncOp[]): Promise<void> {
  const db = database()
  await db.transaction('rw', db.syncOps, async () => {
    await db.syncOps.clear()
    if (ops.length) await db.syncOps.bulkAdd(ops)
  })
}

export async function loadSyncCursor(): Promise<{ lastPullAt: string | null; lastSuccessAt: string | null }> {
  const row = await database().syncMeta.get('cursor')
  return { lastPullAt: row?.lastPullAt ?? null, lastSuccessAt: row?.lastSuccessAt ?? null }
}

export async function saveSyncCursor(cursor: { lastPullAt: string | null; lastSuccessAt: string | null }): Promise<void> {
  await database().syncMeta.put({ id: 'cursor', ...cursor })
}

export async function useDatabase(name: string): Promise<void> {
  await activateDatabase(name)
}
