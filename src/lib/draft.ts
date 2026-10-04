/** A store refresh must not replace the draft of the record that is already open. */
export function draftAfterRefresh<T>(current: { id: string; draft: T; dirty: boolean }, incoming: { id: string; source: T }): { id: string; draft: T; dirty: boolean } {
  if (incoming.id !== current.id) return { id: incoming.id, draft: incoming.source, dirty: false }
  return current
}

/** Persist Goal editors never write nextActions; those strings are only a create-form convenience. */
export function persistGoalPatch<T extends { nextActions?: string[] }>(draft: T): T {
  return { ...draft, nextActions: [] }
}

export interface GoalDraftFields {
  title: string
  category: string
  goalText: string
  why: string
  measures: string[]
  nextActions: string[]
  status: string
  notes: string
  startDate: string | null
}

export type GoalDraftAction =
  | { type: 'title'; value: string }
  | { type: 'why'; value: string }
  | { type: 'goal'; value: string }
  | { type: 'notes'; value: string }
  | { type: 'status'; value: string }
  | { type: 'measure'; index: number; value: string }
  | { type: 'add-measure' }
  | { type: 'action'; index: number; value: string }
  | { type: 'add-action' }

export function editGoalDraft(draft: GoalDraftFields, action: GoalDraftAction): GoalDraftFields {
  if (action.type === 'title') return { ...draft, title: action.value, category: action.value }
  if (action.type === 'why') return { ...draft, why: action.value }
  if (action.type === 'goal') return { ...draft, goalText: action.value }
  if (action.type === 'notes') return { ...draft, notes: action.value }
  if (action.type === 'status') return { ...draft, status: action.value }
  if (action.type === 'add-measure') return { ...draft, measures: [...draft.measures, ''] }
  if (action.type === 'add-action') return { ...draft, nextActions: [...draft.nextActions, ''] }
  if (action.type === 'measure') {
    const measures = draft.measures.slice()
    measures[action.index] = action.value
    return { ...draft, measures }
  }
  const nextActions = draft.nextActions.slice()
  nextActions[action.index] = action.value
  return { ...draft, nextActions }
}
