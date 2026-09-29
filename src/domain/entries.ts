import { extractTags } from './bullets.ts'
import { createId } from './ids.ts'
import type { BulletType, Collection, EntryScope, Goal, JournalEntry, Signifier, TaskStatus } from './types.ts'

export function makeEntry(
    input: {
    date: string | null
    content: string
    type?: BulletType
    scope?: EntryScope
    timestamp?: string | null
    showTimestamp?: boolean
    taskStatus?: TaskStatus | null
    signifiers?: Signifier[]
    tags?: string[]
    note?: string
    collectionIds?: string[]
    goalIds?: string[]
    migratedFromId?: string | null
    migratedToId?: string | null
    migrationDate?: string | null
    sortOrder?: number
    id?: string
    now?: Date
  },
): JournalEntry {
  const now = input.now ?? new Date()
  const iso = now.toISOString()
  const type = input.type ?? 'task'
  return {
    id: input.id ?? createId(),
    date: input.date,
    timestamp: input.timestamp ?? null,
    showTimestamp: input.showTimestamp ?? Boolean(input.timestamp),
    type,
    scope: input.scope ?? 'day',
    content: input.content,
    note: input.note ?? '',
    taskStatus: type === 'task' ? (input.taskStatus ?? 'open') : null,
    signifiers: input.signifiers ?? [],
    tags: [...new Set([...(input.tags ?? []), ...extractTags(input.content)])],
    collectionIds: input.collectionIds ?? [],
    goalIds: input.goalIds ?? [],
    migratedFromId: input.migratedFromId ?? null,
    migratedToId: input.migratedToId ?? null,
    migrationDate: input.migrationDate ?? null,
    scheduleHistory: [],
    sortOrder: input.sortOrder ?? 0,
    createdAt: iso,
    updatedAt: iso,
  }
}

export function withEntryContent(entry: JournalEntry, content: string, now = new Date()): JournalEntry {
  return {
    ...entry,
    content,
    tags: [...new Set([...entry.tags.filter((tag) => tag === 'memory'), ...extractTags(content)])],
    updatedAt: now.toISOString(),
  }
}

export function compareEntries(a: JournalEntry, b: JournalEntry, manual: boolean): number {
  if (manual) return a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt)
  const carriedA = Boolean(a.migratedFromId) && !a.timestamp
  const carriedB = Boolean(b.migratedFromId) && !b.timestamp
  if (carriedA !== carriedB) return carriedA ? -1 : 1
  if (a.timestamp && b.timestamp && a.timestamp !== b.timestamp) return a.timestamp.localeCompare(b.timestamp)
  if (a.timestamp && !b.timestamp) return -1
  if (!a.timestamp && b.timestamp) return 1
  return a.createdAt.localeCompare(b.createdAt)
}

export function dayEntries(entries: JournalEntry[], date: string, manual: boolean): JournalEntry[] {
  return entries
    .filter((entry) => entry.scope === 'day' && entry.date === date)
    .slice()
    .sort((a, b) => compareEntries(a, b, manual))
}

export function monthTasks(entries: JournalEntry[], year: number, month: number): JournalEntry[] {
  const prefix = `${year}-${String(month).padStart(2, '0')}`
  return entries
    .filter((entry) => entry.scope === 'month' && entry.date?.startsWith(prefix))
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt))
}

export function syncLinks(entries: JournalEntry[], collections: Collection[], goals: Goal[]): {
  collections: Collection[]
  goals: Goal[]
} {
  return {
    collections: collections.map((collection) => ({
      ...collection,
      linkedEntryIds: entries.filter((entry) => entry.collectionIds.includes(collection.id)).map((entry) => entry.id),
    })),
    goals: goals.map((goal) => ({
      ...goal,
      relatedEntryIds: entries.filter((entry) => entry.goalIds.includes(goal.id)).map((entry) => entry.id),
    })),
  }
}

export function moveIds(ids: string[], activeId: string, overId: string): string[] {
  const from = ids.indexOf(activeId)
  const to = ids.indexOf(overId)
  if (from < 0 || to < 0 || from === to) return ids
  const next = ids.slice()
  const [item] = next.splice(from, 1)
  if (!item) return ids
  next.splice(to, 0, item)
  return next
}
