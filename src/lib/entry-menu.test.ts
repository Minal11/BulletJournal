import { describe, expect, it } from 'vitest'
import { claimEntryMenu, entryMenuOwner, menuOnScroll, placeEntryMenu, releaseEntryMenu } from './entry-menu.ts'

describe('entry menu', () => {
  it('opens under the button and stays inside the phone viewport', () => {
    const box = placeEntryMenu({ top: 180, bottom: 212, left: 300, right: 332 }, 240, {
      width: 390,
      height: 844,
      safeBottom: 28,
      topInset: 48,
    })
    expect(box.top).toBeGreaterThanOrEqual(212)
    expect(box.left).toBeGreaterThanOrEqual(8)
    expect(box.left + box.width).toBeLessThanOrEqual(382)
    expect(box.top + box.maxHeight).toBeLessThanOrEqual(844 - 28)
    expect(box.top).toBeLessThan(700)
  })

  it('flips above the button when the lower edge is too close', () => {
    const box = placeEntryMenu({ top: 760, bottom: 792, left: 310, right: 348 }, 320, {
      width: 390,
      height: 844,
      safeBottom: 34,
    })
    expect(box.top).toBeLessThan(760)
    expect(box.top).toBeGreaterThanOrEqual(8)
  })

  it('closes once the entry scrolls out of the page, and keeps a single open menu', () => {
    expect(menuOnScroll(900, 940, 0, 844)).toBe('close')
    expect(menuOnScroll(120, 160, 0, 844)).toBe('place')
    claimEntryMenu('entry-a')
    claimEntryMenu('entry-b')
    expect(entryMenuOwner()).toBe('entry-b')
    releaseEntryMenu('entry-b')
    expect(entryMenuOwner()).toBeNull()
  })
})