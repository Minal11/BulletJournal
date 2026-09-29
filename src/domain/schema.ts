import { makeEntry } from './entries.ts'
import { APP_ID, SCHEMA_VERSION } from './types.ts'
import type {
  AppSettings,
  BulletType,
  Collection,
  CollectionIcon,
  DayPage,
  FutureLogItem,
  Goal,
  Habit,
  HabitLog,
  MonthlyHabitSelection,
  GoalStatus,
  JournalEntry,
  JournalSnapshot,
  MonthlyLog,
  MonthlyReflection,
  QuarterlyReview,
  Signifier,
  TaskStatus,
} from './types.ts'

export interface ValidationResult {
  ok: boolean
  errors: string[]
  warnings: string[]
  summary: {
    entries: number
    goals: number
    collections: number
    reflections: number
    reviews: number
    futureItems: number
    from: string | null
    to: string | null
  }
  snapshot: JournalSnapshot | null
}

const BULLETS = new Set<BulletType>(['task', 'event', 'note'])
const STATUSES = new Set<TaskStatus>(['open', 'complete', 'migrated', 'scheduled', 'cancelled'])
const SIGNIFIERS = new Set<Signifier>(['important', 'insight', 'research'])
const GOAL_STATUSES = new Set<GoalStatus>(['active', 'in_progress', 'not_started', 'complete', 'dropped'])
const ICONS = new Set<CollectionIcon>(['none', 'plane', 'heart', 'star', 'book', 'leaf', 'home', 'bulb', 'pencil', 'sun'])

export function defaultSettings(): AppSettings {
  return {
    theme: 'system',
    font: 'patrick',
    fontSize: 'md',
    paperStyle: 'dotted',
    showTimestampsByDefault: true,
    firstDayOfWeek: 0,
    dateFormat: 'mdy',
  }
}

