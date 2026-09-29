import { describe, expect, it } from 'vitest'
import { emptySnapshot, mergeSnapshots, migrateSnapshot } from './schema.ts'
import { makeEntry } from './entries.ts'

describe('import and storage migrations', () => {
  it('rejects a file from another app or a newer schema', () => {
    expect(migrateSnapshot({ app: 'other' }).ok).toBe(false)
    expect(migrateSnapshot({ app: 'my-bullet-journal', schemaVersion: 99 }).errors[0]).toMatch(/newer/)
  })

  it('migrates a versionless backup and keeps old bullet fields', () => {
    const result = migrateSnapshot({
      entries: [{ id: 'a', date: '2026-09-01', content: 'Old task', bullet: 'task', status: 'complete' }],
      goals: [{ id: 'g', title: 'Family', quarter: 4, year: 2026 }],
    })
    expect(result.ok).toBe(true)
    expect(result.warnings.some((warning) => warning.includes('older backup'))).toBe(true)
    expect(result.snapshot?.schemaVersion).toBe(2)
    expect(result.snapshot?.entries[0]).toMatchObject({ type: 'task', taskStatus: 'complete', content: 'Old task' })
    expect(result.summary.goals).toBe(1)
    expect(result.summary.from).toBe('2026-09-01')
  })

  it('skips broken entries without failing the whole file', () => {
    const result = migrateSnapshot({
      schemaVersion: 1,
      app: 'my-bullet-journal',
      entries: [{ content: 'no id' }, { id: 'ok', date: '2026-10-02', content: 'Kept', type: 'note' }],
    })
    expect(result.ok).toBe(true)
    expect(result.snapshot?.entries).toHaveLength(1)
    expect(result.warnings.length).toBeGreaterThan(0)
  })

  it('merges by id and keeps the newer entry', () => {
    const local = emptySnapshot()
    local.entries = [
      makeEntry({ id: 'same', date: '2026-09-01', content: 'Local', now: new Date('2026-09-01T00:00:00.000Z') }),
    ]
    local.entries[0]!.updatedAt = '2026-09-01T00:00:00.000Z'
    const incoming = emptySnapshot()
    incoming.entries = [
      makeEntry({ id: 'same', date: '2026-09-02', content: 'Incoming', now: new Date('2026-09-03T00:00:00.000Z') }),
      makeEntry({ id: 'new', date: '2026-09-04', content: 'Added', now: new Date('2026-09-04T00:00:00.000Z') }),
    ]
    incoming.entries[0]!.updatedAt = '2026-09-03T00:00:00.000Z'
    incoming.settings.theme = 'dark'
    const merged = mergeSnapshots(local, incoming)
    expect(merged.entries).toHaveLength(2)
    expect(merged.entries.find((entry) => entry.id === 'same')?.content).toBe('Incoming')
    expect(merged.settings.theme).toBe('system')
  })
})
