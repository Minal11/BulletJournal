/** Journal pages stay closed until someone is signed in. */
export function routeForGuest(path: string): string {
  if (path === '/sign-in' || path === '/reset-password') return path
  return '/sign-in'
}

export function canOpenJournal(userId: string | null | undefined): boolean {
  return Boolean(userId)
}

/**
 * Unsynced lines stay on the device. Ask before signing out when they have
 * not reached the cloud, including when the device is offline.
 */
export function shouldConfirmSignOut(online: boolean, pending: number, syncFailed: boolean): boolean {
  if (pending <= 0) return false
  return !online || syncFailed
}
