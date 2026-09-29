import { createId } from './ids.ts'
import type { Habit, HabitLog, JournalSnapshot, MonthlyHabitSelection } from './types.ts'

export function habitActiveInMonth(habit: Habit, year: number, month: number): boolean {
  if (habit.archived) return false
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const end = `${year}-${String(month).padStart(2, '0')}-31`
  if (habit.activeFrom > end) return false
  if (habit.inactiveFrom && habit.inactiveFrom < start) return false
  return true
}

export function monthHabits(snapshot: JournalSnapshot, year: number, month: number): Habit[] {
  const selected = new Set(
    snapshot.habitMonths.filter((item) => item.year === year && item.month === month && item.enabled).map((item) => item.habitId),
  )
  return snapshot.habits
    .filter((habit) => selected.has(habit.id))
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
}

export function habitChecked(logs: HabitLog[], habitId: string, date: string): boolean {
  return logs.some((log) => log.habitId === habitId && log.date === date && log.completed)
}

export function toggleHabitLog(logs: HabitLog[], habitId: string, date: string, now = new Date()): HabitLog[] {
  const existing = logs.find((log) => log.habitId === habitId && log.date === date)
  const iso = now.toISOString()
  if (!existing) {
    return [...logs, { id: createId(), habitId, date, completed: true, createdAt: iso, updatedAt: iso }]
  }
  return logs.map((log) => (log.id === existing.id ? { ...log, completed: !log.completed, updatedAt: iso } : log))
}

export function setMonthHabit(
  selections: MonthlyHabitSelection[],
  habitId: string,
  year: number,
  month: number,
  enabled: boolean,
  now = new Date(),
): MonthlyHabitSelection[] {
  const existing = selections.find((item) => item.habitId === habitId && item.year === year && item.month === month)
  const iso = now.toISOString()
  if (!existing) return [...selections, { id: createId(), habitId, year, month, enabled, updatedAt: iso }]
  return selections.map((item) => (item.id === existing.id ? { ...item, enabled, updatedAt: iso } : item))
}

export function habitSummary(logs: HabitLog[], habitId: string, year: number, month: number, days: number): { done: number; days: number } {
  const prefix = `${year}-${String(month).padStart(2, '0')}-`
  const done = logs.filter((log) => log.habitId === habitId && log.date.startsWith(prefix) && log.completed).length
  return { done, days }
}
