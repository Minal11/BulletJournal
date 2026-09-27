import { describe, expect, it } from 'vitest'
import { makeEntry } from './entries.ts'
import { applyMigrationAction, applyTaskStatus, cycleTaskStatus, tasksAwaitingMigration, undoMigration } from './migration.ts'

const now = new Date(2026, 8, 25, 21, 30, 0)

function task(date: string, content: string, id: string) {
  return makeEntry({ id, date, content, type: 'task', timestamp: '08:20', showTimestamp: true, now })
}

describe('task migration', () => {
  it('moves a daily task to tomorrow and keeps the link', () => {
    const original = task('2026-09-25', 'Research vacation flights', 'flights')
    const result = applyTaskStatus([original], [], 'flights', 'migrated', { now })
    const parent = result.entries.find((entry) => entry.id === 'flights')
    const child = result.entries.find((entry) => entry.migratedFromId === 'flights')
    expect(parent?.taskStatus).toBe('migrated')
    expect(parent?.migratedToId).toBe(child?.id)
    expect(child?.date).toBe('2026-09-26')
    expect(child?.taskStatus).toBe('open')
    expect(child?.content).toBe('Research vacation flights')
  })

  it('does not create a second copy when migrated twice', () => {
    const original = task('2026-09-25', 'Research vacation flights', 'flights')
    const once = applyTaskStatus([original], [], 'flights', 'migrated', { now })
    const twice = applyTaskStatus(once.entries, once.futureItems, 'flights', 'migrated', { now })
    expect(twice.entries.filter((entry) => entry.content === 'Research vacation flights')).toHaveLength(2)
  })

  it('removes an untouched tomorrow task when the migration is undone', () => {
    const original = task('2026-09-25', 'Research vacation flights', 'flights')
    const migrated = applyTaskStatus([original], [], 'flights', 'migrated', { now })
    const undone = undoMigration(migrated.entries, migrated.futureItems, 'flights', { now })
    expect(undone.entries).toHaveLength(1)
    expect(undone.entries[0]?.taskStatus).toBe('open')
    expect(undone.entries[0]?.migratedToId).toBeNull()
  })

  it('keeps a tomorrow task that has been edited', () => {
    const original = task('2026-09-25', 'Research vacation flights', 'flights')
    const migrated = applyTaskStatus([original], [], 'flights', 'migrated', { now })
    const edited = migrated.entries.map((entry) =>
      entry.migratedFromId === 'flights'
        ? { ...entry, content: 'Research vacation flights — morning', updatedAt: '2026-09-26T15:00:00.000Z' }
        : entry,
    )
    const completed = applyTaskStatus(edited, migrated.futureItems, 'flights', 'complete', { now })
    expect(completed.entries.some((entry) => entry.content.startsWith('Research vacation flights —'))).toBe(true)
    expect(completed.entries.find((entry) => entry.id === 'flights')?.taskStatus).toBe('complete')
  })

  it('schedules into the future log instead of copying into tomorrow', () => {
    const original = task('2026-09-25', 'Read AI article', 'read')
    const scheduled = applyTaskStatus([original], [], 'read', 'scheduled', { now })
    expect(scheduled.entries).toHaveLength(1)
    expect(scheduled.futureItems).toHaveLength(1)
    expect(scheduled.futureItems[0]).toMatchObject({ targetYear: 2026, targetMonth: 10, sourceEntryId: 'read' })
  })

  it('carries a task into next month without leaving an orphan', () => {
    const original = task('2026-10-05', 'Finish dashboard', 'dash')
    const moved = applyMigrationAction([original], [], 'dash', 'next_month', { now: new Date(2026, 9, 31, 18, 0, 0) })
    const child = moved.entries.find((entry) => entry.migratedFromId === 'dash')
    expect(child?.scope).toBe('month')
    expect(child?.date).toBe('2026-11-01')
    expect(moved.entries.find((entry) => entry.id === 'dash')?.taskStatus).toBe('migrated')
    const again = applyMigrationAction(moved.entries, moved.futureItems, 'dash', 'next_month', {
      now: new Date(2026, 9, 31, 18, 0, 0),
    })
    expect(again.entries.filter((entry) => entry.scope === 'month')).toHaveLength(1)
  })

  it('lets a task go without spawning anything', () => {
    const original = task('2026-10-02', 'Organize basement', 'base')
    const dropped = applyMigrationAction([original], [], 'base', 'let_go', { now })
    expect(dropped.entries).toHaveLength(1)
    expect(dropped.entries[0]?.taskStatus).toBe('cancelled')
    expect(dropped.futureItems).toHaveLength(0)
  })

  it('cycles open tasks through the bullet states', () => {
    const original = task('2026-09-25', 'Send work email', 'mail')
    const completed = cycleTaskStatus([original], [], 'mail', { now })
    expect(completed.entries.find((entry) => entry.id === 'mail')?.taskStatus).toBe('complete')
    const migrated = cycleTaskStatus(completed.entries, completed.futureItems, 'mail', { now })
    expect(migrated.entries.find((entry) => entry.id === 'mail')?.taskStatus).toBe('migrated')
  })

  it('lists only still-open tasks for monthly migration', () => {
    const open = task('2026-10-08', 'Check flight options', 'open')
    const done = makeEntry({ id: 'done', date: '2026-10-08', content: 'Done', type: 'task', taskStatus: 'complete', now })
    const november = task('2026-11-02', 'Later', 'later')
    expect(tasksAwaitingMigration([open, done, november], 2026, 10).map((entry) => entry.id)).toEqual(['open'])
  })
})
