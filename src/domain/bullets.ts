import { entryKindOf, parseEntryInput, storedEntry, type EntryKind } from '../lib/entry-input.ts'
import type { BulletType, JournalEntry, Signifier, TaskStatus } from './types.ts'

export const TASK_CYCLE: TaskStatus[] = ['open', 'complete', 'migrated', 'scheduled', 'cancelled']

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  open: 'Open',
  complete: 'Completed',
  migrated: 'Migrated forward',
  scheduled: 'Scheduled for later',
  cancelled: 'Let go',
}

export const TYPE_LABEL: Record<BulletType, string> = {
  task: 'Task',
  event: 'Event',
  note: 'Note',
}

export const SIGNIFIER_LABEL: Record<Signifier, string> = {
  important: 'Important / memorable',
  insight: 'Insight',
  research: 'Needs research',
}

const SIGNIFIER_CYCLE: Array<Signifier | null> = [null, 'important', 'insight', 'research']

export type MarkName =
  | 'task'
  | 'event'
  | 'note'
  | 'complete'
  | 'migrated'
  | 'scheduled'
  | 'cancelled'
  | 'star'
  | 'check'
  | 'checked'

export function nextTaskStatus(status: TaskStatus | null): TaskStatus {
  const current = status ?? 'open'
  const index = TASK_CYCLE.indexOf(current)
  return TASK_CYCLE[(index + 1) % TASK_CYCLE.length] ?? 'open'
}

export function markForEntry(entry: Pick<JournalEntry, 'type' | 'taskStatus' | 'signifiers' | 'tags'>): MarkName {
  if (entry.type === 'task') {
    switch (entry.taskStatus) {
      case 'complete':
        return 'complete'
      case 'migrated':
        return 'migrated'
      case 'scheduled':
        return 'scheduled'
      case 'cancelled':
        return 'cancelled'
      default:
        return 'task'
    }
  }
  if (entry.tags?.includes('memory') || entry.signifiers.includes('important')) return 'star'
  return entry.type === 'event' ? 'event' : 'note'
}

export function bulletLabel(entry: Pick<JournalEntry, 'type' | 'taskStatus' | 'signifiers' | 'tags'>): string {
  if (entryKindOf(entry) === 'memory') return 'Memory'
  if (entry.type === 'task') {
    return `Task, ${TASK_STATUS_LABEL[entry.taskStatus ?? 'open']}. Change state.`
  }
  const mark = markForEntry(entry)
  if (mark === 'star') return `${TYPE_LABEL[entry.type]}, important. Change signifier.`
  return `${TYPE_LABEL[entry.type]}. Change signifier.`
}

export function cyclePrimarySignifier(current: Signifier[]): Signifier[] {
  const present = SIGNIFIER_CYCLE.find((item) => item !== null && current.includes(item)) ?? null
  const index = SIGNIFIER_CYCLE.indexOf(present)
  const next = SIGNIFIER_CYCLE[(index + 1) % SIGNIFIER_CYCLE.length] ?? null
  return next ? [next] : []
}

export function toggleSignifier(current: Signifier[], signifier: Signifier): Signifier[] {
  return current.includes(signifier) ? current.filter((item) => item !== signifier) : [...current, signifier]
}

export function symbolChar(mark: MarkName): string {
  switch (mark) {
    case 'task':
      return '•'
    case 'event':
      return '○'
    case 'note':
      return '–'
    case 'complete':
      return 'X'
    case 'migrated':
      return '>'
    case 'scheduled':
      return '<'
    case 'cancelled':
      return '—'
    case 'star':
      return '★'
    case 'check':
      return '○'
    case 'checked':
      return '✓'
    default:
      return '•'
  }
}

export function extractTags(content: string): string[] {
  const tags = new Set<string>()
  for (const match of content.matchAll(/(^|\s)#([A-Za-z][\w-]*)/g)) {
    const tag = match[2]?.toLowerCase()
    if (tag) tags.add(tag)
  }
  return [...tags]
}

export function parseRapidLog(
  raw: string,
  fallback: BulletType | EntryKind,
): { type: BulletType; content: string; signifiers: Signifier[]; memory: boolean } {
  const current: EntryKind = fallback === 'memory' ? 'memory' : fallback
  const parsed = parseEntryInput(raw, current)
  const stored = storedEntry(parsed.kind)
  return { type: stored.type, content: parsed.content, signifiers: stored.signifiers, memory: stored.memory }
}

export function signifierMarks(signifiers: Signifier[]): string {
  const parts: string[] = []
  if (signifiers.includes('important')) parts.push('★')
  if (signifiers.includes('insight')) parts.push('!')
  if (signifiers.includes('research')) parts.push('?')
  return parts.join(' ')
}
