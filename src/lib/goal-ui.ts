const INTERACTIVE = new Set(['INPUT', 'BUTTON', 'SELECT', 'TEXTAREA', 'A', 'LABEL'])

/** A click on the goal header toggles it unless it landed on a control. */
export function goalHeaderShouldToggle(tagName: string): boolean {
  return !INTERACTIVE.has(tagName)
}

/** A long list starts folded. A short list can stay open. */
export function defaultGoalOpen(goalCount: number): boolean {
  return goalCount < 3
}
