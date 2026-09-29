import Dexie, { type Table } from 'dexie'
import type {
  Collection,
  DayPage,
  FutureLogItem,
  Goal,
  Habit,
  HabitLog,
  MonthlyHabitSelection,
  IndexOverride,
  JournalEntry,
  JournalSnapshot,
  MonthlyLog,
  MonthlyReflection,
  QuarterlyReview,
} from '../domain/types.ts'
import type { SyncOp } from '../services/sync-diff.ts'

export const ANONYMOUS_DATABASE = 'MyBulletJournal'

export interface MetaRow {
  id: 'main'
  schemaVersion: number
  seeded: boolean
}

export interface SettingsRow {
  id: 'app'
  settings: JournalSnapshot['settings']
}

export interface BackupRow {
  id: string
  createdAt: string
  snapshot: JournalSnapshot
}

export interface SyncMetaRow {
  id: 'cursor'
  lastPullAt: string | null
  lastSuccessAt: string | null
}

const STORES = {
  entries: 'id, date, scope, type, taskStatus',
  days: 'date',
  monthlyLogs: 'id, year, month',
  goals: 'id, year, quarter',
  reviews: 'id, year, quarter',
  reflections: 'id, year, month',
  collections: 'id, archived, pinned',
  futureItems: 'id, targetYear, targetMonth, sourceEntryId',
  indexOverrides: 'id',
  meta: 'id',
  settings: 'id',
  backups: 'id, createdAt',
} as const

export class JournalDatabase extends Dexie {
  entries!: Table<JournalEntry, string>
  days!: Table<DayPage, string>
  monthlyLogs!: Table<MonthlyLog, string>
  goals!: Table<Goal, string>
  reviews!: Table<QuarterlyReview, string>
  reflections!: Table<MonthlyReflection, string>
  collections!: Table<Collection, string>
  futureItems!: Table<FutureLogItem, string>
  habits!: Table<Habit, string>
  habitLogs!: Table<HabitLog, string>
  habitMonths!: Table<MonthlyHabitSelection, string>
  indexOverrides!: Table<IndexOverride, string>
  meta!: Table<MetaRow, string>
  settings!: Table<SettingsRow, string>
  backups!: Table<BackupRow, string>
  syncOps!: Table<SyncOp, string>
  syncMeta!: Table<SyncMetaRow, string>

  constructor(name: string) {
    super(name)
    this.version(1).stores({ ...STORES })
    this.version(2).stores({
      ...STORES,
      syncOps: 'key, syncStatus, kind',
      syncMeta: 'id',
    })
    this.version(3).stores({
      ...STORES,
      habits: 'id, archived, sortOrder',
      habitLogs: 'id, habitId, date, [habitId+date]',
      habitMonths: 'id, year, month, habitId, [year+month+habitId]',
      syncOps: 'key, syncStatus, kind',
      syncMeta: 'id',
    })
  }
}

const opened = new Map<string, JournalDatabase>()
let active = new JournalDatabase(ANONYMOUS_DATABASE)
opened.set(ANONYMOUS_DATABASE, active)

export function currentDatabase(): JournalDatabase {
  return active
}

export function openNamedDatabase(name: string): JournalDatabase {
  const existing = opened.get(name)
  if (existing) return existing
  const database = new JournalDatabase(name)
  opened.set(name, database)
  return database
}

export async function activateDatabase(name: string): Promise<void> {
  const next = openNamedDatabase(name)
  if (next !== active) {
    active = next
    await active.open()
  }
}

export async function deleteDatabase(name: string): Promise<void> {
  const database = opened.get(name)
  if (database) {
    database.close()
    opened.delete(name)
  }
  if (active.name === name) {
    active = openNamedDatabase(ANONYMOUS_DATABASE)
  }
  await Dexie.delete(name)
}
