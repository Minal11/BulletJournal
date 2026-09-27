import { describe, expect, it } from 'vitest'
import { bareJournalPath, withDemoPrefix } from './demo-route.ts'

describe('demo routes', () => {
  it('leaves ordinary links alone', () => {
    expect(withDemoPrefix('/month/2026/9', '/goals/2026/3')).toBe('/goals/2026/3')
  })

  it('keeps the demo notebook when a section link is followed', () => {
    expect(withDemoPrefix('/demo', '/')).toBe('/demo')
    expect(withDemoPrefix('/demo/month/2026/9', '/collections/travel')).toBe('/demo/collections/travel')
    expect(bareJournalPath('/demo/goals/2026/3')).toBe('/goals/2026/3')
  })
})
