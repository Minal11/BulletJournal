import { describe, expect, it } from 'vitest'
import { JOURNAL_RESUME_THRESHOLD_MS, nextOpeningPhase, shouldReplayOpening } from './journal-opening.ts'

describe('journal opening', () => {
  it('uses a 20 second background threshold', () => {
    expect(JOURNAL_RESUME_THRESHOLD_MS).toBe(20_000)
  })

  it('replays only after the journal has been away long enough', () => {
    expect(shouldReplayOpening(null, 30_000)).toBe(false)
    expect(shouldReplayOpening(1_000, 6_000)).toBe(false)
    expect(shouldReplayOpening(1_000, 21_000)).toBe(true)
    expect(shouldReplayOpening(1_000, 31_000)).toBe(true)
  })

  it('opens on its own, and a tap finishes sooner', () => {
    expect(nextOpeningPhase('closed', 'hold-done', false)).toBe('opening')
    expect(nextOpeningPhase('opening', 'flip-done', false)).toBe('complete')
    expect(nextOpeningPhase('closed', 'tap', false)).toBe('closed')
    expect(nextOpeningPhase('closed', 'tap', true)).toBe('opening')
    expect(nextOpeningPhase('opening', 'tap', true)).toBe('complete')
    expect(nextOpeningPhase('complete', 'tap', true)).toBe('complete')
  })

  it('starts the cover again when the app returns from a long pause', () => {
    expect(nextOpeningPhase('complete', 'resume', false)).toBe('closed')
    expect(nextOpeningPhase('opening', 'hold-done', false)).toBe('opening')
  })
})
