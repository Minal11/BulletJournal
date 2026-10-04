import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { goalProgress, tasksForGoal } from '../domain/goal-progress.ts'
import { blankGoal } from '../domain/goals.ts'
import { scheduleTask } from '../domain/tasks.ts'
import { draftAfterRefresh, persistGoalPatch } from '../lib/draft.ts'
import { textAfterTaskSave } from '../lib/entry-input.ts'
import { goalTaskComposerAction, goalTasksSurviveFold } from '../lib/goal-ui.ts'
import { composerKeyAction } from '../lib/keyboard.ts'
import { makeEntry } from '../domain/entries.ts'
import { diffSnapshots, shouldAttemptSync, snapshotAfterRemoteApply } from '../services/sync-diff.ts'
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
  const name = `journal-goal-task-${crypto.randomUUID()}`
  databases.push(name)
  await activateDatabase(name)
}

afterEach(async () => {
  await Promise.all(databases.splice(0).map((name) => deleteDatabase(name)))
})

async function careerGoal() {
  const draft = blankGoal(2026, 4, 0)
  draft.title = 'Career Growth'
  journal.insertGoal(draft)
  await journal.flush()
  return draft
}

describe('goal task saves', () => {
  it('creates a canonical task on an existing Goal and reloads it from IndexedDB', async () => {
    await useFreshDatabase()
    const goal = await careerGoal()
    const created = journal.addGoalTask(goal.id, 'Practice system design')
    expect(created?.id).toBeTruthy()
    expect(created?.content).toBe('Practice system design')
    expect(created?.goalIds).toEqual([goal.id])
    expect(created?.date).toBeNull()
    expect(created?.taskStatus).toBe('open')
    expect(journal.getSnapshot().snapshot.goals.find((item) => item.id === goal.id)?.nextActions).toEqual([])
    await journal.flush()
    expect(journal.getSnapshot().error).toBeNull()

    const loaded = await loadJournal()
    const saved = loaded?.entries.find((entry) => entry.id === created?.id)
    expect(saved?.content).toBe('Practice system design')
    expect(saved?.type).toBe('task')
    expect(saved?.goalIds).toEqual([goal.id])
    expect(saved?.date).toBeNull()
    expect(saved?.taskStatus).toBe('open')
    expect(tasksForGoal(loaded?.entries ?? [], goal.id).map((entry) => entry.id)).toEqual([created?.id])
  })

  it('keeps the three Career Growth tasks after a refresh, a fold, and a remount', async () => {
    await useFreshDatabase()
    const goal = await careerGoal()
    for (const content of ['Update resume', 'Practice system design', 'Complete AI coding exercise']) {
      expect(journal.addGoalTask(goal.id, content)?.content).toBe(content)
    }
    await journal.flush()

    const loaded = await loadJournal()
    const afterRefresh = tasksForGoal(loaded?.entries ?? [], goal.id).map((entry) => entry.content)
    expect(afterRefresh).toEqual(['Update resume', 'Practice system design', 'Complete AI coding exercise'])

    const folded = goalTasksSurviveFold(tasksForGoal(loaded?.entries ?? [], goal.id), false)
    const opened = goalTasksSurviveFold(folded, true)
    expect(opened.map((entry) => entry.content)).toEqual(afterRefresh)

    const afterNav = journal.getSnapshot().snapshot.entries
    expect(tasksForGoal(afterNav, goal.id).map((entry) => entry.content)).toEqual(afterRefresh)
  })

  it('keeps a locally saved Goal task when Supabase is down', async () => {
    await useFreshDatabase()
    const goal = await careerGoal()
    const before = journal.getSnapshot().snapshot
    const created = journal.addGoalTask(goal.id, 'Practice Spring')
    await journal.flush()
    expect(journal.getSnapshot().error).toBeNull()
    expect(shouldAttemptSync(false)).toBe(false)

    const loaded = await loadJournal()
    expect(loaded?.entries.find((entry) => entry.id === created?.id)?.content).toBe('Practice Spring')
    const queue = diffSnapshots(before, loaded ?? before, [], '2026-10-04T18:00:00.000Z')
    const saved = queue.find((op) => op.kind === 'entry' && op.id === created?.id)
    expect(saved?.syncStatus).toBe('pending')
    expect(tasksForGoal(loaded?.entries ?? [], goal.id)).toHaveLength(1)
  })

  it('increases Goal progress when a task is added and when it is completed', async () => {
    await useFreshDatabase()
    const goal = await careerGoal()
    journal.addGoalTask(goal.id, 'Update resume')
    journal.addGoalTask(goal.id, 'Practice Spring')
    const resume = journal.getSnapshot().snapshot.entries.find((entry) => entry.content === 'Update resume' && entry.goalIds.includes(goal.id))
    journal.setEntryStatus(resume?.id ?? '', 'complete')
    expect(goalProgress(journal.getSnapshot().snapshot.entries, goal.id)).toEqual({ completed: 1, total: 2, percent: 50 })

    journal.addGoalTask(goal.id, 'Practice system design')
    expect(goalProgress(journal.getSnapshot().snapshot.entries, goal.id)).toEqual({ completed: 1, total: 3, percent: 33 })

    const design = journal.getSnapshot().snapshot.entries.find((entry) => entry.content === 'Practice system design' && entry.goalIds.includes(goal.id))
    journal.setEntryStatus(design?.id ?? '', 'complete')
    await journal.flush()
    const loaded = await loadJournal()
    expect(goalProgress(loaded?.entries ?? [], goal.id)).toEqual({ completed: 2, total: 3, percent: 67 })
    expect(loaded?.entries.find((entry) => entry.id === design?.id)?.taskStatus).toBe('complete')
  })

  it('persists an edited Goal task and schedules the same record onto a day', async () => {
    await useFreshDatabase()
    const goal = await careerGoal()
    const created = journal.addGoalTask(goal.id, 'Practice system design')
    expect(created?.id).toBeTruthy()
    journal.updateEntry(created?.id ?? '', { content: 'Practice system design daily' })
    await journal.flush()
    const edited = (await loadJournal())?.entries.find((entry) => entry.id === created?.id)
    expect(edited?.content).toBe('Practice system design daily')
    expect(edited?.goalIds).toEqual([goal.id])

    journal.scheduleEntry(created?.id ?? '', '2026-10-06')
    await journal.flush()
    const scheduled = (await loadJournal())?.entries.find((entry) => entry.id === created?.id)
    expect(scheduled?.id).toBe(created?.id)
    expect(scheduled?.date).toBe('2026-10-06')
    expect(scheduled?.goalIds).toEqual([goal.id])
    expect(goalProgress(journal.getSnapshot().snapshot.entries, goal.id).total).toBe(1)
    const movedAgain = scheduleTask(scheduled!, '2026-10-06')
    expect(movedAgain.id).toBe(created?.id)
  })

  it('keeps a Goal task saved during a cloud pull, and still applies other remote rows', async () => {
    await useFreshDatabase()
    const goal = await careerGoal()
    const created = journal.addGoalTask(goal.id, 'Practice system design')
    await journal.flush()
    const latest = journal.getSnapshot().snapshot
    const remoteGoal = {
      kind: 'goal' as const,
      id: goal.id,
      updatedAt: '2026-10-04T18:30:00.000Z',
      deletedAt: null,
      payload: { ...goal, title: 'Career Growth', nextActions: ['Update resume'] },
    }
    const unrelated = makeEntry({ date: '2026-10-01', content: 'Morning note', type: 'note' })
    const duringPull = { ...latest, entries: [...latest.entries, unrelated] }
    const pulled = snapshotAfterRemoteApply(duringPull, [
      remoteGoal,
      {
        kind: 'entry',
        id: unrelated.id,
        updatedAt: '2026-10-04T18:30:00.000Z',
        deletedAt: '2026-10-04T18:30:00.000Z',
        payload: unrelated,
      },
    ])
    const saved = pulled.entries.find((entry) => entry.id === created?.id)
    expect(saved?.content).toBe('Practice system design')
    expect(saved?.goalIds).toEqual([goal.id])
    expect(saved?.date).toBeNull()
    expect(pulled.entries.find((entry) => entry.id === unrelated.id)).toBeUndefined()
    expect(pulled.goals.find((item) => item.id === goal.id)?.title).toBe('Career Growth')
    expect(goalProgress(pulled.entries, goal.id)).toEqual({ completed: 0, total: 1, percent: 0 })

    journal.updateGoal(goal.id, persistGoalPatch({ ...goal, title: 'Career Growth', nextActions: ['Practice system design'] }))
    await journal.flush()
    const reloaded = await loadJournal()
    expect(reloaded?.entries.filter((entry) => entry.goalIds.includes(goal.id)).map((entry) => entry.id)).toEqual([created?.id])
  })

  it('does not let a store refresh replace a dirty Goal draft or drop newly saved tasks', async () => {
    await useFreshDatabase()
    const goal = await careerGoal()
    const created = journal.addGoalTask(goal.id, 'Update resume')
    await journal.flush()
    const saved = journal.getSnapshot().snapshot.goals.find((item) => item.id === goal.id)!
    const dirty = { ...saved, title: 'Career Growth, revised' }
    const incoming = { ...saved, relatedEntryIds: [created?.id ?? ''], updatedAt: '2026-10-04T18:00:00.000Z' }
    const next = draftAfterRefresh({ id: saved.id, draft: dirty, dirty: true }, { id: incoming.id, source: incoming })
    expect(next.draft.title).toBe('Career Growth, revised')
    expect(persistGoalPatch(dirty).nextActions).toEqual([])
    expect(tasksForGoal(journal.getSnapshot().snapshot.entries, saved.id).map((entry) => entry.content)).toEqual(['Update resume'])
  })

  it('leaves typed Goal-task text in place when the local save did not finish', () => {
    expect(textAfterTaskSave(false, 'Practice system design')).toEqual({
      text: 'Practice system design',
      message: "Couldn't save this task locally. Your text is still here.",
    })
    expect(textAfterTaskSave(true, 'Practice system design')).toEqual({ text: '', message: null })
  })

  it('adds on Enter, clears on Escape, and ignores Shift+Enter and T/E/N while typing', () => {
    const target = { tagName: 'INPUT', type: 'text' }
    expect(goalTaskComposerAction(composerKeyAction({ key: 'Enter', target }))).toBe('save')
    expect(goalTaskComposerAction(composerKeyAction({ key: 'Escape', target }))).toBe('cancel')
    expect(goalTaskComposerAction(composerKeyAction({ key: 'Enter', shiftKey: true, target }))).toBe('ignore')
    for (const key of ['t', 'e', 'n', 'T', 'E', 'N']) {
      expect(goalTaskComposerAction(composerKeyAction({ key, target }))).toBe('ignore')
    }
  })
})
