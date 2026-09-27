import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { dayEntries, makeEntry, monthTasks } from '../domain/entries.ts'
import { blankGoal } from '../domain/goals.ts'
import { emptySnapshot } from '../domain/schema.ts'
import { databaseName, diffSnapshots, shouldAttemptSync } from '../services/sync-diff.ts'
import { journal } from '../state/store.ts'
import { activateDatabase, deleteDatabase } from './db.ts'
import { loadJournal, saveJournal } from './repository.ts'

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

  it('clears the open journal on sign out so the next account cannot read it', async () => {
    const first = databaseName('user-a')
    const second = databaseName('user-b')
    databases.push(first, second)
    await activateDatabase(first)
    const secret = makeEntry({ date: '2026-09-26', content: 'Private line for A', type: 'note' })
    await saveJournal({ ...emptySnapshot(), entries: [secret] })
    journal.addEntry({ date: '2026-09-26', content: 'Private line for A', type: 'note', scope: 'day' })
    await journal.closeSession()
    expect(journal.getSnapshot().ready).toBe(false)
    expect(journal.getSnapshot().snapshot.entries).toEqual([])

    await activateDatabase(second)
    expect((await loadJournal())?.entries ?? []).toEqual([])

    await activateDatabase(first)
    expect((await loadJournal())?.entries.map((entry) => entry.content)).toContain('Private line for A')
  })

  it('does not keep a slash command that only chooses a kind', async () => {
    await useFreshDatabase()
    const before = journal.getSnapshot().snapshot.entries.length
    expect(journal.addEntry({ date: '2026-09-27', content: '/memory', type: 'task', scope: 'day' })).toBeNull()
    expect(journal.addEntry({ date: '2026-09-27', content: '/task', type: 'note', scope: 'day' })).toBeNull()
    expect(journal.addEntry({ date: '2026-09-27', content: '/event', type: 'task', scope: 'month' })).toBeNull()
    expect(journal.addEntry({ date: '2026-09-27', content: '/note', type: 'task', scope: 'month' })).toBeNull()
    expect(journal.getSnapshot().snapshot.entries.length).toBe(before)
    const dinner = journal.addEntry({ date: '2026-09-27', content: '/event Dinner with friends', type: 'task', scope: 'day' })
    expect(dinner?.type).toBe('event')
    expect(dinner?.content).toBe('Dinner with friends')
    expect(dinner?.tags ?? []).not.toContain('memory')
  })

  it('saves a memory and still succeeds locally when Supabase is down', async () => {
    await useFreshDatabase()
    const entry = journal.addEntry({
      date: '2026-09-27',
      content: 'Ziva did something funny today',
      type: 'event',
      scope: 'day',
      signifiers: ['important'],
      tags: ['memory'],
    })
    await journal.flush()
    expect(journal.getSnapshot().error).toBeNull()
    const loaded = await loadJournal()
    const saved = loaded?.entries.find((item) => item.id === entry?.id)
    expect(saved?.content).toBe('Ziva did something funny today')
    expect(saved?.tags).toContain('memory')
    expect(saved?.type).toBe('event')
  })

  it('saves a monthly focus with or without a linked goal and reloads it', async () => {
    await useFreshDatabase()
    journal.addFocus(2026, 9, { goalId: '', title: 'Family', text: 'Two family outings' })
    journal.addFocus(2026, 9, { goalId: 'goal-career', title: '', text: 'Complete 8 AI coding sessions' })
    await journal.flush()
    const loaded = await loadJournal()
    const log = loaded?.monthlyLogs.find((item) => item.year === 2026 && item.month === 9)
    expect(log?.goalFocus.map((item) => item.text)).toEqual(['Two family outings', 'Complete 8 AI coding sessions'])
    expect(log?.goalFocus[0]?.goalId).toBe('')
    expect(log?.goalFocus[0]?.title).toBe('Family')
    journal.updateFocus(2026, 9, log?.goalFocus[0]?.id ?? '', { text: 'Three family outings' })
    await journal.flush()
    const again = await loadJournal()
    expect(again?.monthlyLogs.find((item) => item.month === 9)?.goalFocus[0]?.text).toBe('Three family outings')
  })

  it('saves a collection icon and the default new-line kind', async () => {
    await useFreshDatabase()
    const id = journal.addCollection('Hawaii Trip')
    expect(id).toBeTruthy()
    journal.updateCollection(id ?? '', { description: 'Ideas and plans for December.', icon: 'plane', defaultBullet: 'note' })
    await journal.flush()
    const loaded = await loadJournal()
    const collection = loaded?.collections.find((item) => item.id === id)
    expect(collection?.title).toBe('Hawaii Trip')
    expect(collection?.description).toBe('Ideas and plans for December.')
    expect(collection?.icon).toBe('plane')
    expect(collection?.defaultBullet).toBe('note')
  })

  it('saves a new goal without writing it until insert, then reloads it', async () => {
    await useFreshDatabase()
    const draft = blankGoal(2026, 4, 0)
    draft.title = 'Career Growth'
    draft.goalText = 'Become stronger in backend architecture.'
    draft.why = 'Prepare for my next role.'
    draft.measures = ['8 AI coding sessions']
    draft.nextActions = ['Study Spring Boot architecture.']
    expect(journal.getSnapshot().snapshot.goals.find((goal) => goal.id === draft.id)).toBeUndefined()
    journal.insertGoal(draft)
    await journal.flush()
    expect(journal.getSnapshot().error).toBeNull()
    const loaded = await loadJournal()
    const goal = loaded?.goals.find((item) => item.id === draft.id)
    expect(goal?.title).toBe('Career Growth')
    expect(goal?.why).toBe('Prepare for my next role.')
    expect(goal?.measures).toEqual(['8 AI coding sessions'])
    expect(goal?.nextActions).toEqual(['Study Spring Boot architecture.'])
  })
})
