import type { ComposerKeyAction } from './keyboard.ts'

const INTERACTIVE = new Set(['INPUT', 'BUTTON', 'SELECT', 'TEXTAREA', 'A', 'LABEL'])

/** A click on the goal header toggles it unless it landed on a control. */
export function goalHeaderShouldToggle(tagName: string): boolean {
  return !INTERACTIVE.has(tagName)
}

/** A long list starts folded. A short list can stay open. */
export function defaultGoalOpen(goalCount: number): boolean {
  return goalCount < 3
}

/** Collapse/expand only hides the fold. Tasks still come from canonical records. */
export function goalTasksSurviveFold<T>(tasks: T[], _open: boolean): T[] {
  return tasks
}

/** Single-line Goal task input: Enter adds, Escape clears, Shift+Enter stays put. */
export function goalTaskComposerAction(action: ComposerKeyAction): 'save' | 'cancel' | 'ignore' {
  if (action === 'save') return 'save'
  if (action === 'cancel') return 'cancel'
  return 'ignore'
}
