import type { JournalEntry } from './types.ts'

export function isMasterTask(entry: JournalEntry): boolean {
  return entry.type === 'task' && entry.taskStatus === 'open' && entry.date == null
}

export function masterTasks(entries: JournalEntry[]): JournalEntry[] {
  return entries.filter(isMasterTask).slice().sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt))
}

function withSchedule(entry: JournalEntry, date: string | null, now: Date): JournalEntry {
  if (entry.date === date) return entry
  return {
    ...entry,
    date,
    scope: 'day',
    scheduleHistory: [...entry.scheduleHistory, { from: entry.date, to: date, changedAt: now.toISOString() }],
    updatedAt: now.toISOString(),
  }
}

/** Move the same task onto a day. Completed lines stay where they were finished. */
export function scheduleTask(entry: JournalEntry, date: string, now = new Date()): JournalEntry {
  if (entry.type !== 'task' || entry.taskStatus === 'complete' || entry.taskStatus === 'cancelled') return entry
  return withSchedule(entry, date, now)
}

/** An open scheduled task can return to the unscheduled list. */
export function unscheduleTask(entry: JournalEntry, now = new Date()): JournalEntry {
  if (entry.type !== 'task' || entry.taskStatus !== 'open') return entry
  return withSchedule(entry, null, now)
}
