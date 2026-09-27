import { describe, expect, it } from 'vitest'
import { canOpenJournal, routeForGuest, shouldConfirmSignOut } from './sign-out.ts'

describe('sign out', () => {
  it('returns a signed-out person to the login screen and closes journal routes', () => {
    expect(canOpenJournal('user-a')).toBe(true)
    expect(canOpenJournal(null)).toBe(false)
    expect(routeForGuest('/')).toBe('/sign-in')
    expect(routeForGuest('/settings')).toBe('/sign-in')
    expect(routeForGuest('/day/2026-09-26')).toBe('/sign-in')
    expect(routeForGuest('/sign-in')).toBe('/sign-in')
  })

  it('warns when offline changes have not synced, and allows a clean sign out', () => {
    expect(shouldConfirmSignOut(false, 2, false)).toBe(true)
    expect(shouldConfirmSignOut(true, 1, true)).toBe(true)
    expect(shouldConfirmSignOut(false, 0, false)).toBe(false)
    expect(shouldConfirmSignOut(true, 0, false)).toBe(false)
  })
})