export function emptySnapshot(now = new Date()): JournalSnapshot {
  return {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    app: APP_ID,
    entries: [],
    days: [],
    monthlyLogs: [],
    goals: [],
    reviews: [],
    reflections: [],
    collections: [],
    futureItems: [],
    habits: [],
    habitLogs: [],
    habitMonths: [],
    indexOverrides: [],
    settings: defaultSettings(),
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function readVersion(raw: Record<string, unknown>): number {
  return typeof raw.schemaVersion === 'number' ? raw.schemaVersion : 0
}

function v0ToV1(raw: Record<string, unknown>): Record<string, unknown> {
  const entries = Array.isArray(raw.entries)
    ? raw.entries.map((entry) => {
        if (!isRecord(entry)) return entry
        return {
          ...entry,
          type: entry.type ?? entry.bullet ?? 'note',
          taskStatus: entry.taskStatus ?? entry.status ?? null,
          signifiers: entry.signifiers ?? [],
          tags: entry.tags ?? [],
          collectionIds: entry.collectionIds ?? [],
          goalIds: entry.goalIds ?? [],
        }
      })
    : []
  return {
    ...raw,
    schemaVersion: 1,
    app: raw.app ?? APP_ID,
    entries,
    days: raw.days ?? [],
    monthlyLogs: raw.monthlyLogs ?? [],
    goals: raw.goals ?? [],
    reviews: raw.reviews ?? [],
    reflections: raw.reflections ?? [],
    collections: raw.collections ?? [],
    futureItems: raw.futureItems ?? [],
    indexOverrides: raw.indexOverrides ?? [],
  }
}

function normalizeEntry(value: unknown, warnings: string[]): JournalEntry | null {
  if (!isRecord(value) || typeof value.id !== 'string') {
    warnings.push('Skipped an entry that was missing an id.')
    return null
  }
  const date = typeof value.date === 'string' && value.date ? value.date : null
  if (!date && value.type !== 'task') {
    warnings.push('Skipped an entry that was missing a date.')
    return null
  }
  const type = BULLETS.has(value.type as BulletType) ? (value.type as BulletType) : 'note'
  const taskStatus = STATUSES.has(value.taskStatus as TaskStatus) ? (value.taskStatus as TaskStatus) : null
  const signifiers = Array.isArray(value.signifiers)
    ? value.signifiers.filter((item): item is Signifier => SIGNIFIERS.has(item as Signifier))
    : []
  return {
    id: value.id,
    date,
    timestamp: typeof value.timestamp === 'string' ? value.timestamp : null,
    showTimestamp: asBoolean(value.showTimestamp, Boolean(value.timestamp)),
    type,
    scope: value.scope === 'month' ? 'month' : 'day',
    content: asString(value.content),
    note: asString(value.note),
    taskStatus: type === 'task' ? (taskStatus ?? 'open') : null,
    signifiers,
    tags: asStringArray(value.tags),
    collectionIds: asStringArray(value.collectionIds),
    goalIds: asStringArray(value.goalIds),
    migratedFromId: typeof value.migratedFromId === 'string' ? value.migratedFromId : null,
    migratedToId: typeof value.migratedToId === 'string' ? value.migratedToId : null,
    migrationDate: typeof value.migrationDate === 'string' ? value.migrationDate : null,
    scheduleHistory: Array.isArray(value.scheduleHistory)
      ? value.scheduleHistory.flatMap((item) => {
          if (!isRecord(item) || typeof item.changedAt !== 'string') return []
          return [{ from: typeof item.from === 'string' ? item.from : null, to: typeof item.to === 'string' ? item.to : null, changedAt: item.changedAt }]
        })
      : [],
    sortOrder: asNumber(value.sortOrder),
    createdAt: asString(value.createdAt, new Date(0).toISOString()),
    updatedAt: asString(value.updatedAt, new Date(0).toISOString()),
  }
}

function normalizeSettings(value: unknown): AppSettings {
  const defaults = defaultSettings()
  if (!isRecord(value)) return defaults
  return {
    theme: value.theme === 'light' || value.theme === 'dark' || value.theme === 'system' ? value.theme : defaults.theme,
    font:
      value.font === 'patrick' || value.font === 'kalam' || value.font === 'caveat' || value.font === 'architects'
        ? value.font
        : defaults.font,
    fontSize: value.fontSize === 'sm' || value.fontSize === 'md' || value.fontSize === 'lg' ? value.fontSize : defaults.fontSize,
    paperStyle:
      value.paperStyle === 'dotted' || value.paperStyle === 'grid' || value.paperStyle === 'ruled' || value.paperStyle === 'blank'
        ? value.paperStyle
        : defaults.paperStyle,
    showTimestampsByDefault: asBoolean(value.showTimestampsByDefault, true),
    firstDayOfWeek: value.firstDayOfWeek === 1 ? 1 : 0,
    dateFormat: value.dateFormat === 'dmy' ? 'dmy' : 'mdy',
  }
}

export function migrateSnapshot(input: unknown, now = new Date()): ValidationResult {
  const warnings: string[] = []
  const errors: string[] = []
  const emptySummary = {
    entries: 0,
    goals: 0,
    collections: 0,
    reflections: 0,
    reviews: 0,
    futureItems: 0,
    from: null,
    to: null,
  }
  if (!isRecord(input)) {
    return { ok: false, errors: ['That file is not a journal backup.'], warnings, summary: emptySummary, snapshot: null }
  }
  if (typeof input.app === 'string' && input.app !== APP_ID) {
    return { ok: false, errors: ['That file belongs to a different app.'], warnings, summary: emptySummary, snapshot: null }
  }
  let version = readVersion(input)
  if (version > SCHEMA_VERSION) {
    return {
      ok: false,
      errors: ['This backup was made with a newer version of the journal.'],
      warnings,
      summary: emptySummary,
      snapshot: null,
    }
  }
  let current: Record<string, unknown> = input
  if (version < 1) {
    current = v0ToV1(current)
    version = 1
    warnings.push('Updated an older backup to the current journal format.')
  }

  const entries = (Array.isArray(current.entries) ? current.entries : [])
    .map((entry) => normalizeEntry(entry, warnings))
    .filter((entry): entry is JournalEntry => entry !== null)

  const snapshot: JournalSnapshot = {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: asString(current.exportedAt, now.toISOString()),
    app: APP_ID,
    entries,
    days: normalizeDays(current.days),
    monthlyLogs: normalizeMonths(current.monthlyLogs),
    goals: normalizeGoals(current.goals),
    reviews: normalizeReviews(current.reviews),
    reflections: normalizeReflections(current.reflections),
    collections: normalizeCollections(current.collections),
    futureItems: normalizeFuture(current.futureItems),
    habits: normalizeHabits(current.habits),
    habitLogs: normalizeHabitLogs(current.habitLogs),
    habitMonths: normalizeHabitMonths(current.habitMonths),
    indexOverrides: normalizeOverrides(current.indexOverrides),
    settings: normalizeSettings(current.settings),
  }
  const adopted = adoptNextActions(snapshot, now)
  const dates = adopted.entries.map((entry) => entry.date).filter((date): date is string => Boolean(date)).sort()
  return {
    ok: true,
    errors,
    warnings,
    summary: {
      entries: adopted.entries.length,
      goals: snapshot.goals.length,
      collections: snapshot.collections.length,
      reflections: snapshot.reflections.length,
      reviews: snapshot.reviews.length,
      futureItems: adopted.futureItems.length,
      from: dates[0] ?? null,
      to: dates[dates.length - 1] ?? null,
    },
    snapshot: adopted,
  }
}

export function adoptNextActions(snapshot: JournalSnapshot, now: Date): JournalSnapshot {
  const entries = snapshot.entries.slice()
  const goals = snapshot.goals.map((goal) => {
    for (const action of goal.nextActions) {
      const content = action.trim()
      if (!content) continue
      const already = entries.some((entry) => entry.type === 'task' && entry.goalIds.includes(goal.id) && entry.content === content)
      if (already) continue
      entries.push(
        makeEntry({
          date: null,
          content,
          type: 'task',
          goalIds: [goal.id],
          timestamp: null,
          showTimestamp: false,
          sortOrder: entries.length,
          now,
        }),
      )
    }
    return { ...goal, nextActions: [] }
  })
  return { ...snapshot, entries, goals }
}

function normalizeHabits(value: unknown): Habit[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!isRecord(item) || typeof item.id !== 'string') return []
    return [{
      id: item.id,
      name: asString(item.name),
      description: asString(item.description),
      activeFrom: asString(item.activeFrom, '1970-01-01'),
      inactiveFrom: typeof item.inactiveFrom === 'string' ? item.inactiveFrom : null,
      archived: asBoolean(item.archived),
      defaultForFutureMonths: asBoolean(item.defaultForFutureMonths),
      sortOrder: asNumber(item.sortOrder),
      createdAt: asString(item.createdAt, new Date(0).toISOString()),
      updatedAt: asString(item.updatedAt, new Date(0).toISOString()),
    }]
  })
}

