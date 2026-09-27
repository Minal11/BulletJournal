import { describe, expect, it } from 'vitest'
import { canBeginPull, finishPull, pullCue, resistedPull } from './pull-sync.ts'

describe('pull to sync', () => {
  it('starts only for a downward touch at the top, away from typing and controls', () => {
    expect(canBeginPull({ pointer: 'touch', scrollTop: 0, editable: false, interactive: false })).toBe(true)
    expect(canBeginPull({ pointer: 'touch', scrollTop: 12, editable: false, interactive: false })).toBe(false)
    expect(canBeginPull({ pointer: 'mouse', scrollTop: 0, editable: false, interactive: false })).toBe(false)
    expect(canBeginPull({ pointer: 'touch', scrollTop: 0, editable: true, interactive: false })).toBe(false)
    expect(canBeginPull({ pointer: 'touch', scrollTop: 0, editable: false, interactive: true })).toBe(false)
  })

  it('resists the pull and asks to release only past the threshold', () => {
    expect(resistedPull(40)).toBeLessThan(40)
    expect(resistedPull(160)).toBeLessThan(160)
    expect(pullCue(20)).toBe('idle')
    expect(pullCue(40)).toBe('pull')
    expect(pullCue(80)).toBe('ready')
  })

  it('runs sync once per gesture and does nothing on a short pull', () => {
    expect(finishPull(80, false)).toBe('sync')
    expect(finishPull(80, true)).toBe('cancel')
    expect(finishPull(20, false)).toBe('cancel')
  })
})
