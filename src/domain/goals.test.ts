import { describe, expect, it } from 'vitest'
import { blankReflection, blankReview, goalsForMonth, goalsForQuarter, nextGoalStatus, syncReview } from './goals.ts'
import { makeEntry } from './entries.ts'
import type { Goal } from './types.ts'

function goal(partial: Partial<Goal> & Pick<Goal, 'id' | 'quarter'>): Goal {
  return {
    title: partial.title ?? 'Family',
    category: 'Family',
    year: partial.year ?? 2026,
    goalText: partial.goalText ?? 'Be more present.',
    why: '',
    measures: [],
    nextActions: [],
    status: partial.status ?? 'active',
    notes: '',
    startDate: null,
    relatedEntryIds: [],
    sortOrder: partial.sortOrder ?? 0,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...partial,
    id: partial.id,
    quarter: partial.quarter,
  }
}

describe('goals and quarters', () => {
  const goals = [
    goal({ id: 'q3', quarter: 3, title: 'Health' }),
    goal({ id: 'q4a', quarter: 4, title: 'Family', sortOrder: 1 }),
    goal({ id: 'q4b', quarter: 4, title: 'Travel', sortOrder: 0 }),
  ]

  it('filters goals by quarter and month', () => {
    expect(goalsForQuarter(goals, 2026, 4).map((item) => item.id)).toEqual(['q4b', 'q4a'])
    expect(goalsForMonth(goals, 2026, 10).map((item) => item.title)).toEqual(['Travel', 'Family'])
    expect(goalsForMonth(goals, 2026, 9)).toHaveLength(1)
  })

  it('cycles status without turning it into a score', () => {
    expect(nextGoalStatus('not_started')).toBe('active')
    expect(nextGoalStatus('dropped')).toBe('not_started')
  })

  it('builds a review shell from the quarter’s goals', () => {
    const review = blankReview(2026, 4, goals)
    expect(review.goalReviews.map((item) => item.goalId)).toEqual(['q4b', 'q4a'])
    expect(review.goalReviews[0]?.intended).toBe('Be more present.')
    const synced = syncReview(review, [...goals, goal({ id: 'q4c', quarter: 4, title: 'Money', sortOrder: 2, goalText: 'See the numbers.' })])
    expect(synced.goalReviews.map((item) => item.goalId)).toEqual(['q4b', 'q4a', 'q4c'])
  })

  it('gives each monthly reflection a check-in per goal', () => {
    const reflection = blankReflection(2026, 10, goals)
    expect(reflection.goalCheckIns.map((item) => item.goalId)).toEqual(['q4b', 'q4a'])
    expect(reflection.id).toBe('reflection-2026-10')
  })
})

describe('entry dates used by goals', () => {
  it('keeps a related daily task on its own date', () => {
    const entry = makeEntry({ date: '2026-10-05', content: 'Pick October outing', goalIds: ['q4a'], now: new Date(2026, 9, 5) })
    expect(entry.goalIds).toEqual(['q4a'])
    expect(entry.date).toBe('2026-10-05')
  })
})
