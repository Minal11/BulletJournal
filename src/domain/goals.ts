import { quarterOf } from './dates.ts'
import { reviewId, reflectionId, createId } from './ids.ts'
import type {
  CheckInMood,
  Goal,
  GoalReview,
  GoalStatus,
  MonthlyReflection,
  Quarter,
  QuarterlyReview,
} from './types.ts'

export const GOAL_STATUS_LABEL: Record<GoalStatus, string> = {
  active: 'Active',
  in_progress: 'In progress',
  not_started: 'Not started',
  complete: 'Complete',
  dropped: 'Dropped',
}

export const CHECKIN_LABEL: Record<CheckInMood, string> = {
  going_well: 'Going well',
  steady: 'Steady',
  needs_attention: 'Needs attention',
  pausing: 'Pausing',
}

const GOAL_CYCLE: GoalStatus[] = ['not_started', 'active', 'in_progress', 'complete', 'dropped']
const MOOD_CYCLE: CheckInMood[] = ['going_well', 'steady', 'needs_attention', 'pausing']

export function nextGoalStatus(status: GoalStatus): GoalStatus {
  const index = GOAL_CYCLE.indexOf(status)
  return GOAL_CYCLE[(index + 1) % GOAL_CYCLE.length] ?? 'active'
}

export function nextMood(mood: CheckInMood): CheckInMood {
  const index = MOOD_CYCLE.indexOf(mood)
  return MOOD_CYCLE[(index + 1) % MOOD_CYCLE.length] ?? 'steady'
}

export function goalsForQuarter(goals: Goal[], year: number, quarter: Quarter): Goal[] {
  return goals
    .filter((goal) => goal.year === year && goal.quarter === quarter)
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt))
}

export function goalsForMonth(goals: Goal[], year: number, month: number): Goal[] {
  const quarter = quarterOf(year, month)
  return goalsForQuarter(goals, quarter.year, quarter.quarter)
}

export function blankGoal(year: number, quarter: Quarter, sortOrder: number, now = new Date()): Goal {
  const iso = now.toISOString()
  return {
    id: createId(),
    title: '',
    category: '',
    quarter,
    year,
    goalText: '',
    why: '',
    measures: [''],
    nextActions: [''],
    status: 'not_started',
    notes: '',
    startDate: null,
    relatedEntryIds: [],
    sortOrder,
    createdAt: iso,
    updatedAt: iso,
  }
}

function blankReviewFor(goal: Goal): GoalReview {
  return {
    goalId: goal.id,
    intended: goal.goalText,
    happened: '',
    worked: '',
    difficult: '',
    learned: '',
    stillMatters: '',
    decision: '',
    nextStep: '',
  }
}

export function blankReview(year: number, quarter: Quarter, goals: Goal[], now = new Date()): QuarterlyReview {
  return {
    id: reviewId(year, quarter),
    quarter,
    year,
    goalReviews: goalsForQuarter(goals, year, quarter).map(blankReviewFor),
    proudOf: '',
    learned: '',
    tooMuchEnergyOn: '',
    moreOf: '',
    lessOf: '',
    continuingGoals: [],
    releasedGoals: [],
    updatedAt: now.toISOString(),
  }
}

export function syncReview(review: QuarterlyReview, goals: Goal[]): QuarterlyReview {
  const relevant = goalsForQuarter(goals, review.year, review.quarter)
  const byId = new Map(review.goalReviews.map((item) => [item.goalId, item]))
  const goalReviews = relevant.map((goal) => {
    const existing = byId.get(goal.id)
    if (!existing) return blankReviewFor(goal)
    return existing.intended.trim() ? existing : { ...existing, intended: goal.goalText }
  })
  const same =
    goalReviews.length === review.goalReviews.length &&
    goalReviews.every((item, index) => item === review.goalReviews[index])
  return same ? review : { ...review, goalReviews }
}

function emptyWentWell(): MonthlyReflection['wentWell'] {
  return { proud: '', easier: '', habits: '', finished: '' }
}

function emptyHeavy(): MonthlyReflection['feltHeavy'] {
  return { drained: '', postponed: '', stress: '', overcommit: '' }
}

function emptyTime(): MonthlyReflection['timeEnergy'] {
  return { best: '', drained: '', meaningfulWork: '', tookLonger: '', evenings: '' }
}

export function blankReflection(year: number, month: number, goals: Goal[], now = new Date()): MonthlyReflection {
  return {
    id: reflectionId(year, month),
    year,
    month,
    bigMoments: ['', '', ''],
    wentWell: emptyWentWell(),
    feltHeavy: emptyHeavy(),
    learned: '',
    goalCheckIns: goalsForMonth(goals, year, month).map((goal) => ({
      goalId: goal.id,
      mood: 'steady',
      progress: '',
      nextMonth: '',
    })),
    timeEnergy: emptyTime(),
    memoryEntryIds: [],
    releasedMemoryIds: [],
    extraMemories: [''],
    moreOf: [''],
    lessOf: [''],
    migrationDecisions: [],
    monthInOneSentence: '',
    updatedAt: now.toISOString(),
  }
}

export function syncReflection(reflection: MonthlyReflection, goals: Goal[]): MonthlyReflection {
  const relevant = goalsForMonth(goals, reflection.year, reflection.month)
  const byId = new Map(reflection.goalCheckIns.map((item) => [item.goalId, item]))
  const goalCheckIns = relevant.map(
    (goal) => byId.get(goal.id) ?? { goalId: goal.id, mood: 'steady' as const, progress: '', nextMonth: '' },
  )
  const same =
    goalCheckIns.length === reflection.goalCheckIns.length &&
    goalCheckIns.every((item, index) => item === reflection.goalCheckIns[index])
  return same ? reflection : { ...reflection, goalCheckIns }
}

export function goalSymbol(status: GoalStatus): string {
  switch (status) {
    case 'active':
      return '●'
    case 'in_progress':
      return '◐'
    case 'not_started':
      return '○'
    case 'complete':
      return '✓'
    case 'dropped':
      return '×'
    default:
      return '○'
  }
}

export function moodSymbol(mood: CheckInMood): string {
  switch (mood) {
    case 'going_well':
      return '●'
    case 'steady':
      return '◐'
    case 'needs_attention':
      return '○'
    case 'pausing':
      return '—'
    default:
      return '○'
  }
}
