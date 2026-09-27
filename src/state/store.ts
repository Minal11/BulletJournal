import { cyclePrimarySignifier, parseRapidLog, toggleSignifier } from '../domain/bullets.ts'
import { storedEntry, type EntryKind } from '../lib/entry-input.ts'
import { monthOf, todayISO } from '../domain/dates.ts'
import { makeEntry, syncLinks, withEntryContent } from '../domain/entries.ts'
import { blankGoal, blankReflection, blankReview, nextGoalStatus, syncReflection, syncReview } from '../domain/goals.ts'
import { monthLogId, reflectionId, reviewId, createId } from '../domain/ids.ts'
import { applyMigrationAction, applyTaskStatus, bringFutureItem, undoMigration } from '../domain/migration.ts'
import { emptySnapshot, mergeSnapshots } from '../domain/schema.ts'
import type {
  AppSettings,
  BulletType,
  Collection,
  CollectionBullet,
  DayPage,
  FutureLogItem,
  Goal,
  IndexOverride,
  JournalEntry,
  JournalSnapshot,
  MigrationAction,
  MonthlyGoalFocus,
  MonthlyLog,
  MonthlyReflection,
  PlanItem,
  QuarterlyReview,
  Signifier,
  TaskStatus,
} from '../domain/types.ts'
import { databaseName } from '../services/sync-diff.ts'
import { journalBridge } from '../services/journal-bridge.ts'
import { syncService } from '../services/syncService.ts'
import { activateDatabase } from '../storage/db.ts'
import { latestBackup, loadJournal, saveBackup, saveJournal } from '../storage/repository.ts'
import { buildSeed } from '../storage/seed.ts'

export interface StoreState {
  ready: boolean
  error: string | null
  snapshot: JournalSnapshot
  backupAt: string | null
}

const listeners = new Set<() => void>()
let state: StoreState = {
  ready: false,
  error: null,
  snapshot: emptySnapshot(),
  backupAt: null,
}
let saveChain: Promise<void> = Promise.resolve()
let pending: JournalSnapshot | null = null
let savedSnapshot: JournalSnapshot = state.snapshot
let trackChanges = false
let sessionToken = 0

function emit() {
  for (const listener of listeners) listener()
}

function commit(snapshot: JournalSnapshot, track = trackChanges) {
  const previous = state.snapshot
  const linked = syncLinks(snapshot.entries, snapshot.collections, snapshot.goals)
  const next = { ...snapshot, collections: linked.collections, goals: linked.goals }
  state = { ...state, snapshot: next, error: null }
  emit()
  pending = next
  saveChain = saveChain
    .then(async () => {
      while (pending) {
        const saving = pending
        pending = null
        await saveJournal(saving)
        savedSnapshot = saving
      }
      if (track) void syncService.noteChange(previous)
    })
    .catch(() => {
      pending = null
      state = { ...state, snapshot: savedSnapshot, error: 'This browser could not save the journal.' }
      emit()
    })
}

function snap(): JournalSnapshot {
  return state.snapshot
}

function upsert<T extends { id: string }>(items: T[], item: T): T[] {
  const index = items.findIndex((candidate) => candidate.id === item.id)
  if (index < 0) return [...items, item]
  const next = items.slice()
  next[index] = item
  return next
}

function dayOf(snapshot: JournalSnapshot, date: string): DayPage {
  return (
    snapshot.days.find((day) => day.date === date) ?? {
      date,
      planCollapsed: false,
      planItems: [],
      manualOrder: false,
    }
  )
}

function monthOfLog(snapshot: JournalSnapshot, year: number, month: number): MonthlyLog {
  return (
    snapshot.monthlyLogs.find((log) => log.year === year && log.month === month) ?? {
      id: monthLogId(year, month),
      year,
      month,
      calendar: [],
      goalFocus: [],
      reflectionId: null,
    }
  )
}

