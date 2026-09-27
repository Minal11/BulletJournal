import { hourOf } from './dates.ts'
import type { JournalEntry } from './types.ts'

function padTime(hour: number, minute: number): string {
  const twelve = hour % 12 === 0 ? 12 : hour % 12
  const suffix = hour >= 12 ? 'PM' : 'AM'
  return `${twelve}:${String(minute).padStart(2, '0')} ${suffix}`
}

function bestWindow(entries: JournalEntry[]): { start: string; end: string } | null {
  const minutes = entries
    .map((entry) => {
      if (!entry.timestamp) return null
      const [hourText, minuteText] = entry.timestamp.split(':')
      const hour = Number(hourText)
      const minute = Number(minuteText)
      if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null
      return hour * 60 + minute
    })
    .filter((value): value is number => value !== null)
    .sort((a, b) => a - b)
  if (minutes.length < 3) return null

  let bestStart = minutes[0] ?? 0
  let bestCount = 0
  for (const start of minutes) {
    const end = start + 120
    const count = minutes.filter((value) => value >= start && value <= end).length
    if (count > bestCount) {
      bestCount = count
      bestStart = start
    }
  }
  if (bestCount < 3) return null
  const startHour = Math.floor(bestStart / 60)
  const startMinute = bestStart % 60
  const endTotal = bestStart + 120
  return {
    start: padTime(startHour, startMinute),
    end: padTime(Math.floor(endTotal / 60) % 24, endTotal % 60),
  }
}

export function journalPatterns(entries: JournalEntry[]): string[] {
  const lines: string[] = []
  const timed = entries.filter((entry) => entry.scope === 'day' && entry.timestamp)
  if (timed.length < 5) return lines

  const completed = timed.filter((entry) => entry.type === 'task' && entry.taskStatus === 'complete')
  const window = bestWindow(completed.length >= 3 ? completed : timed)
  if (window) {
    lines.push(
      completed.length >= 3
        ? `Completed tasks clustered between ${window.start} and ${window.end}.`
        : `Most entries were logged between ${window.start} and ${window.end}.`,
    )
  }

  const migrated = entries.filter((entry) => entry.type === 'task' && entry.taskStatus === 'migrated' && entry.timestamp)
  if (migrated.length >= 2) {
    const late = migrated.filter((entry) => entry.timestamp && hourOf(entry.timestamp) >= 20).length
    if (late >= Math.ceil(migrated.length / 2)) {
      lines.push('Most migrated tasks were originally logged after 8 PM.')
    }
  }

  const starred = timed.filter((entry) => entry.signifiers.includes('important'))
  if (starred.length >= 2) {
    const evening = starred.filter((entry) => {
      const hour = hourOf(entry.timestamp ?? '')
      return hour >= 17 && hour <= 21
    }).length
    if (evening >= Math.ceil(starred.length / 2)) {
      lines.push('Starred moments were logged most often in the evening.')
    }
  }

  return lines
}
