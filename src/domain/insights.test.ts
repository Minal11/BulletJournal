import { describe, expect, it } from 'vitest'
import { makeEntry } from './entries.ts'
import { journalPatterns } from './insights.ts'

const now = new Date(2026, 8, 20, 9, 0, 0)

describe('journal patterns', () => {
  it('stays quiet when there is too little to notice', () => {
    const entries = [
      makeEntry({ date: '2026-09-20', content: 'One', timestamp: '09:00', type: 'task', taskStatus: 'complete', now }),
    ]
    expect(journalPatterns(entries)).toEqual([])
  })

  it('notices clusters, late migrations, and evening stars', () => {
    const completed = ['09:10', '09:40', '10:15', '11:00'].map((timestamp, index) =>
      makeEntry({
        id: `done-${index}`,
        date: '2026-09-20',
        content: `Deep work ${index}`,
        timestamp,
        showTimestamp: true,
        type: 'task',
        taskStatus: 'complete',
        now,
      }),
    )
    const migrated = ['20:10', '21:30', '08:00'].map((timestamp, index) =>
      makeEntry({
        id: `mig-${index}`,
        date: '2026-09-18',
        content: `Left for later ${index}`,
        timestamp,
        showTimestamp: true,
        type: 'task',
        taskStatus: 'migrated',
        now,
      }),
    )
    const stars = ['18:10', '19:00'].map((timestamp, index) =>
      makeEntry({
        id: `star-${index}`,
        date: '2026-09-19',
        content: 'Family walk',
        timestamp,
        showTimestamp: true,
        type: 'event',
        signifiers: ['important'],
        now,
      }),
    )
    const lines = journalPatterns([...completed, ...migrated, ...stars])
    expect(lines.some((line) => line.startsWith('Completed tasks clustered'))).toBe(true)
    expect(lines).toContain('Most migrated tasks were originally logged after 8 PM.')
    expect(lines).toContain('Starred moments were logged most often in the evening.')
  })
})
