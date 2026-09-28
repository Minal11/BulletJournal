export type OpeningPhase = 'closed' | 'opening' | 'complete'

/** Replay the cover only after the app has been hidden at least this long. */
export const JOURNAL_RESUME_THRESHOLD_MS = 20_000

/** Closed cover, then the flip. Together these stay near 2.4s. CSS durations must match. */
export const OPENING_HOLD_MS = 1_600
export const OPENING_FLIP_MS = 800
export const OPENING_TAP_DELAY_MS = 500
export const REDUCED_HOLD_MS = 500
export const REDUCED_FADE_MS = 400

export function shouldReplayOpening(
  lastHiddenAt: number | null,
  now: number,
  threshold = JOURNAL_RESUME_THRESHOLD_MS,
): boolean {
  if (lastHiddenAt == null) return false
  return now - lastHiddenAt >= threshold
}

export function nextOpeningPhase(phase: OpeningPhase, event: 'hold-done' | 'flip-done' | 'tap' | 'resume', canTap: boolean): OpeningPhase {
  if (event === 'resume') return 'closed'
  if (event === 'tap') {
    if (!canTap || phase === 'complete') return phase
    return phase === 'closed' ? 'opening' : 'complete'
  }
  if (event === 'hold-done' && phase === 'closed') return 'opening'
  if (event === 'flip-done' && phase === 'opening') return 'complete'
  return phase
}
