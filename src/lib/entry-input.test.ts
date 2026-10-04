import { describe, expect, it } from 'vitest'
import { entryKindOf, parseEntryInput, storedEntry, textAfterSave, textAfterTaskSave } from './entry-input.ts'
import { COLLECTION_ICON_LABEL, COLLECTION_ICONS, collectionIconChoice } from './collection-icons.ts'
import { draftAfterRefresh, editGoalDraft, persistGoalPatch, type GoalDraftFields } from './draft.ts'

describe('entry kinds', () => {
  it('selects a kind from a command and does not treat the command as content', () => {
    expect(parseEntryInput('/task', 'note')).toEqual({ kind: 'task', content: '', commandOnly: true })
    expect(parseEntryInput('/event', 'task')).toEqual({ kind: 'event', content: '', commandOnly: true })
    expect(parseEntryInput('/note', 'task')).toEqual({ kind: 'note', content: '', commandOnly: true })
    expect(parseEntryInput('/memory', 'task')).toEqual({ kind: 'memory', content: '', commandOnly: true })
  })

  it('keeps the words after a slash command', () => {
    expect(parseEntryInput('/event Dinner', 'task')).toEqual({ kind: 'event', content: 'Dinner', commandOnly: false })
    expect(parseEntryInput('/task Buy milk', 'note')).toEqual({ kind: 'task', content: 'Buy milk', commandOnly: false })
    expect(parseEntryInput('Call dentist', 'task')).toEqual({ kind: 'task', content: 'Call dentist', commandOnly: false })
  })

  it('stores memory as an important event with a memory tag', () => {
    expect(storedEntry('memory')).toEqual({ type: 'event', signifiers: ['important'], memory: true })
    expect(storedEntry('note')).toEqual({ type: 'note', signifiers: [], memory: false })
    expect(entryKindOf({ type: 'event', tags: ['memory'] })).toBe('memory')
    expect(entryKindOf({ type: 'event', tags: [] })).toBe('event')
  })

  it('leaves the typed line in place when the local save fails', () => {
    expect(textAfterSave(false, '/event Dinner')).toEqual({
      text: '/event Dinner',
      message: "Couldn't save this entry locally. Your text is still here.",
    })
    expect(textAfterSave(true, 'Dinner').message).toBeNull()
    expect(textAfterTaskSave(false, 'Practice system design')).toEqual({
      text: 'Practice system design',
      message: "Couldn't save this task locally. Your text is still here.",
    })
  })
})

describe('drafts survive a refresh', () => {
  const source = { title: 'Saved', description: '' }

  it('does not replace a dirty collection or goal draft when the same record refreshes', () => {
    const dirty = { id: 'c1', draft: { title: 'Hawaii Trip', description: 'Ideas' }, dirty: true }
    expect(draftAfterRefresh(dirty, { id: 'c1', source })).toEqual(dirty)
  })

  it('opens a different record from its saved copy', () => {
    const current = { id: 'c1', draft: source, dirty: false }
    expect(draftAfterRefresh(current, { id: 'c2', source: { title: 'Other', description: '' } }).id).toBe('c2')
  })
})

describe('collection icons', () => {
  it('selects the clicked icon and gives each one its own name', () => {
    expect(COLLECTION_ICONS).toHaveLength(10)
    for (const icon of COLLECTION_ICONS) {
      expect(collectionIconChoice(icon)).toBe(icon)
      expect(COLLECTION_ICON_LABEL[icon].length).toBeGreaterThan(0)
    }
    expect(collectionIconChoice(COLLECTION_ICONS[0]!)).not.toBe(COLLECTION_ICONS[COLLECTION_ICONS.length - 1])
    expect(new Set(Object.values(COLLECTION_ICON_LABEL)).size).toBe(COLLECTION_ICONS.length)
  })
})

describe('goal draft', () => {
  const blank: GoalDraftFields = {
    title: '',
    category: '',
    goalText: '',
    why: '',
    measures: [''],
    nextActions: [''],
    status: 'not_started',
    notes: '',
    startDate: null,
  }

  it('keeps earlier fields when later fields change', () => {
    const titled = editGoalDraft(blank, { type: 'title', value: 'Career Growth' })
    const withWhy = editGoalDraft({ ...titled, goalText: 'Backend' }, { type: 'why', value: 'Next role' })
    expect(withWhy.title).toBe('Career Growth')
    expect(withWhy.goalText).toBe('Backend')
    const withMeasure = editGoalDraft(withWhy, { type: 'measure', index: 0, value: '8 sessions' })
    const withAction = editGoalDraft(withMeasure, { type: 'action', index: 0, value: 'Study Spring Boot' })
    const withStatus = editGoalDraft(withAction, { type: 'status', value: 'in_progress' })
    expect(withStatus.why).toBe('Next role')
    expect(withStatus.measures).toEqual(['8 sessions'])
    expect(withStatus.nextActions).toEqual(['Study Spring Boot'])
    expect(withStatus.title).toBe('Career Growth')
  })

  it('does not write nextActions from a persist Goal draft after a store refresh', () => {
    const draft = { ...blank, title: 'Career Growth, revised', nextActions: ['stale string'] }
    const next = draftAfterRefresh({ id: 'career', draft, dirty: true }, { id: 'career', source: blank })
    expect(next.draft.title).toBe('Career Growth, revised')
    expect(persistGoalPatch(next.draft).nextActions).toEqual([])
  })
})
