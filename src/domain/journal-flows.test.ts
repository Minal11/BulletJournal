import { describe, expect, it } from 'vitest'
import { makeEntry } from './entries.ts'
import { goalProgress, tasksForGoal } from './goal-progress.ts'
import { habitChecked, monthHabits, setMonthHabit, toggleHabitLog } from './habits.ts'
import { emptySnapshot, migrateSnapshot } from './schema.ts'
import { masterTasks, scheduleTask, unscheduleTask } from './tasks.ts'
import { searchJournal } from './search.ts'
import { futureDraftAfterRefresh } from '../lib/future-draft.ts'
import { defaultGoalOpen, goalHeaderShouldToggle, goalTasksSurviveFold } from '../lib/goal-ui.ts'
import { diffSnapshots } from '../services/sync-diff.ts'
import type { Habit, JournalEntry } from './types.ts'

function task(patch: Partial<JournalEntry> & { id: string; content: string }): JournalEntry {
  return {
    ...makeEntry({
      id: patch.id,
      date: patch.date === undefined ? '2026-10-03' : patch.date,
      content: patch.content,
      type: patch.type ?? 'task',
      taskStatus: patch.type && patch.type !== 'task' ? null : (patch.taskStatus ?? 'open'),
      goalIds: patch.goalIds,
      now: new Date('2026-10-01T00:00:00.000Z'),
    }),
    ...patch,
    scheduleHistory: patch.scheduleHistory ?? [],
  }
}

function habit(id: string, name: string, patch: Partial<Habit> = {}): Habit {
  return {
    id,
    name,
    description: '',
    activeFrom: '2026-09-01',
    inactiveFrom: null,
    archived: false,
    defaultForFutureMonths: false,
    sortOrder: 0,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...patch,
  }
}

describe('future log drafts', () => {
  it('keeps a saved edit and ignores a refresh while the line is dirty', () => {
    const saved = futureDraftAfterRefresh({ id: 'a', content: 'Hawaii planning', dirty: false }, { id: 'a', content: 'Hawaii plans' })
    expect(saved.content).toBe('Hawaii plans')
    const dirty = futureDraftAfterRefresh({ id: 'a', content: 'Hawaii plans, revised', dirty: true }, { id: 'a', content: 'Hawaii plans' })
    expect(dirty.content).toBe('Hawaii plans, revised')
    expect(dirty.dirty).toBe(true)
  })
})

describe('collapsible goals', () => {
  it('starts a long list collapsed and ignores clicks on controls', () => {
    expect(defaultGoalOpen(1)).toBe(true)
    expect(defaultGoalOpen(4)).toBe(false)
    expect(goalHeaderShouldToggle('HEADER')).toBe(true)
    expect(goalHeaderShouldToggle('BUTTON')).toBe(false)
    expect(goalHeaderShouldToggle('INPUT')).toBe(false)
    const tasks = [{ id: '1', content: 'Update resume' }]
    expect(goalTasksSurviveFold(tasks, false)).toEqual(tasks)
    expect(goalTasksSurviveFold(tasks, true)).toEqual(tasks)
  })
})

describe('goal progress', () => {
  it('counts each linked open or completed task once', () => {
    const entries = [
      task({ id: '1', content: 'Update resume', goalIds: ['career'], taskStatus: 'complete', date: null }),
      task({ id: '2', content: 'AI session', goalIds: ['career'], taskStatus: 'complete', date: '2026-10-03' }),
      task({ id: '3', content: 'Spring', goalIds: ['career'], date: null }),
      task({ id: '4', content: 'Design', goalIds: ['career'], date: '2026-10-04' }),
      task({ id: '5', content: 'Dropped', goalIds: ['career'], taskStatus: 'cancelled' }),
      task({ id: '6', content: 'A note', goalIds: ['career'], type: 'note' }),
      task({ id: '7', content: 'Moved', goalIds: ['career'], taskStatus: 'migrated', migratedToId: '8' }),
    ]
    expect(goalProgress(entries, 'career')).toEqual({ completed: 2, total: 4, percent: 50 })
    entries[2] = { ...entries[2]!, taskStatus: 'complete' }
    expect(goalProgress(entries, 'career').percent).toBe(75)
    const moved = scheduleTask(entries[0]!, '2026-10-05')
    const again = scheduleTask(moved, '2026-10-07')
    expect(again.id).toBe('1')
    expect(goalProgress([again, entries[1]!, entries[2]!, entries[3]!], 'career').total).toBe(4)
    expect(goalProgress([], 'career')).toEqual({ completed: 0, total: 0, percent: null })
  })

  it('lists Goal tasks from canonical records, not nextActions', () => {
    const entries = [
      task({ id: '1', content: 'Update resume', goalIds: ['career'], taskStatus: 'complete', date: null }),
      task({ id: '2', content: 'Practice Spring', goalIds: ['career'], date: null }),
      task({ id: '3', content: 'Dropped', goalIds: ['career'], taskStatus: 'cancelled' }),
    ]
    expect(tasksForGoal(entries, 'career').map((entry) => entry.content)).toEqual(['Update resume', 'Practice Spring'])
    expect(goalProgress(entries, 'career')).toEqual({ completed: 1, total: 2, percent: 50 })
    const added = [...entries, task({ id: '4', content: 'Practice system design', goalIds: ['career'], date: null })]
    expect(goalProgress(added, 'career')).toEqual({ completed: 1, total: 3, percent: 33 })
  })

  it('turns saved next actions into tasks without dropping the words', () => {
    const loaded = migrateSnapshot({
      schemaVersion: 1,
      app: 'my-bullet-journal',
      goals: [{ id: 'career', title: 'Career', nextActions: ['Update resume', 'Practice Spring'], year: 2026, quarter: 4 }],
      entries: [],
    })
    expect(loaded.snapshot?.goals[0]?.nextActions).toEqual([])
    expect(loaded.snapshot?.entries.map((entry) => entry.content).sort()).toEqual(['Practice Spring', 'Update resume'])
    expect(loaded.snapshot?.entries.every((entry) => entry.date === null && entry.goalIds.includes('career'))).toBe(true)
  })
})