function normalizeHabitLogs(value: unknown): HabitLog[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  return value.flatMap((item) => {
    if (!isRecord(item) || typeof item.id !== 'string' || typeof item.habitId !== 'string' || typeof item.date !== 'string') return []
    const key = `${item.habitId}:${item.date}`
    if (seen.has(key)) return []
    seen.add(key)
    return [{
      id: item.id,
      habitId: item.habitId,
      date: item.date,
      completed: asBoolean(item.completed),
      createdAt: asString(item.createdAt, new Date(0).toISOString()),
      updatedAt: asString(item.updatedAt, new Date(0).toISOString()),
    }]
  })
}

function normalizeHabitMonths(value: unknown): MonthlyHabitSelection[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!isRecord(item) || typeof item.id !== 'string' || typeof item.habitId !== 'string') return []
    return [{
      id: item.id,
      year: asNumber(item.year),
      month: asNumber(item.month),
      habitId: item.habitId,
      enabled: asBoolean(item.enabled, true),
      updatedAt: asString(item.updatedAt, new Date(0).toISOString()),
    }]
  })
}

function normalizeDays(value: unknown): DayPage[] {
  if (!Array.isArray(value)) return []
  return value
    .filter(isRecord)
    .filter((day) => typeof day.date === 'string')
    .map((day) => ({
      date: String(day.date),
      planCollapsed: asBoolean(day.planCollapsed),
      manualOrder: asBoolean(day.manualOrder),
      planItems: Array.isArray(day.planItems)
        ? day.planItems.filter(isRecord).map((item) => ({
            id: asString(item.id, crypto.randomUUID()),
            time: typeof item.time === 'string' ? item.time : null,
            content: asString(item.content),
          }))
        : [],
    }))
}

