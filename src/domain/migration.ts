import { nextTaskStatus } from './bullets.ts'
import { addDays, formatShortDate, monthName, nextMonthOf, todayISO } from './dates.ts'
import { makeEntry } from './entries.ts'
import { createId } from './ids.ts'
import type { FutureLogItem, JournalEntry, MigrationAction, TaskStatus } from './types.ts'

export interface MigrationContext {
  now?: Date
  targetYear?: number
  targetMonth?: number
}

function stamp(now: Date): string {
  return now.toISOString()
}

function upsert(entries: JournalEntry[], entry: JournalEntry): JournalEntry[] {
  const index = entries.findIndex((item) => item.id === entry.id)
  if (index < 0) return [...entries, entry]
  const next = entries.slice()
  next[index] = entry
  return next
}

function isPristineChild(child: JournalEntry, parent: JournalEntry): boolean {
  return (
    child.migratedFromId === parent.id &&
    child.createdAt === child.updatedAt &&
    child.taskStatus === 'open' &&
    child.content === parent.content
  )
}

function isPristineFuture(item: FutureLogItem): boolean {
  return item.createdAt === item.updatedAt && !item.reviewed
}

function targetFor(entry: JournalEntry, options?: MigrationContext): { year: number; month: number } {
  if (options?.targetYear && options.targetMonth) {
    return { year: options.targetYear, month: options.targetMonth }
  }
  return nextMonthOf(entry.date ?? '1970-01-01')
}

function makeForwardChild(parent: JournalEntry, now: Date, monthly: boolean): JournalEntry {
  if (monthly) {
    const target = nextMonthOf(parent.date ?? '1970-01-01')
    return makeEntry({
      date: `${target.year}-${String(target.month).padStart(2, '0')}-01`,
      content: parent.content,
      type: 'task',
      scope: 'month',
      taskStatus: 'open',
      signifiers: parent.signifiers,
      collectionIds: parent.collectionIds,
      goalIds: parent.goalIds,
      migratedFromId: parent.id,
      sortOrder: parent.sortOrder,
      showTimestamp: false,
      now,
    })
  }
  return makeEntry({
    date: addDays(parent.date ?? todayISO(now), 1),
    content: parent.content,
    type: 'task',
    scope: 'day',
    taskStatus: 'open',
    signifiers: parent.signifiers,
    collectionIds: parent.collectionIds,
    goalIds: parent.goalIds,
    migratedFromId: parent.id,
    sortOrder: parent.sortOrder,
    showTimestamp: false,
    now,
  })
}

function makeFuture(parent: JournalEntry, target: { year: number; month: number }, now: Date): FutureLogItem {
  const iso = stamp(now)
  return {
    id: createId(),
    targetMonth: target.month,
    targetYear: target.year,
    type: 'task',
    content: parent.content,
    taskStatus: 'open',
    signifiers: [...parent.signifiers],
    relatedGoalId: parent.goalIds[0] ?? null,
    sourceEntryId: parent.id,
    reviewed: false,
    sortOrder: 0,
    createdAt: iso,
    updatedAt: iso,
  }
}

function stripSideEffects(
  entries: JournalEntry[],
  futureItems: FutureLogItem[],
  entry: JournalEntry,
  keep: { child: boolean; future: boolean },
): { entries: JournalEntry[]; futureItems: FutureLogItem[] } {
  let nextEntries = entries
  if (!keep.child && entry.migratedToId) {
    const child = entries.find((item) => item.id === entry.migratedToId)
    if (child && isPristineChild(child, entry)) {
      nextEntries = entries.filter((item) => item.id !== child.id)
    }
  }
  const nextFuture = keep.future
    ? futureItems
    : futureItems.filter((item) => item.sourceEntryId !== entry.id || item.reviewed || !isPristineFuture(item))
  return { entries: nextEntries, futureItems: nextFuture }
}