describe('master tasks', () => {
  it('moves the same task onto a day, back again, and between days', () => {
    const open = task({ id: 'dentist', content: 'Book dentist', date: null })
    expect(masterTasks([open]).map((entry) => entry.id)).toEqual(['dentist'])
    const scheduled = scheduleTask(open, '2026-10-03', new Date('2026-10-01T12:00:00.000Z'))
    expect(scheduled.id).toBe('dentist')
    expect(scheduled.date).toBe('2026-10-03')
    expect(masterTasks([scheduled])).toHaveLength(0)
    const done = { ...scheduled, taskStatus: 'complete' as const }
    expect(masterTasks([done])).toHaveLength(0)
    expect(done.date).toBe('2026-10-03')
    expect(unscheduleTask(done).date).toBe('2026-10-03')
    const returned = unscheduleTask(scheduled)
    expect(returned.date).toBeNull()
    expect(masterTasks([returned])).toHaveLength(1)
    const later = scheduleTask(scheduled, '2026-10-05')
    const moved = scheduleTask(later, '2026-10-07')
    expect(moved.id).toBe('dentist')
    expect(moved.date).toBe('2026-10-07')
    expect(moved.scheduleHistory.map((item) => item.to)).toEqual(['2026-10-03', '2026-10-05', '2026-10-07'])
    expect(goalProgress([moved], 'career').total).toBe(0)
    const linked = { ...moved, goalIds: ['career'] }
    expect(goalProgress([linked], 'career')).toEqual({ completed: 0, total: 1, percent: 0 })
  })

  it('records a move as an update of the same task', () => {
    const before = emptySnapshot()
    const after = emptySnapshot()
    const open = task({ id: 'call', content: 'Call insurance', date: null })
    before.entries = [open]
    after.entries = [scheduleTask(open, '2026-10-05')]
    const ops = diffSnapshots(before, after, [], '2026-10-01T00:00:00.000Z').filter((op) => op.kind === 'entry')
    expect(ops).toHaveLength(1)
    expect(ops[0]?.id).toBe('call')
    expect(ops[0]?.deletedAt).toBeNull()
  })

  it('finds a task whether or not it has a day', () => {
    const snapshot = emptySnapshot()
    snapshot.entries = [
      task({ id: 'a', content: 'Call insurance', date: null }),
      task({ id: 'b', content: 'Book dentist', date: '2026-10-03', taskStatus: 'complete' }),
    ]
    const hits = searchJournal(snapshot, {
      query: 'dentist',
      from: null,
      to: null,
      types: [],
      completed: false,
      migrated: false,
      starred: false,
      collectionId: null,
      goalId: null,
      tag: null,
    })
    expect(hits.map((hit) => hit.route)).toEqual(['/day/2026-10-03'])
    const master = searchJournal(snapshot, { ...hits[0], query: 'insurance', from: null, to: null, types: [], completed: false, migrated: false, starred: false, collectionId: null, goalId: null, tag: null })
    expect(master[0]?.route).toBe('/tasks')
  })
})

describe('habit tracker', () => {
  it('keeps a month’s checks, a later month’s selection, and the history after a pause', () => {
    const water = habit('water', 'Water')
    const read = habit('read', 'Read', { inactiveFrom: '2026-11-15' })
    let months = setMonthHabit([], 'water', 2026, 9, true)
    months = setMonthHabit(months, 'read', 2026, 9, true)
    months = setMonthHabit(months, 'water', 2026, 10, true)
    const september = monthHabits({ ...emptySnapshot(), habits: [water, read], habitMonths: months }, 2026, 9)
    const october = monthHabits({ ...emptySnapshot(), habits: [water, read], habitMonths: months }, 2026, 10)
    expect(september.map((item) => item.name).sort()).toEqual(['Read', 'Water'])
    expect(october.map((item) => item.name)).toEqual(['Water'])
    let logs = toggleHabitLog([], 'read', '2026-09-02', new Date('2026-09-02T00:00:00.000Z'))
    logs = toggleHabitLog(logs, 'read', '2026-09-02', new Date('2026-09-02T01:00:00.000Z'))
    expect(logs).toHaveLength(1)
    expect(habitChecked(logs, 'read', '2026-09-02')).toBe(false)
    logs = toggleHabitLog(logs, 'read', '2026-09-02')
    expect(habitChecked(logs, 'read', '2026-09-02')).toBe(true)
    const paused = { ...read, inactiveFrom: '2026-11-15' }
    const revived = { ...paused, inactiveFrom: null }
    expect(revived.id).toBe('read')
    expect(habitChecked(logs, revived.id, '2026-09-02')).toBe(true)
    const snapshot = emptySnapshot()
    snapshot.habitLogs = logs
    const queued = diffSnapshots(emptySnapshot(), snapshot, [], '2026-09-02T00:00:00.000Z')
    expect(queued.some((op) => op.kind === 'habitLog' && op.deletedAt === null)).toBe(true)
  })
})