function normalizeMonths(value: unknown): MonthlyLog[] {
  if (!Array.isArray(value)) return []
  return value.filter(isRecord).map((log) => ({
    id: asString(log.id, `month-${log.year}-${log.month}`),
    year: asNumber(log.year),
    month: asNumber(log.month),
    calendar: Array.isArray(log.calendar)
      ? log.calendar.filter(isRecord).map((mark) => ({
          id: asString(mark.id, crypto.randomUUID()),
          day: asNumber(mark.day),
          type: BULLETS.has(mark.type as BulletType) ? (mark.type as BulletType) : 'event',
          content: asString(mark.content),
          signifiers: Array.isArray(mark.signifiers)
            ? mark.signifiers.filter((item): item is Signifier => SIGNIFIERS.has(item as Signifier))
            : [],
        }))
      : [],
    goalFocus: Array.isArray(log.goalFocus)
      ? log.goalFocus.filter(isRecord).map((item) => ({
          id: asString(item.id, crypto.randomUUID()),
          goalId: asString(item.goalId),
          title: asString(item.title),
          text: asString(item.text),
        }))
      : [],
    reflectionId: typeof log.reflectionId === 'string' ? log.reflectionId : null,
  }))
}

function normalizeGoals(value: unknown): Goal[] {
  if (!Array.isArray(value)) return []
  return value
    .filter(isRecord)
    .filter((goal) => typeof goal.id === 'string')
    .map((goal) => ({
      id: String(goal.id),
      title: asString(goal.title),
      category: asString(goal.category),
      quarter: ([1, 2, 3, 4].includes(asNumber(goal.quarter)) ? asNumber(goal.quarter) : 1) as 1 | 2 | 3 | 4,
      year: asNumber(goal.year),
      goalText: asString(goal.goalText),
      why: asString(goal.why),
      measures: asStringArray(goal.measures),
      nextActions: asStringArray(goal.nextActions),
      status: GOAL_STATUSES.has(goal.status as GoalStatus) ? (goal.status as GoalStatus) : 'not_started',
      notes: asString(goal.notes),
      startDate: typeof goal.startDate === 'string' ? goal.startDate : null,
      relatedEntryIds: asStringArray(goal.relatedEntryIds),
      sortOrder: asNumber(goal.sortOrder),
      createdAt: asString(goal.createdAt, new Date(0).toISOString()),
      updatedAt: asString(goal.updatedAt, new Date(0).toISOString()),
    }))
}

function normalizeReviews(value: unknown): QuarterlyReview[] {
  if (!Array.isArray(value)) return []
  return value.filter(isRecord).map((review) => ({
    id: asString(review.id),
    quarter: ([1, 2, 3, 4].includes(asNumber(review.quarter)) ? asNumber(review.quarter) : 1) as 1 | 2 | 3 | 4,
    year: asNumber(review.year),
    goalReviews: Array.isArray(review.goalReviews)
      ? review.goalReviews.filter(isRecord).map((item) => ({
          goalId: asString(item.goalId),
          intended: asString(item.intended),
          happened: asString(item.happened),
          worked: asString(item.worked),
          difficult: asString(item.difficult),
          learned: asString(item.learned),
          stillMatters:
            item.stillMatters === 'yes' || item.stillMatters === 'no' || item.stillMatters === 'unsure' ? item.stillMatters : '',
          decision:
            item.decision === 'continue' || item.decision === 'change' || item.decision === 'complete' || item.decision === 'drop'
              ? item.decision
              : '',
          nextStep: asString(item.nextStep),
        }))
      : [],
    proudOf: asString(review.proudOf),
    learned: asString(review.learned),
    tooMuchEnergyOn: asString(review.tooMuchEnergyOn),
    moreOf: asString(review.moreOf),
    lessOf: asString(review.lessOf),
    continuingGoals: asStringArray(review.continuingGoals),
    releasedGoals: asStringArray(review.releasedGoals),
    updatedAt: asString(review.updatedAt, new Date(0).toISOString()),
  }))
}

