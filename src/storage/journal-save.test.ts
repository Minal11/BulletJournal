import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { dayEntries, monthTasks } from '../domain/entries.ts'
import { diffSnapshots, shouldAttemptSync } from '../services/sync-diff.ts'
import { journal } from '../state/store.ts'
import { activateDatabase, deleteDatabase } from './db.ts'
import { loadJournal } from './repository.ts'

vi.mock('../lib/supabase.ts', () => ({
  isSupabaseConfigured: () => false,
  getSupabase: () => {
    throw new Error('Supabase is unavailable')
  },
  supabaseConfigError: () => 'Supabase is unavailable',
  authRedirect: () => 'http://127.0.0.1/auth/callback',
}))

const databases: string[] = []

async function useFreshDatabase(): Promise<void> {
  const name = `journal-test-${crypto.randomUUID()}`
  databases.push(name)
  await activateDatabase(name)
}

afterEach(async () => {
  await Promise.all(databases.splice(0).map((name) => deleteDatabase(name)))
})

const LONG_TASK = 'Research family-friendly Hawaii accommodations near a walkable beach and a quiet grocery store'

describe('local journal saves', () => {
  it('persists a today task and reloads it when Supabase is unavailable', async () => {
    await useFreshDatabase()
    const before = journal.getSnapshot().snapshot
    const entry = journal.addEntry({
      date: '2026-09-26',
      content: 'Call immigration attorney',
      type: 'task',
      scope: 'day',
      timestamp: '18:15',
      showTimestamp: true,
    })
    expect(entry?.content).toBe('Call immigration attorney')
    expect(entry?.type).toBe('task')
    await journal.flush()
    expect(journal.getSnapshot().error).toBeNull()

    const loaded = await loadJournal()
    const today = dayEntries(loaded?.entries ?? [], '2026-09-26', false)
    expect(today.map((item) => item.content)).toContain('Call immigration attorney')

    const queue = diffSnapshots(before, loaded ?? before, [], '2026-09-26T23:00:00.000Z')
    const saved = queue.find((op) => op.kind === 'entry' && op.id === entry?.id)
    expect(saved?.syncStatus).toBe('pending')
    expect(shouldAttemptSync(false)).toBe(false)
  })

  it('keeps monthly tasks that start with T, E, or N, including a long line', async () => {
    await useFreshDatabase()
    const lines = ['Take Ziva outside', 'Email doctor', 'Need groceries', LONG_TASK]
    for (const content of lines) {
      const entry = journal.addEntry({ date: '2026-09-01', content, type: 'task', scope: 'month' })
      expect(entry?.content).toBe(content)
    }
    await journal.flush()
    expect(journal.getSnapshot().error).toBeNull()

    const loaded = await loadJournal()
    const tasks = monthTasks(loaded?.entries ?? [], 2026, 9).map((item) => item.content)
    expect(tasks).toEqual(expect.arrayContaining(lines))
    expect(tasks.find((item) => item === LONG_TASK)?.length).toBeGreaterThan(80)
  })
})
