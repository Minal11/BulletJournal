import type { JournalEntry } from './types.ts'

export interface GoalProgress {
  completed: number
  total: number
  /** Null when the goal has no eligible tasks. */
  percent: number | null
}

/** Each linked task counts once. Notes, events, cancelled lines, and migrated copies do not. */
export function goalProgress(entries: JournalEntry[], goalId: string): GoalProgress {
  const eligible = entries.filter(
    (entry) =>
      entry.type === 'task' &&
      entry.goalIds.includes(goalId) &&
      (entry.taskStatus === 'open' || entry.taskStatus === 'complete') &&
      !entry.migratedToId,
  )
  const total = eligible.length
  const completed = eligible.filter((entry) => entry.taskStatus === 'complete').length
  if (total === 0) return { completed: 0, total: 0, percent: null }
  return { completed, total, percent: Math.round((completed / total) * 100) }
}