function normalizeReflections(value: unknown): MonthlyReflection[] {
  if (!Array.isArray(value)) return []
  return value.filter(isRecord).map((reflection) => {
    const went = isRecord(reflection.wentWell) ? reflection.wentWell : {}
    const heavy = isRecord(reflection.feltHeavy) ? reflection.feltHeavy : {}
    const time = isRecord(reflection.timeEnergy) ? reflection.timeEnergy : {}
    return {
      id: asString(reflection.id),
      year: asNumber(reflection.year),
      month: asNumber(reflection.month),
      bigMoments: asStringArray(reflection.bigMoments),
      wentWell: {
        proud: asString(went.proud),
        easier: asString(went.easier),
        habits: asString(went.habits),
        finished: asString(went.finished),
      },
      feltHeavy: {
        drained: asString(heavy.drained),
        postponed: asString(heavy.postponed),
        stress: asString(heavy.stress),
        overcommit: asString(heavy.overcommit),
      },
      learned: asString(reflection.learned),
      goalCheckIns: Array.isArray(reflection.goalCheckIns)
        ? reflection.goalCheckIns.filter(isRecord).map((item) => ({
            goalId: asString(item.goalId),
            mood:
              item.mood === 'going_well' || item.mood === 'needs_attention' || item.mood === 'pausing' || item.mood === 'steady'
                ? item.mood
                : 'steady',
            progress: asString(item.progress),
            nextMonth: asString(item.nextMonth),
          }))
        : [],
      timeEnergy: {
        best: asString(time.best),
        drained: asString(time.drained),
        meaningfulWork: asString(time.meaningfulWork),
        tookLonger: asString(time.tookLonger),
        evenings: asString(time.evenings),
      },
      memoryEntryIds: asStringArray(reflection.memoryEntryIds),
      releasedMemoryIds: asStringArray(reflection.releasedMemoryIds),
      extraMemories: asStringArray(reflection.extraMemories),
      moreOf: asStringArray(reflection.moreOf),
      lessOf: asStringArray(reflection.lessOf),
      migrationDecisions: Array.isArray(reflection.migrationDecisions)
        ? reflection.migrationDecisions.filter(isRecord).map((item) => ({
            entryId: asString(item.entryId),
            action:
              item.action === 'next_month' || item.action === 'future' || item.action === 'complete' || item.action === 'let_go'
                ? item.action
                : 'let_go',
            targetYear: typeof item.targetYear === 'number' ? item.targetYear : undefined,
            targetMonth: typeof item.targetMonth === 'number' ? item.targetMonth : undefined,
          }))
        : [],
      monthInOneSentence: asString(reflection.monthInOneSentence),
      updatedAt: asString(reflection.updatedAt, new Date(0).toISOString()),
    }
  })
}

function normalizeCollections(value: unknown): Collection[] {
  if (!Array.isArray(value)) return []
  return value
    .filter(isRecord)
    .filter((collection) => typeof collection.id === 'string')
    .map((collection) => ({
      id: String(collection.id),
      title: asString(collection.title),
      description: asString(collection.description),
      content: asString(collection.content),
      bullets: Array.isArray(collection.bullets)
        ? collection.bullets.filter(isRecord).map((bullet, index) => ({
            id: asString(bullet.id, `${collection.id}-b-${index}`),
            type:
              bullet.type === 'task' || bullet.type === 'event' || bullet.type === 'note' || bullet.type === 'check'
                ? bullet.type
                : 'note',
            content: asString(bullet.content),
            taskStatus: STATUSES.has(bullet.taskStatus as TaskStatus) ? (bullet.taskStatus as TaskStatus) : null,
            checked: asBoolean(bullet.checked),
            signifiers: Array.isArray(bullet.signifiers)
              ? bullet.signifiers.filter((item): item is Signifier => SIGNIFIERS.has(item as Signifier))
              : [],
            sortOrder: asNumber(bullet.sortOrder, index),
          }))
        : [],
      linkedEntryIds: asStringArray(collection.linkedEntryIds),
      tags: asStringArray(collection.tags),
      icon: ICONS.has(collection.icon as CollectionIcon) ? (collection.icon as CollectionIcon) : 'none',
      archived: asBoolean(collection.archived),
      pinned: asBoolean(collection.pinned),
      defaultBullet: BULLETS.has(collection.defaultBullet as BulletType) ? (collection.defaultBullet as BulletType) : 'note',
      createdAt: asString(collection.createdAt, new Date(0).toISOString()),
      updatedAt: asString(collection.updatedAt, new Date(0).toISOString()),
    }))
}