export function applyTaskStatus(
  entries: JournalEntry[],
  futureItems: FutureLogItem[],
  entryId: string,
  status: TaskStatus,
  options?: MigrationContext & { monthlyForward?: boolean },
): { entries: JournalEntry[]; futureItems: FutureLogItem[] } {
  const entry = entries.find((item) => item.id === entryId)
  if (!entry || entry.type !== 'task') return { entries, futureItems }
  const now = options?.now ?? new Date()
  const childExists = Boolean(entry.migratedToId && entries.some((item) => item.id === entry.migratedToId))
  if (entry.taskStatus === status && status !== 'scheduled' && (status !== 'migrated' || childExists)) {
    return { entries, futureItems }
  }

  const stripped = stripSideEffects(entries, futureItems, entry, {
    child: status === 'migrated',
    future: status === 'scheduled',
  })
  const current = stripped.entries.find((item) => item.id === entryId) ?? entry
  let updated: JournalEntry = {
    ...current,
    type: 'task',
    taskStatus: status,
    migrationDate: status === 'migrated' || status === 'scheduled' ? todayISO(now) : null,
    updatedAt: stamp(now),
  }
  let nextEntries = stripped.entries
  let nextFuture = stripped.futureItems

  if (status === 'migrated') {
    const existing = updated.migratedToId ? nextEntries.find((item) => item.id === updated.migratedToId) : undefined
    if (!existing) {
      const child = makeForwardChild(updated, now, options?.monthlyForward ?? updated.scope === 'month')
      updated = { ...updated, migratedToId: child.id }
      nextEntries = upsert(nextEntries, child)
    }
  } else if (!nextEntries.some((item) => item.id === updated.migratedToId)) {
    updated = { ...updated, migratedToId: null }
  }

  if (status === 'scheduled') {
    const target = targetFor(updated, options)
    const existing = nextFuture.find((item) => item.sourceEntryId === updated.id && !item.reviewed)
    if (!existing) {
      nextFuture = [...nextFuture, makeFuture(updated, target, now)]
    } else if (existing.targetYear !== target.year || existing.targetMonth !== target.month) {
      nextFuture = nextFuture.map((item) =>
        item.id === existing.id
          ? { ...item, targetYear: target.year, targetMonth: target.month, updatedAt: stamp(now) }
          : item,
      )
    }
  }

  return { entries: upsert(nextEntries, updated), futureItems: nextFuture }
}

export function cycleTaskStatus(
  entries: JournalEntry[],
  futureItems: FutureLogItem[],
  entryId: string,
  options?: MigrationContext,
): { entries: JournalEntry[]; futureItems: FutureLogItem[] } {
  const entry = entries.find((item) => item.id === entryId)
  if (!entry || entry.type !== 'task') return { entries, futureItems }
  return applyTaskStatus(entries, futureItems, entryId, nextTaskStatus(entry.taskStatus), options)
}

export function migrateToNextMonth(
  entries: JournalEntry[],
  futureItems: FutureLogItem[],
  entryId: string,
  options?: MigrationContext,
): { entries: JournalEntry[]; futureItems: FutureLogItem[] } {
  const entry = entries.find((item) => item.id === entryId)
  if (!entry) return { entries, futureItems }
  const existing = entry.migratedToId
    ? entries.find((item) => item.id === entry.migratedToId && item.scope === 'month')
    : undefined
  if (entry.taskStatus === 'migrated' && existing) return { entries, futureItems }
  const now = options?.now ?? new Date()
  const stripped = stripSideEffects(entries, futureItems, entry, { child: false, future: false })
  const current = stripped.entries.find((item) => item.id === entryId) ?? entry
  const child = makeForwardChild(current, now, true)
  const updated: JournalEntry = {
    ...current,
    type: 'task',
    taskStatus: 'migrated',
    migratedToId: child.id,
    migrationDate: todayISO(now),
    updatedAt: stamp(now),
  }
  return {
    entries: upsert(upsert(stripped.entries, updated), child),
    futureItems: stripped.futureItems,
  }
}

