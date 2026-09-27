export const SCHEMA_VERSION = 1

export const APP_ID = 'my-bullet-journal' as const

export type BulletType = 'task' | 'event' | 'note'

export type TaskStatus = 'open' | 'complete' | 'migrated' | 'scheduled' | 'cancelled'

export type Signifier = 'important' | 'insight' | 'research'

export type EntryScope = 'day' | 'month'

export type GoalStatus = 'active' | 'in_progress' | 'not_started' | 'complete' | 'dropped'

export type CheckInMood = 'going_well' | 'steady' | 'needs_attention' | 'pausing'

export type ReviewDecision = '' | 'continue' | 'change' | 'complete' | 'drop'

export type StillMatters = '' | 'yes' | 'no' | 'unsure'

export type MigrationAction = 'next_month' | 'future' | 'complete' | 'let_go'

export type ThemeChoice = 'light' | 'dark' | 'system'

export type PaperStyle = 'dotted' | 'grid' | 'ruled' | 'blank'

export type HandFont = 'patrick' | 'kalam' | 'caveat' | 'architects'

export type FontSize = 'sm' | 'md' | 'lg'

export type DateFormat = 'mdy' | 'dmy'

export type CollectionIcon =
  | 'none'
  | 'plane'
  | 'heart'
  | 'star'
  | 'book'
  | 'leaf'
  | 'home'
  | 'bulb'
  | 'pencil'
  | 'sun'

export type Quarter = 1 | 2 | 3 | 4

export interface JournalEntry {
  id: string
  date: string
  timestamp: string | null
  showTimestamp: boolean
  type: BulletType
  scope: EntryScope
  content: string
  note: string
  taskStatus: TaskStatus | null
  signifiers: Signifier[]
  tags: string[]
  collectionIds: string[]
  goalIds: string[]
  migratedFromId: string | null
  migratedToId: string | null
  migrationDate: string | null
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface PlanItem {
  id: string
  time: string | null
  content: string
}

export interface DayPage {
  date: string
  planCollapsed: boolean
  planItems: PlanItem[]
  manualOrder: boolean
}

export interface CalendarMark {
  id: string
  day: number
  type: BulletType
  content: string
  signifiers: Signifier[]
}

export interface MonthlyGoalFocus {
  id: string
  goalId: string
  text: string
}

export interface MonthlyLog {
  id: string
  year: number
  month: number
  calendar: CalendarMark[]
  goalFocus: MonthlyGoalFocus[]
  reflectionId: string | null
}

export interface Goal {
  id: string
  title: string
  category: string
  quarter: Quarter
  year: number
  goalText: string
  why: string
  measures: string[]
  nextActions: string[]
  status: GoalStatus
  notes: string
  startDate: string | null
  relatedEntryIds: string[]
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface GoalReview {
  goalId: string
  intended: string
  happened: string
  worked: string
  difficult: string
  learned: string
  stillMatters: StillMatters
  decision: ReviewDecision
  nextStep: string
}

export interface QuarterlyReview {
  id: string
  quarter: Quarter
  year: number
  goalReviews: GoalReview[]
  proudOf: string
  learned: string
  tooMuchEnergyOn: string
  moreOf: string
  lessOf: string
  continuingGoals: string[]
  releasedGoals: string[]
  updatedAt: string
}

export interface GoalCheckIn {
  goalId: string
  mood: CheckInMood
  progress: string
  nextMonth: string
}

export interface MigrationDecision {
  entryId: string
  action: MigrationAction
  targetYear?: number
  targetMonth?: number
}

export interface MonthlyReflection {
  id: string
  year: number
  month: number
  bigMoments: string[]
  wentWell: {
    proud: string
    easier: string
    habits: string
    finished: string
  }
  feltHeavy: {
    drained: string
    postponed: string
    stress: string
    overcommit: string
  }
  learned: string
  goalCheckIns: GoalCheckIn[]
  timeEnergy: {
    best: string
    drained: string
    meaningfulWork: string
    tookLonger: string
    evenings: string
  }
  memoryEntryIds: string[]
  releasedMemoryIds: string[]
  extraMemories: string[]
  moreOf: string[]
  lessOf: string[]
  migrationDecisions: MigrationDecision[]
  monthInOneSentence: string
  updatedAt: string
}

export interface CollectionBullet {
  id: string
  type: BulletType | 'check'
  content: string
  taskStatus: TaskStatus | null
  checked: boolean
  signifiers: Signifier[]
  sortOrder: number
}

export interface Collection {
  id: string
  title: string
  description: string
  content: string
  bullets: CollectionBullet[]
  linkedEntryIds: string[]
  tags: string[]
  icon: CollectionIcon
  archived: boolean
  pinned: boolean
  defaultBullet: BulletType
  createdAt: string
  updatedAt: string
}

export interface FutureLogItem {
  id: string
  targetMonth: number
  targetYear: number
  type: BulletType
  content: string
  taskStatus: TaskStatus | null
  signifiers: Signifier[]
  relatedGoalId: string | null
  sourceEntryId: string | null
  reviewed: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface IndexOverride {
  id: string
  hidden: boolean
  pinned: boolean
  sortOrder: number | null
}

export interface AppSettings {
  theme: ThemeChoice
  font: HandFont
  fontSize: FontSize
  paperStyle: PaperStyle
  showTimestampsByDefault: boolean
  firstDayOfWeek: 0 | 1
  dateFormat: DateFormat
}

export interface JournalSnapshot {
  schemaVersion: number
  exportedAt: string
  app: typeof APP_ID
  entries: JournalEntry[]
  days: DayPage[]
  monthlyLogs: MonthlyLog[]
  goals: Goal[]
  reviews: QuarterlyReview[]
  reflections: MonthlyReflection[]
  collections: Collection[]
  futureItems: FutureLogItem[]
  indexOverrides: IndexOverride[]
  settings: AppSettings
}

export interface IndexRow {
  id: string
  label: string
  route: string
  kind: 'future' | 'goals' | 'month' | 'reflection' | 'review' | 'collection'
  pinned: boolean
  hidden: boolean
  sortOrder: number
}

export interface SearchFilters {
  query: string
  from: string | null
  to: string | null
  types: BulletType[]
  completed: boolean
  migrated: boolean
  starred: boolean
  collectionId: string | null
  goalId: string | null
  tag: string | null
}

export interface SearchHit {
  id: string
  kind: 'entry' | 'collection' | 'goal' | 'reflection' | 'review' | 'future' | 'bullet'
  route: string
  meta: string
  symbol: string
  text: string
}