function normalizeFuture(value: unknown): FutureLogItem[] {
  if (!Array.isArray(value)) return []
  return value
    .filter(isRecord)
    .filter((item) => typeof item.id === 'string')
    .map((item) => ({
      id: String(item.id),
      targetMonth: asNumber(item.targetMonth, 1),
      targetYear: asNumber(item.targetYear),
      type: BULLETS.has(item.type as BulletType) ? (item.type as BulletType) : 'task',
      content: asString(item.content),
      taskStatus: STATUSES.has(item.taskStatus as TaskStatus) ? (item.taskStatus as TaskStatus) : 'open',
      signifiers: [],
      relatedGoalId: typeof item.relatedGoalId === 'string' ? item.relatedGoalId : null,
      sourceEntryId: typeof item.sourceEntryId === 'string' ? item.sourceEntryId : null,
      reviewed: asBoolean(item.reviewed),
      sortOrder: asNumber(item.sortOrder),
      createdAt: asString(item.createdAt, new Date(0).toISOString()),
      updatedAt: asString(item.updatedAt, new Date(0).toISOString()),
    }))
}

function normalizeOverrides(value: unknown): JournalSnapshot['indexOverrides'] {
  if (!Array.isArray(value)) return []
  return value
    .filter(isRecord)
    .filter((item) => typeof item.id === 'string')
    .map((item) => ({
      id: String(item.id),
      hidden: asBoolean(item.hidden),
      pinned: asBoolean(item.pinned),
      sortOrder: typeof item.sortOrder === 'number' ? item.sortOrder : null,
    }))
}

function newer<T extends { id: string; updatedAt?: string }>(local: T, incoming: T): T {
  return (incoming.updatedAt ?? '') >= (local.updatedAt ?? '') ? incoming : local
}

function mergeById<T extends { id: string; updatedAt?: string }>(local: T[], incoming: T[]): T[] {
  const map = new Map(local.map((item) => [item.id, item]))
  for (const item of incoming) {
    const previous = map.get(item.id)
    map.set(item.id, previous ? newer(previous, item) : item)
  }
  return [...map.values()]
}

export function mergeSnapshots(local: JournalSnapshot, incoming: JournalSnapshot, now = new Date()): JournalSnapshot {
  const days = new Map(local.days.map((day) => [day.date, day]))
  for (const day of incoming.days) {
    const previous = days.get(day.date)
    if (!previous) {
      days.set(day.date, day)
      continue
    }
    const items = new Map(previous.planItems.map((item) => [item.id, item]))
    for (const item of day.planItems) items.set(item.id, item)
    days.set(day.date, { ...previous, ...day, planItems: [...items.values()] })
  }
  return {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    app: APP_ID,
    entries: mergeById(local.entries, incoming.entries),
    days: [...days.values()],
    monthlyLogs: mergeById(local.monthlyLogs, incoming.monthlyLogs),
    goals: mergeById(local.goals, incoming.goals),
    reviews: mergeById(local.reviews, incoming.reviews),
    reflections: mergeById(local.reflections, incoming.reflections),
    collections: mergeById(local.collections, incoming.collections),
    futureItems: mergeById(local.futureItems, incoming.futureItems),
    habits: mergeById(local.habits ?? [], incoming.habits ?? []),
    habitLogs: mergeById(local.habitLogs ?? [], incoming.habitLogs ?? []),
    habitMonths: mergeById(local.habitMonths ?? [], incoming.habitMonths ?? []),
    indexOverrides: mergeById(
      local.indexOverrides.map((item) => ({ ...item, updatedAt: '' })),
      incoming.indexOverrides.map((item) => ({ ...item, updatedAt: '1' })),
    ).map(({ updatedAt: _updatedAt, ...item }) => item),
    settings: local.settings,
  }
}
