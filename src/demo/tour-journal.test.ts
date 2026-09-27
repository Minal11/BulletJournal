import { describe, expect, it } from 'vitest'
import { buildTourJournal } from './tour-journal.ts'

describe('demo tour journal', () => {
  it('uses fictional sample pages and no personal details', () => {
    const journal = buildTourJournal(new Date(2026, 8, 27, 15, 0, 0))
    expect(journal.goals.map((goal) => goal.title)).toEqual(['Family', 'Health', 'Career', 'Travel'])
    expect(journal.collections.map((collection) => collection.title)).toEqual(['Travel Plans', 'Family Memories', 'Ideas'])
    expect(journal.monthlyLogs[0]?.goalFocus[0]?.text).toBe('Complete 8 focused learning sessions')
    const text = JSON.stringify(journal)
    expect(text).not.toMatch(/@|Ziva|Hawaii|Moneyverse/)
  })
})