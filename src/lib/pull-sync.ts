export const PULL_CUE = 30
export const PULL_READY = 70

export function resistedPull(rawY: number): number {
  if (rawY <= 0) return 0
  const head = Math.min(rawY, 30) * 0.8
  const mid = Math.min(Math.max(rawY - 30, 0), 50) * 0.55
  const tail = Math.max(rawY - 80, 0) * 0.22
  return Math.min(108, head + mid + tail)
}

export function pullCue(distance: number): 'idle' | 'pull' | 'ready' {
  if (distance < PULL_CUE) return 'idle'
  if (distance < PULL_READY) return 'pull'
  return 'ready'
}

export function canBeginPull(input: { pointer: string; scrollTop: number; editable: boolean; interactive: boolean }): boolean {
  if (input.pointer !== 'touch') return false
  if (input.scrollTop > 0) return false
  if (input.editable || input.interactive) return false
  return true
}

/** One gesture releases into a single sync. A later gesture can sync again. */
export function finishPull(distance: number, alreadyRan: boolean): 'sync' | 'cancel' {
  if (alreadyRan) return 'cancel'
  return distance >= PULL_READY ? 'sync' : 'cancel'
}