export function applyMigrationAction(
  entries: JournalEntry[],
  futureItems: FutureLogItem[],
  entryId: string,
  action: MigrationAction,
  options?: MigrationContext,
): { entries: JournalEntry[]; futureItems: FutureLogItem[] } {
  if (action === 'next_month') return migrateToNextMonth(entries, futureItems, entryId, options)
  if (action === 'future') return applyTaskStatus(entries, futureItems, entryId, 'scheduled', options)
  if (action === 'complete') return applyTaskStatus(entries, futureItems, entryId, 'complete', options)
  return applyTaskStatus(entries, futureItems, entryId, 'cancelled', options)
}

export function undoMigration(
  entries: JournalEntry[],
  futureItems: FutureLogItem[],
  entryId: string,
  options?: MigrationContext,
): { entries: JournalEntry[]; futureItems: FutureLogItem[] } {
  return applyTaskStatus(entries, futureItems, entryId, 'open', options)
}

export function entryCaptions(
  entry: JournalEntry,
  entries: JournalEntry[],
  futureItems: FutureLogItem[],
): string[] {
  if (entry.migratedFromId) {
    const parent = entries.find((item) => item.id === entry.migratedFromId)
    if (parent?.date) return [`From ${formatShortDate(parent.date)}`]
  }
  if (entry.taskStatus === 'migrated' && entry.migratedToId) {
    const child = entries.find((item) => item.id === entry.migratedToId)
    if (!child) return ['> Migrated']
    if (child.scope === 'day' && entry.date && child.date === addDays(entry.date, 1)) return ['> Move to tomorrow.']
    if (child.scope === 'month') {
      const parts = (child.date ?? '').split('-')
      const month = monthName(Number(parts[1]))
      return [
        `Created ${entry.date ? formatShortDate(entry.date) : 'earlier'}`,
        `Migrated ${formatShortDate(entry.migrationDate ?? entry.date ?? child.date ?? '')} → ${month}`,
      ]
    }
    return [`Migrated → ${child.date ? formatShortDate(child.date) : 'later'}`]
  }
  if (entry.taskStatus === 'scheduled') {
    const item = futureItems.find((future) => future.sourceEntryId === entry.id && !future.reviewed)
    if (item) return [`< ${monthName(item.targetMonth)}`]
    return ['< Scheduled for later']
  }
  return []
}

export function tasksAwaitingMigration(entries: JournalEntry[], year: number, month: number) {
  const prefix = `${year}-${String(month).padStart(2, '0')}`
  return entries
    .filter((entry): entry is JournalEntry & { date: string } => entry.type === 'task' && entry.taskStatus === 'open' && Boolean(entry.date?.startsWith(prefix)))
    .slice()
    .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '') || (a.timestamp ?? '').localeCompare(b.timestamp ?? ''))
}

export function bringFutureItem(
  entries: JournalEntry[],
  futureItems: FutureLogItem[],
  itemId: string,
  date: string,
  now = new Date(),
): { entries: JournalEntry[]; futureItems: FutureLogItem[] } {
  const item = futureItems.find((future) => future.id === itemId)
  if (!item || item.reviewed) return { entries, futureItems }
  const entry = makeEntry({
    date,
    content: item.content,
    type: item.type === 'note' || item.type === 'event' ? item.type : 'task',
    scope: item.type === 'task' ? 'month' : 'day',
    taskStatus: item.type === 'task' ? 'open' : null,
    signifiers: item.signifiers,
    goalIds: item.relatedGoalId ? [item.relatedGoalId] : [],
    timestamp: null,
    showTimestamp: false,
    now,
  })
  if (item.type !== 'task') {
    entry.scope = 'day'
    entry.date = date
  } else {
    entry.date = `${item.targetYear}-${String(item.targetMonth).padStart(2, '0')}-01`
  }
  const iso = now.toISOString()
  return {
    entries: [...entries, entry],
    futureItems: futureItems.map((future) =>
      future.id === item.id ? { ...future, reviewed: true, updatedAt: iso } : future,
    ),
  }
}
