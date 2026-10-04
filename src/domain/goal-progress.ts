import type { JournalEntry } from './types.ts'

export interface GoalProgress {
  completed: number
  total: number
  /** Null when the goal has no eligible tasks. */
  percent: number | null
}

/** Canonical tasks for a Goal. Cancelled lines and migrated copies stay out of the list. */
export function tasksForGoal(entries: JournalEntry[], goalId: string): JournalEntry[] {
  return entries
    .filter(
      (entry) =>
        entry.type === 'task' &&
        entry.goalIds.includes(goalId) &&
        entry.taskStatus !== 'cancelled' &&
        !entry.migratedToId,
    )
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt))
}

/** Each linked task counts once. Notes, events, cancelled lines, and migrated copies do not. */
export function goalProgress(entries: JournalEntry[], goalId: string): GoalProgress {
  const eligible = tasksForGoal(entries, goalId).filter(
    (entry) => entry.taskStatus === 'open' || entry.taskStatus === 'complete',
  )
  const total = eligible.length
  const completed = eligible.filter((entry) => entry.taskStatus === 'complete').length
  if (total === 0) return { completed: 0, total: 0, percent: null }
  return { completed, total, percent: Math.round((completed / total) * 100) }
}
