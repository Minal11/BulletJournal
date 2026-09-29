import type { JournalEntry } from '../domain/types.ts'
import type { EntityKind, RemoteRecord, SyncOp } from './sync-diff.ts'

export const CLOUD_TABLE: Record<EntityKind, string> = {
  entry: 'journal_entries',
  day: 'day_pages',
  monthlyLog: 'monthly_logs',
  goal: 'goals',
  review: 'quarterly_reviews',
  reflection: 'monthly_reflections',
  collection: 'collections',
  future: 'future_log_items',
  habit: 'habits',
  habitLog: 'habit_logs',
  habitMonth: 'monthly_habit_selections',
  index: 'index_overrides',
  settings: 'app_settings',
}

export function toCloudRow(userId: string, op: SyncOp): Record<string, unknown> {
  const createdAt = createdAtOf(op.payload) ?? op.updatedAt
  const row: Record<string, unknown> = {
    user_id: userId,
    id: op.id,
    payload: op.deletedAt ? op.payload ?? {} : op.payload,
    deleted_at: op.deletedAt,
    created_at: createdAt,
    updated_at: op.updatedAt,
  }
  if (op.kind === 'entry' && op.payload && typeof op.payload === 'object') {
    const entry = op.payload as JournalEntry
    row.date = entry.date
    row.entry_time = entry.timestamp
    row.entry_type = entry.type
    row.content = entry.content
    row.task_status = entry.taskStatus
    row.signifiers = entry.signifiers
    row.tags = entry.tags
    row.collection_ids = entry.collectionIds
    row.goal_ids = entry.goalIds
  }
  if (op.kind === 'goal' && op.payload && typeof op.payload === 'object') {
    const goal = op.payload as {
      title?: string
      category?: string
      quarter?: number
      year?: number
      goalText?: string
      why?: string
      measures?: string[]
      nextActions?: string[]
      status?: string
      notes?: string
      startDate?: string | null
    }
    Object.assign(row, {
      title: goal.title ?? '',
      category: goal.category ?? '',
      quarter: goal.quarter ?? 1,
      year: goal.year ?? 1970,
      goal_text: goal.goalText ?? '',
      why: goal.why ?? '',
      measures: goal.measures ?? [],
      next_actions: goal.nextActions ?? [],
      status: goal.status ?? 'not_started',
      notes: goal.notes ?? '',
      start_date: goal.startDate,
    })
  }
  if (op.kind === 'monthlyLog' && op.payload && typeof op.payload === 'object') {
    const log = op.payload as { year?: number; month?: number }
    row.year = log.year
    row.month = log.month
  }
  if (op.kind === 'reflection' && op.payload && typeof op.payload === 'object') {
    const reflection = op.payload as { year?: number; month?: number; monthInOneSentence?: string }
    row.year = reflection.year
    row.month = reflection.month
    row.month_in_one_sentence = reflection.monthInOneSentence ?? ''
  }
  if (op.kind === 'review' && op.payload && typeof op.payload === 'object') {
    const review = op.payload as { year?: number; quarter?: number }
    row.year = review.year
    row.quarter = review.quarter
  }
  if (op.kind === 'collection' && op.payload && typeof op.payload === 'object') {
    const collection = op.payload as { title?: string; description?: string; tags?: string[]; archived?: boolean }
    row.title = collection.title ?? ''
    row.description = collection.description ?? ''
    row.tags = collection.tags ?? []
    row.archived = Boolean(collection.archived)
  }
  if (op.kind === 'habit' && op.payload && typeof op.payload === 'object') {
    const habit = op.payload as { name?: string; description?: string; activeFrom?: string; inactiveFrom?: string | null; archived?: boolean }
    row.name = habit.name ?? ''
    row.description = habit.description ?? ''
    row.active_from = habit.activeFrom
    row.inactive_from = habit.inactiveFrom
    row.archived = Boolean(habit.archived)
  }
  if (op.kind === 'habitLog' && op.payload && typeof op.payload === 'object') {
    const log = op.payload as { habitId?: string; date?: string; completed?: boolean }
    row.habit_id = log.habitId
    row.date = log.date
    row.completed = Boolean(log.completed)
  }
  if (op.kind === 'habitMonth' && op.payload && typeof op.payload === 'object') {
    const selection = op.payload as { year?: number; month?: number; habitId?: string; enabled?: boolean }
    row.year = selection.year
    row.month = selection.month
    row.habit_id = selection.habitId
    row.enabled = Boolean(selection.enabled)
  }
  if (op.kind === 'future' && op.payload && typeof op.payload === 'object') {
    const item = op.payload as { targetYear?: number; targetMonth?: number; type?: string; content?: string }
    row.target_year = item.targetYear
    row.target_month = item.targetMonth
    row.entry_type = item.type
    row.content = item.content ?? ''
  }
  if (op.kind === 'day' && op.payload && typeof op.payload === 'object') {
    row.date = (op.payload as { date?: string }).date ?? op.id
  }
  return row
}

export function fromCloudRow(kind: EntityKind, row: Record<string, unknown>): RemoteRecord {
  return {
    kind,
    id: String(row.id),
    updatedAt: String(row.updated_at),
    deletedAt: row.deleted_at ? String(row.deleted_at) : null,
    payload: row.payload,
  }
}

function createdAtOf(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object' || !('createdAt' in payload)) return null
  const createdAt = (payload as { createdAt?: unknown }).createdAt
  return typeof createdAt === 'string' ? createdAt : null
}