export const journal = {
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  getSnapshot() {
    return state
  },
  async openForUser(userId: string) {
    const token = ++sessionToken
    trackChanges = false
    await syncService.stop()
    await journal.flush()
    if (token !== sessionToken) return
    try {
      await activateDatabase(databaseName(userId))
      journalBridge.getSnapshot = () => state.snapshot
      journalBridge.replaceQuiet = (snapshot) => commit(snapshot, false)
      const loaded = await loadJournal()
      const backup = await latestBackup()
      if (token !== sessionToken) return
      state = {
        ready: true,
        error: null,
        snapshot: loaded ?? emptySnapshot(),
        backupAt: backup?.createdAt ?? null,
      }
      emit()
      if (!loaded) await saveJournal(state.snapshot)
      trackChanges = true
      await syncService.start(userId)
    } catch (error) {
      if (token !== sessionToken) return
      state = {
        ...state,
        ready: true,
        error: error instanceof Error ? error.message : 'The journal could not be opened.',
      }
      emit()
    }
  },
  async openDemo() {
    const token = ++sessionToken
    trackChanges = false
    await syncService.stop()
    await journal.flush()
    if (token !== sessionToken) return
    const { buildTourJournal } = await import('../demo/tour-journal.ts')
    await activateDatabase('MyBulletJournal-demo-tour')
    journalBridge.getSnapshot = () => state.snapshot
    journalBridge.replaceQuiet = () => undefined
    const snapshot = buildTourJournal(new Date())
    await saveJournal(snapshot)
    if (token !== sessionToken) return
    savedSnapshot = snapshot
    state = { ready: true, error: null, snapshot, backupAt: null }
    emit()
    trackChanges = true
  },
  async closeSession() {
    const token = ++sessionToken
    trackChanges = false
    await syncService.stop()
    await journal.flush()
    if (token !== sessionToken) return
    state = { ready: false, error: null, snapshot: emptySnapshot(), backupAt: null }
    emit()
  },
  loadSample() {
    commit(buildSeed(new Date()))
  },
  async backupNow() {
    await saveBackup(snap())
    state = { ...state, backupAt: new Date().toISOString() }
    emit()
  },
  async importAnonymous(snapshot: JournalSnapshot) {
    await saveBackup(snap())
    state = { ...state, backupAt: new Date().toISOString() }
    commit(snapshot)
    syncService.dismissMigration()
    await journal.flush()
  },
  async flush() {
    await saveChain
  },
  updateSettings(patch: Partial<AppSettings>) {
    const current = snap()
    commit({ ...current, settings: { ...current.settings, ...patch } })
  },
  addEntry(input: {
    date: string
    content: string
    type?: BulletType
    scope?: 'day' | 'month'
    timestamp?: string | null
    showTimestamp?: boolean
    signifiers?: Signifier[]
    tags?: string[]
    goalIds?: string[]
    collectionIds?: string[]
  }): JournalEntry | null {
    const parsed = parseRapidLog(input.content, input.type ?? 'task')
    if (!parsed.content) return null
    const current = snap()
    const entry = makeEntry({
      date: input.date,
      content: parsed.content,
      type: parsed.type,
      scope: input.scope ?? 'day',
      timestamp: input.timestamp ?? null,
      showTimestamp: input.showTimestamp ?? Boolean(input.timestamp),
      signifiers: [...new Set([...(input.signifiers ?? []), ...parsed.signifiers])],
      tags: [...new Set([...(input.tags ?? []), ...(parsed.memory ? ['memory'] : [])])],
      goalIds: input.goalIds,
      collectionIds: input.collectionIds,
      taskStatus: parsed.type === 'task' ? 'open' : null,
      sortOrder: current.entries.length,
    })
    commit({ ...current, entries: [...current.entries, entry] })
    return entry
  },
  updateEntry(id: string, patch: Partial<Pick<JournalEntry, 'content' | 'note' | 'timestamp' | 'showTimestamp' | 'date'>>) {
    const current = snap()
    commit({
      ...current,
      entries: current.entries.map((entry) => {
        if (entry.id !== id) return entry
        const next = { ...entry, ...patch, updatedAt: new Date().toISOString() }
        if (patch.content !== undefined) return withEntryContent(next, patch.content)
        return next
      }),
    })
  },
  deleteEntry(id: string) {
    const current = snap()
    const entry = current.entries.find((item) => item.id === id)
    let entries = current.entries.filter((item) => item.id !== id)
    if (entry?.migratedFromId) {
      entries = entries.map((item) => (item.id === entry.migratedFromId ? { ...item, migratedToId: null } : item))
    }
    const futureItems = current.futureItems.filter((item) => item.sourceEntryId !== id || item.reviewed)
    commit({ ...current, entries, futureItems })
  },
  cycleEntry(id: string) {
    const current = snap()
    const entry = current.entries.find((item) => item.id === id)
    if (!entry) return
    if (entry.type !== 'task') {
      commit({
        ...current,
        entries: current.entries.map((item) =>
          item.id === id ? { ...item, signifiers: cyclePrimarySignifier(item.signifiers), updatedAt: new Date().toISOString() } : item,
        ),
      })
      return
    }
    const result = applyTaskStatus(current.entries, current.futureItems, id, nextStatus(entry))
    commit({ ...current, ...result })
  },
  setEntryStatus(id: string, status: TaskStatus, target?: { year: number; month: number }) {
    const current = snap()
    const result = applyTaskStatus(current.entries, current.futureItems, id, status, target ? { targetYear: target.year, targetMonth: target.month } : undefined)
    commit({ ...current, ...result })
  },
  setEntryType(id: string, type: BulletType) {
    const current = snap()
    const entry = current.entries.find((item) => item.id === id)
    if (!entry) return
    if (type === 'task') {
      commit({
        ...current,
        entries: current.entries.map((item) =>
          item.id === id ? { ...item, type, taskStatus: item.taskStatus ?? 'open', updatedAt: new Date().toISOString() } : item,
        ),
      })
      return
    }
    const cleared = applyTaskStatus(current.entries, current.futureItems, id, 'open')
    commit({
      ...current,
      entries: cleared.entries.map((item) =>
        item.id === id ? { ...item, type, taskStatus: null, updatedAt: new Date().toISOString() } : item,
      ),
      futureItems: cleared.futureItems,
    })
  },
  setEntryKind(id: string, kind: EntryKind) {
    const current = snap()
    const entry = current.entries.find((item) => item.id === id)
    if (!entry) return
    const stored = storedEntry(kind)
    const tags = stored.memory ? [...new Set([...entry.tags, 'memory'])] : entry.tags.filter((tag) => tag !== 'memory')
    const leavingMemory = entry.tags.includes('memory') && !stored.memory
    const signifiers = stored.memory ? (['important'] as Signifier[]) : leavingMemory ? entry.signifiers.filter((item) => item !== 'important') : entry.signifiers
    if (stored.type === 'task') {
      commit({
        ...current,
        entries: current.entries.map((item) =>
          item.id === id ? { ...item, type: 'task', taskStatus: item.taskStatus ?? 'open', tags, signifiers, updatedAt: new Date().toISOString() } : item,
        ),
      })
      return
    }
    const cleared = applyTaskStatus(current.entries, current.futureItems, id, 'open')
    commit({
      ...current,
      entries: cleared.entries.map((item) =>
        item.id === id ? { ...item, type: stored.type, taskStatus: null, tags, signifiers, updatedAt: new Date().toISOString() } : item,
      ),
      futureItems: cleared.futureItems,
    })
  },
  toggleSignifier(id: string, signifier: Signifier) {
    const current = snap()
    commit({
      ...current,
      entries: current.entries.map((entry) =>
        entry.id === id
          ? { ...entry, signifiers: toggleSignifier(entry.signifiers, signifier), updatedAt: new Date().toISOString() }
          : entry,
      ),
    })
  },
  toggleCollection(entryId: string, collectionId: string) {
    const current = snap()
    commit({
      ...current,
      entries: current.entries.map((entry) => {
        if (entry.id !== entryId) return entry
        const has = entry.collectionIds.includes(collectionId)
        return {
          ...entry,
          collectionIds: has ? entry.collectionIds.filter((id) => id !== collectionId) : [...entry.collectionIds, collectionId],
          updatedAt: new Date().toISOString(),
        }
      }),
    })
  },
  toggleGoal(entryId: string, goalId: string) {
    const current = snap()
    commit({
      ...current,
      entries: current.entries.map((entry) => {
        if (entry.id !== entryId) return entry
        const has = entry.goalIds.includes(goalId)
        return {
          ...entry,
          goalIds: has ? entry.goalIds.filter((id) => id !== goalId) : [...entry.goalIds, goalId],
          updatedAt: new Date().toISOString(),
        }
      }),
    })
  },
  reorderEntries(ids: string[]) {
    const order = new Map(ids.map((id, index) => [id, index]))
    const current = snap()
    commit({
      ...current,
      entries: current.entries.map((entry) => (order.has(entry.id) ? { ...entry, sortOrder: order.get(entry.id) ?? 0 } : entry)),
    })
  },
  updateDay(date: string, patch: Partial<DayPage>) {
    const current = snap()
    const day = { ...dayOf(current, date), ...patch, date }
    const days = current.days.some((item) => item.date === date)
      ? current.days.map((item) => (item.date === date ? day : item))
      : [...current.days, day]
    commit({ ...current, days })
  },
  addPlanItem(date: string, item: Omit<PlanItem, 'id'>) {
    const day = dayOf(snap(), date)
    journal.updateDay(date, { planItems: [...day.planItems, { ...item, id: createId() }] })
  },
  updatePlanItem(date: string, id: string, patch: Partial<PlanItem>) {
    const current = snap()
    const day = dayOf(current, date)
    journal.updateDay(date, {
      planItems: day.planItems.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    })
  },
  removePlanItem(date: string, id: string) {
    const current = snap()
    const day = dayOf(current, date)
    journal.updateDay(date, { planItems: day.planItems.filter((item) => item.id !== id) })
  },
  addCalendarMark(year: number, month: number, day: number, content: string, type: BulletType = 'event') {
    if (!content.trim()) return
    const current = snap()
    const log = monthOfLog(current, year, month)
    const mark = { id: createId(), day, type, content: content.trim(), signifiers: [] as Signifier[] }
    const monthlyLogs = upsert(current.monthlyLogs, { ...log, calendar: [...log.calendar, mark] })
    commit({ ...current, monthlyLogs })
  },
  removeCalendarMark(year: number, month: number, id: string) {
    const current = snap()
    commit({
      ...current,
      monthlyLogs: current.monthlyLogs.map((log) =>
        log.year === year && log.month === month ? { ...log, calendar: log.calendar.filter((mark) => mark.id !== id) } : log,
      ),
    })
  },
  addFocus(year: number, month: number, focus: Omit<MonthlyGoalFocus, 'id'>) {
    const current = snap()
    const log = monthOfLog(current, year, month)
    const monthlyLogs = upsert(current.monthlyLogs, { ...log, goalFocus: [...log.goalFocus, { ...focus, id: createId() }] })
    commit({ ...current, monthlyLogs })
  },
  updateFocus(year: number, month: number, id: string, patch: Partial<Pick<MonthlyGoalFocus, 'text' | 'goalId' | 'title'>>) {
    const current = snap()
    commit({
      ...current,
      monthlyLogs: current.monthlyLogs.map((log) =>
        log.year === year && log.month === month
          ? { ...log, goalFocus: log.goalFocus.map((item) => (item.id === id ? { ...item, ...patch } : item)) }
          : log,
      ),
    })
  },
  reorderFocus(year: number, month: number, ids: string[]) {
    const current = snap()
    const order = new Map(ids.map((id, index) => [id, index]))
    commit({
      ...current,
      monthlyLogs: current.monthlyLogs.map((log) => {
        if (log.year !== year || log.month !== month) return log
        const goalFocus = log.goalFocus.slice().sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
        return { ...log, goalFocus }
      }),
    })
  },
  removeFocus(year: number, month: number, id: string) {
    const current = snap()
    commit({
      ...current,
      monthlyLogs: current.monthlyLogs.map((log) =>
        log.year === year && log.month === month ? { ...log, goalFocus: log.goalFocus.filter((item) => item.id !== id) } : log,
      ),
    })
  },
  addGoal(year: number, quarter: 1 | 2 | 3 | 4) {
    const current = snap()
    const sortOrder = current.goals.filter((goal) => goal.year === year && goal.quarter === quarter).length
    const goal = blankGoal(year, quarter, sortOrder)
    commit({ ...current, goals: [...current.goals, goal] })
    return goal.id
  },
  insertGoal(goal: Goal) {
    const current = snap()
    commit({ ...current, goals: [...current.goals.filter((item) => item.id !== goal.id), goal] })
  },
  updateGoal(id: string, patch: Partial<Goal>) {
    const current = snap()
    commit({
      ...current,
      goals: current.goals.map((goal) => (goal.id === id ? { ...goal, ...patch, updatedAt: new Date().toISOString() } : goal)),
    })
  },
  cycleGoal(id: string) {
    const current = snap()
    const goal = current.goals.find((item) => item.id === id)
    if (!goal) return
    journal.updateGoal(id, { status: nextGoalStatus(goal.status) })
  },
  deleteGoal(id: string) {
    const current = snap()
    commit({
      ...current,
      goals: current.goals.filter((goal) => goal.id !== id),
      entries: current.entries.map((entry) => ({ ...entry, goalIds: entry.goalIds.filter((goalId) => goalId !== id) })),
    })
  },
  reorderGoals(ids: string[]) {
    const order = new Map(ids.map((id, index) => [id, index]))
    const current = snap()
    commit({
      ...current,
      goals: current.goals.map((goal) => (order.has(goal.id) ? { ...goal, sortOrder: order.get(goal.id) ?? 0 } : goal)),
    })
  },
  ensureReview(year: number, quarter: 1 | 2 | 3 | 4) {
    const current = snap()
    const id = reviewId(year, quarter)
    const existing = current.reviews.find((review) => review.id === id)
    const review = syncReview(existing ?? blankReview(year, quarter, current.goals), current.goals)
    if (review === existing) return
    commit({ ...current, reviews: upsert(current.reviews, review) })
  },
  updateReview(id: string, recipe: (review: QuarterlyReview) => QuarterlyReview) {
    const current = snap()
    commit({
      ...current,
      reviews: current.reviews.map((review) => (review.id === id ? { ...recipe(review), updatedAt: new Date().toISOString() } : review)),
    })
  },
  ensureReflection(year: number, month: number) {
    const current = snap()
    const id = reflectionId(year, month)
    const existing = current.reflections.find((reflection) => reflection.id === id)
    const reflection = syncReflection(existing ?? blankReflection(year, month, current.goals), current.goals)
    const starred = current.entries
      .filter((entry) => entry.signifiers.includes('important') && entry.date.startsWith(`${year}-${String(month).padStart(2, '0')}`))
      .map((entry) => entry.id)
    const released = new Set(reflection.releasedMemoryIds)
    const memoryEntryIds = [...new Set([...reflection.memoryEntryIds, ...starred.filter((entryId) => !released.has(entryId))])]
    const next = memoryEntryIds.length === reflection.memoryEntryIds.length && reflection === existing
      ? reflection
      : { ...reflection, memoryEntryIds }
    if (next === existing) return
    const log = monthOfLog(current, year, month)
    const monthlyLogs = upsert(current.monthlyLogs, { ...log, reflectionId: id })
    commit({ ...current, reflections: upsert(current.reflections, next), monthlyLogs })
  },
  updateReflection(id: string, recipe: (reflection: MonthlyReflection) => MonthlyReflection) {
    const current = snap()
    commit({
      ...current,
      reflections: current.reflections.map((reflection) =>
        reflection.id === id ? { ...recipe(reflection), updatedAt: new Date().toISOString() } : reflection,
      ),
    })
  },
  migrateEntry(id: string, action: MigrationAction, target?: { year: number; month: number }) {
    const current = snap()
    const entry = current.entries.find((item) => item.id === id)
    if (!entry) return
    const result = applyMigrationAction(
      current.entries,
      current.futureItems,
      id,
      action,
      target ? { targetYear: target.year, targetMonth: target.month } : undefined,
    )
    const { year, month } = monthOf(entry.date)
    const reflectionKey = reflectionId(year, month)
    const reflections = current.reflections.map((reflection) => {
      if (reflection.id !== reflectionKey) return reflection
      const decisions = reflection.migrationDecisions.filter((decision) => decision.entryId !== id)
      return {
        ...reflection,
        migrationDecisions: [...decisions, { entryId: id, action, targetYear: target?.year, targetMonth: target?.month }],
      }
    })
    commit({ ...current, ...result, reflections })
  },
  undoMigration(id: string) {
    const current = snap()
    const result = undoMigration(current.entries, current.futureItems, id)
    commit({
      ...current,
      ...result,
      reflections: current.reflections.map((reflection) => ({
        ...reflection,
        migrationDecisions: reflection.migrationDecisions.filter((decision) => decision.entryId !== id),
      })),
    })
  },
  bringFuture(id: string) {
    const current = snap()
    const result = bringFutureItem(current.entries, current.futureItems, id, todayISO())
    commit({ ...current, ...result })
  },
  addFutureItem(targetYear: number, targetMonth: number, content: string, type: BulletType) {
    const parsed = parseRapidLog(content, type)
    if (!parsed.content) return
    const current = snap()
    const item: FutureLogItem = {
      id: createId(),
      targetYear,
      targetMonth,
      type: parsed.type,
      content: parsed.content,
      taskStatus: parsed.type === 'task' ? 'open' : null,
      signifiers: parsed.signifiers,
      relatedGoalId: null,
      sourceEntryId: null,
      reviewed: false,
      sortOrder: current.futureItems.length,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    commit({ ...current, futureItems: [...current.futureItems, item] })
  },
  updateFutureItem(id: string, patch: Partial<Pick<FutureLogItem, 'content' | 'type' | 'targetMonth' | 'targetYear'>>) {
    const current = snap()
    commit({
      ...current,
      futureItems: current.futureItems.map((item) =>
        item.id === id ? { ...item, ...patch, updatedAt: new Date().toISOString() } : item,
      ),
    })
  },
  removeFutureItem(id: string) {
    const current = snap()
    commit({ ...current, futureItems: current.futureItems.filter((item) => item.id !== id) })
  },
  addCollection(title: string) {
    const current = snap()
    const trimmed = title.trim()
    if (!trimmed) return null
    const ideas = /idea/i.test(trimmed)
    const collection: Collection = {
      id: createId(),
      title: trimmed,
      description: ideas ? 'Not every idea needs to become a project.' : '',
      content: '',
      bullets: [],
      linkedEntryIds: [],
      tags: [],
      icon: ideas ? 'bulb' : 'none',
      archived: false,
      pinned: false,
      defaultBullet: ideas ? 'note' : 'task',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    commit({ ...current, collections: [...current.collections, collection] })
    return collection.id
  },
  updateCollection(id: string, patch: Partial<Collection>) {
    const current = snap()
    commit({
      ...current,
      collections: current.collections.map((collection) =>
        collection.id === id ? { ...collection, ...patch, updatedAt: new Date().toISOString() } : collection,
      ),
    })
  },
  addCollectionBullet(collectionId: string, content: string) {
    const current = snap()
    const collection = current.collections.find((item) => item.id === collectionId)
    if (!collection) return
    const parsed = parseRapidLog(content, collection.defaultBullet)
    if (!parsed.content) return
    const bullet: CollectionBullet = {
      id: createId(),
      type: parsed.type,
      content: parsed.content,
      taskStatus: parsed.type === 'task' ? 'open' : null,
      checked: false,
      signifiers: parsed.signifiers,
      sortOrder: collection.bullets.length,
    }
    journal.updateCollection(collectionId, { bullets: [...collection.bullets, bullet] })
  },
  updateCollectionBullet(collectionId: string, bulletId: string, patch: Partial<CollectionBullet>) {
    const current = snap()
    const collection = current.collections.find((item) => item.id === collectionId)
    if (!collection) return
    journal.updateCollection(collectionId, {
      bullets: collection.bullets.map((bullet) => (bullet.id === bulletId ? { ...bullet, ...patch } : bullet)),
    })
  },
  removeCollectionBullet(collectionId: string, bulletId: string) {
    const current = snap()
    const collection = current.collections.find((item) => item.id === collectionId)
    if (!collection) return
    journal.updateCollection(collectionId, { bullets: collection.bullets.filter((bullet) => bullet.id !== bulletId) })
  },
  reorderCollectionBullets(collectionId: string, ids: string[]) {
    const current = snap()
    const collection = current.collections.find((item) => item.id === collectionId)
    if (!collection) return
    const order = new Map(ids.map((id, index) => [id, index]))
    journal.updateCollection(collectionId, {
      bullets: collection.bullets.map((bullet) => ({ ...bullet, sortOrder: order.get(bullet.id) ?? bullet.sortOrder })),
    })
  },
  setIndexOverrides(overrides: IndexOverride[]) {
    commit({ ...snap(), indexOverrides: overrides })
  },
  async importSnapshot(incoming: JournalSnapshot, mode: 'merge' | 'replace') {
    const current = snap()
    await saveBackup(current)
    state = { ...state, backupAt: new Date().toISOString() }
    const next = mode === 'replace' ? { ...incoming, settings: incoming.settings } : mergeSnapshots(current, incoming)
    commit(next)
    await journal.flush()
  },
  async restoreBackup() {
    const backup = await latestBackup()
    if (!backup) return false
    commit(backup.snapshot)
    await journal.flush()
    return true
  },
}

function nextStatus(entry: JournalEntry): TaskStatus {
  const order: TaskStatus[] = ['open', 'complete', 'migrated', 'scheduled', 'cancelled']
  const index = order.indexOf(entry.taskStatus ?? 'open')
  return order[(index + 1) % order.length] ?? 'open'
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    if (pending) void saveJournal(pending)
  })
}
