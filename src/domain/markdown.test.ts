import { describe, expect, it } from 'vitest'
import { makeEntry } from './entries.ts'
import { monthToMarkdown } from './markdown.ts'
import { emptySnapshot } from './schema.ts'
import type { Collection, QuarterlyReview } from './types.ts'
import { collectionToMarkdown, reviewToMarkdown } from './markdown.ts'

describe('markdown export', () => {
  it('writes a month as a readable journal page', () => {
    const snapshot = emptySnapshot()
    snapshot.monthlyLogs.push({
      id: 'month-2026-10',
      year: 2026,
      month: 10,
      calendar: [{ id: 'c', day: 3, type: 'event', content: 'Pumpkin farm', signifiers: [] }],
      goalFocus: [{ id: 'f', goalId: 'family', text: '2 fall outings' }],
      reflectionId: null,
    })
    snapshot.goals.push({
      id: 'family',
      title: 'Family',
      category: 'Family',
      quarter: 4,
      year: 2026,
      goalText: 'Be present.',
      why: '',
      measures: [],
      nextActions: [],
      status: 'active',
      notes: '',
      startDate: null,
      relatedEntryIds: [],
      sortOrder: 0,
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
    })
    snapshot.entries.push(
      makeEntry({
        id: 't',
        date: '2026-10-01',
        content: 'Decide Hawaii trip structure',
        scope: 'month',
        type: 'task',
        now: new Date('2026-10-01T00:00:00.000Z'),
      }),
    )
    const markdown = monthToMarkdown(snapshot, 2026, 10)
    expect(markdown).toContain('# October 2026')
    expect(markdown).toContain('3 Sat  ○ Pumpkin farm')
    expect(markdown).toContain('• Decide Hawaii trip structure')
    expect(markdown).toContain('Family → 2 fall outings')
  })

  it('exports a collection and a review without scores', () => {
    const collection: Collection = {
      id: 'ideas',
      title: 'Ideas',
      description: 'Not every idea needs to become a project.',
      content: '',
      bullets: [
        { id: 'b', type: 'note', content: 'A quieter homepage', taskStatus: null, checked: false, signifiers: [], sortOrder: 0 },
      ],
      linkedEntryIds: [],
      tags: [],
      icon: 'bulb',
      archived: false,
      pinned: false,
      defaultBullet: 'note',
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    }
    expect(collectionToMarkdown(collection)).toContain('– A quieter homepage')
    const review: QuarterlyReview = {
      id: 'review-2026-q3',
      quarter: 3,
      year: 2026,
      goalReviews: [],
      proudOf: 'Slow Sundays',
      learned: 'Evenings are for people.',
      tooMuchEnergyOn: 'Late email',
      moreOf: 'Walks',
      lessOf: 'Tabs',
      continuingGoals: ['Family'],
      releasedGoals: [],
      updatedAt: '2026-09-30T00:00:00.000Z',
    }
    const text = reviewToMarkdown(emptySnapshot(), review)
    expect(text).toContain('I am proud of: Slow Sundays')
    expect(text).not.toMatch(/%/)
  })
})
