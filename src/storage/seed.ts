import { addDays, isoDate, monthOf, shiftMonth, todayISO } from '../domain/dates.ts'
import { makeEntry } from '../domain/entries.ts'
import { monthLogId, reflectionId, reviewId } from '../domain/ids.ts'
import { applyTaskStatus } from '../domain/migration.ts'
import { emptySnapshot } from '../domain/schema.ts'
import type {
  Collection,
  FutureLogItem,
  Goal,
  JournalEntry,
  JournalSnapshot,
  MonthlyLog,
  MonthlyReflection,
  QuarterlyReview,
} from '../domain/types.ts'

function stamp(date: Date): string {
  return date.toISOString()
}

function onDay(now: Date, dayOffset: number, hours: number, minutes: number): Date {
  const next = new Date(now)
  next.setDate(next.getDate() + dayOffset)
  next.setHours(hours, minutes, 0, 0)
  return next
}

export function buildSeed(now = new Date()): JournalSnapshot {
  const today = todayISO(now)
  const yesterday = addDays(today, -1)
  const { year, month } = monthOf(today)
  const next = shiftMonth(year, month, 1)
  const morning = onDay(now, 0, 7, 15)
  const iso = stamp(now)

  const goals: Goal[] = [
    goal('goal-q3-family', 'Family', 3, 0, 'active', 'Be around without turning family time into another task.', 'I miss people when the day is only a list.', ['One slow Sunday', 'Leave one evening unscheduled'], ['Protect Sunday afternoon'], '2026-07-01', iso),
    goal('goal-q3-health', 'Health', 3, 1, 'in_progress', 'Get to bed before I am already exhausted.', 'Everything is harder when I am tired.', ['Lights out closer to 11', 'A short walk most days'], ['Set a bedtime I can actually keep'], '2026-07-01', iso),
    goal('goal-q3-rhythm', 'Work rhythm', 3, 2, 'active', 'Do the real work earlier in the day.', 'Late nights make the next morning smaller.', ['One deep block before noon', 'Stop opening the laptop after 9'], ['Name tomorrow’s first block'], '2026-07-01', iso),
    goal('goal-family', 'Family', 4, 0, 'active', 'Be more present and intentional with family time.', 'I want family time to feel lived, not squeezed between tasks.', ['2 meaningful outings per month', '1 slow family day each week', 'Capture family memories'], ['Pick October outing', 'Protect one weekend day'], '2026-10-01', iso),
    goal('goal-health', 'Health', 4, 1, 'not_started', 'Improve energy, sleep, and consistency.', 'Everything feels harder when I am tired.', ['Better sleep rhythm', 'Movement 3x/week', 'Less weekday sugar'], ['Set a realistic bedtime target'], '2026-10-01', iso),
    goal('goal-career', 'Career', 4, 2, 'active', 'Become stronger in backend, system design, and AI-assisted development.', 'I want the work to feel skilled, not just busy.', ['AI coding practice 2–3x/week', 'One backend topic a month', 'One system-design topic a month'], ['Choose the October practice topic'], '2026-10-01', iso),
    goal('goal-moneyverse', 'Moneyverse', 4, 3, 'in_progress', 'Finish and polish the net-worth workflow without adding extras.', 'The project is close. More features will not make it finished.', ['Finish the key workflow', 'Fix the major bugs', 'Avoid unnecessary feature expansion'], ['Review the remaining workflow bugs'], '2026-10-01', iso),
    goal('goal-travel', 'Travel', 4, 4, 'not_started', 'Plan a relaxed family trip without last-minute stress.', 'I want the trip to feel spacious before we leave.', ['Route decided', 'Flights booked', 'Lodging booked', 'Budget understood'], ['Decide the Hawaii structure'], '2026-10-01', iso),
  ]

  let entries: JournalEntry[] = [
    makeEntry({ id: 'yesterday-read', date: yesterday, content: 'Read AI article', type: 'task', timestamp: '21:10', showTimestamp: true, now: onDay(now, -1, 21, 10) }),
    makeEntry({ id: 'wake', date: today, content: 'Woke up with Ziva', type: 'event', timestamp: '07:15', showTimestamp: true, now: morning }),
    makeEntry({ id: 'sleep', date: today, content: 'Slept poorly. Low energy.', type: 'note', timestamp: '07:40', showTimestamp: true, now: onDay(now, 0, 7, 40) }),
    makeEntry({ id: 'email', date: today, content: 'Send work email', type: 'task', timestamp: '08:20', showTimestamp: true, now: onDay(now, 0, 8, 20) }),
    makeEntry({ id: 'start-work', date: today, content: 'Started work', type: 'event', timestamp: '09:15', showTimestamp: true, now: onDay(now, 0, 9, 15) }),
    makeEntry({ id: 'prod', date: today, content: 'Fix production issue', type: 'task', taskStatus: 'complete', timestamp: '10:35', showTimestamp: true, now: onDay(now, 0, 10, 35) }),
    makeEntry({ id: 'lunch', date: today, content: 'Lunch', type: 'event', timestamp: '12:10', showTimestamp: true, now: onDay(now, 0, 12, 10) }),
    makeEntry({ id: 'clearer', date: today, content: 'Brain feels clearer after stepping away.', type: 'note', timestamp: '12:25', showTimestamp: true, now: onDay(now, 0, 12, 25) }),
    makeEntry({ id: 'money-bug', date: today, content: 'Review Moneyverse bug', type: 'task', timestamp: '14:40', showTimestamp: true, goalIds: ['goal-moneyverse'], now: onDay(now, 0, 14, 40) }),
    makeEntry({ id: 'finished', date: today, content: 'Finished work', type: 'event', timestamp: '17:15', showTimestamp: true, now: onDay(now, 0, 17, 15) }),
    makeEntry({ id: 'walk', date: today, content: 'Walk with family', type: 'event', timestamp: '18:10', showTimestamp: true, now: onDay(now, 0, 18, 10) }),
    makeEntry({
      id: 'leaves',
      date: today,
      content: 'Ziva kept stopping to look at leaves.',
      type: 'event',
      timestamp: '18:35',
      showTimestamp: true,
      signifiers: ['important'],
      collectionIds: ['col-ziva'],
      now: onDay(now, 0, 18, 35),
    }),
    makeEntry({
      id: 'flights',
      date: today,
      content: 'Research vacation flights',
      type: 'task',
      timestamp: '20:30',
      showTimestamp: true,
      goalIds: ['goal-travel'],
      now: onDay(now, 0, 20, 30),
    }),
    makeEntry({
      id: 'tired',
      date: today,
      content: 'Too tired for flight research.',
      type: 'note',
      timestamp: '21:45',
      showTimestamp: true,
      now: onDay(now, 0, 21, 45),
    }),
  ]

  const earlier = [8, 12, 16, 18].filter((day) => day < monthOf(today).day)
  for (const day of earlier) {
    const date = isoDate(year, month, day)
    entries.push(
      makeEntry({
        id: `deep-${day}`,
        date,
        content: 'Deep work block',
        type: 'task',
        taskStatus: 'complete',
        timestamp: day % 2 === 0 ? '09:30' : '10:15',
        showTimestamp: true,
        now: new Date(year, month - 1, day, 10, 15),
      }),
      makeEntry({
        id: `walk-${day}`,
        date,
        content: 'Evening walk',
        type: 'event',
        timestamp: '18:40',
        showTimestamp: true,
        signifiers: ['important'],
        collectionIds: ['col-ziva'],
        now: new Date(year, month - 1, day, 18, 40),
      }),
    )
  }
  if (earlier.includes(16)) {
    entries.push(
      makeEntry({
        id: 'late-1',
        date: isoDate(year, month, 16),
        content: 'Organize the hall closet',
        type: 'task',
        timestamp: '20:40',
        showTimestamp: true,
        now: new Date(year, month - 1, 16, 20, 40),
      }),
      makeEntry({
        id: 'late-2',
        date: isoDate(year, month, 18),
        content: 'Reply to the insurance form',
        type: 'task',
        timestamp: '21:05',
        showTimestamp: true,
        now: new Date(year, month - 1, 18, 21, 5),
      }),
    )
  }

  let futureItems: FutureLogItem[] = [
    future('future-slow', year, month, 'Schedule a slow Saturday', 'task', iso),
    future('future-thanks', 2026, 11, 'Thanksgiving', 'event', iso),
    future('future-holiday', 2026, 11, 'Start holiday planning', 'task', iso),
    future('future-vacation', 2026, 12, 'Vacation', 'event', iso),
    future('future-hawaii', 2026, 12, 'Hawaii planning', 'task', iso, 'goal-travel'),
    future('future-year', 2026, 12, 'Year reflection', 'note', iso),
    future('future-q1', 2027, 1, 'Q1 goal setup', 'task', iso),
  ]

  let migrated = applyTaskStatus(entries, futureItems, 'yesterday-read', 'migrated', { now: onDay(now, -1, 21, 40) })
  entries = migrated.entries
  futureItems = migrated.futureItems
  migrated = applyTaskStatus(entries, futureItems, 'flights', 'migrated', { now })
  entries = migrated.entries
  futureItems = migrated.futureItems
  if (entries.some((entry) => entry.id === 'late-1')) {
    migrated = applyTaskStatus(entries, futureItems, 'late-1', 'migrated', { now: new Date(year, month - 1, 16, 21, 0) })
    entries = migrated.entries
    futureItems = migrated.futureItems
    migrated = applyTaskStatus(entries, futureItems, 'late-2', 'migrated', { now: new Date(year, month - 1, 18, 21, 20) })
    entries = migrated.entries
    futureItems = migrated.futureItems
  }

  const octoberTasks = [
    'Decide Hawaii trip structure',
    'Check flight options',
    'Finish Moneyverse workflow',
    'Complete AI practice sessions',
    'Organize fall clothes',
    'Plan family outings',
    'Review household expenses',
  ]
  octoberTasks.forEach((content, index) => {
    entries.push(
      makeEntry({
        id: `oct-task-${index}`,
        date: '2026-10-01',
        content,
        type: 'task',
        scope: 'month',
        goalIds: index < 2 ? ['goal-travel'] : index === 2 ? ['goal-moneyverse'] : index === 5 ? ['goal-family'] : [],
        sortOrder: index,
        now: new Date(2026, 8, 20, 9, 0),
      }),
    )
  })
  entries.push(
    makeEntry({
      id: 'sep-task-sunday',
      date: isoDate(year, month, 1),
      content: 'Protect one unhurried Sunday',
      type: 'task',
      scope: 'month',
      goalIds: ['goal-q3-family'],
      sortOrder: 0,
      now,
    }),
    makeEntry({
      id: 'sep-task-bed',
      date: isoDate(year, month, 1),
      content: 'Choose a bedtime I can keep',
      type: 'task',
      scope: 'month',
      goalIds: ['goal-q3-health'],
      sortOrder: 1,
      now,
    }),
  )

  const currentLog: MonthlyLog = {
    id: monthLogId(year, month),
    year,
    month,
    calendar: (
      [
        { id: 'cal-labor', day: 7, type: 'event' as const, content: 'Labor Day walk', signifiers: [] },
        { id: 'cal-market', day: 12, type: 'event' as const, content: 'Morning market', signifiers: [] },
        { id: 'cal-sunday', day: 20, type: 'event' as const, content: 'Slow family day', signifiers: ['important' as const] },
      ] satisfies MonthlyLog['calendar']
    ).filter((mark) => mark.day <= daysIn(year, month)),
    goalFocus: [
      { id: 'focus-q3-family', goalId: 'goal-q3-family', text: 'one unhurried Sunday' },
      { id: 'focus-q3-health', goalId: 'goal-q3-health', text: 'lights out closer to 11' },
    ],
    reflectionId: reflectionId(year, month),
  }

  const octoberLog: MonthlyLog = {
    id: monthLogId(next.year === 2026 && next.month === 10 ? 2026 : next.year, next.month === 10 ? 10 : next.month),
    year: 2026,
    month: 10,
    calendar: [
      { id: 'cal-pumpkin', day: 3, type: 'event', content: 'Pumpkin farm', signifiers: [] },
      { id: 'cal-office', day: 6, type: 'event', content: 'Office', signifiers: [] },
      { id: 'cal-halloween', day: 31, type: 'event', content: 'Halloween', signifiers: ['important'] },
    ],
    goalFocus: [
      { id: 'focus-family', goalId: 'goal-family', text: '2 fall outings' },
      { id: 'focus-health', goalId: 'goal-health', text: 'Improve sleep rhythm' },
      { id: 'focus-career', goalId: 'goal-career', text: '8 AI coding sessions' },
      { id: 'focus-money', goalId: 'goal-moneyverse', text: 'Finish net-worth workflow' },
      { id: 'focus-travel', goalId: 'goal-travel', text: 'Decide Hawaii structure' },
    ],
    reflectionId: null,
  }

  const reflection: MonthlyReflection = {
    id: reflectionId(year, month),
    year,
    month,
    bigMoments: ['Ziva at the pumpkin leaves', 'A morning that actually felt quiet', ''],
    wentWell: {
      proud: 'I left one evening alone and took the walk anyway.',
      easier: 'Work felt lighter when I started before email.',
      habits: 'The short walk after dinner.',
      finished: 'The production issue. A few small home things.',
    },
    feltHeavy: {
      drained: 'Late screens, and saying yes to small tasks after 8.',
      postponed: 'Flight research. It keeps sliding to tomorrow.',
      stress: 'Opening the laptop “just to check.”',
      overcommit: 'I treated a soft evening like it could hold a project.',
    },
    learned: 'The day I imagine and the day I live are allowed to be different. The log is where I notice that.',
    goalCheckIns: [
      { goalId: 'goal-q3-family', mood: 'going_well', progress: 'The walks happened. Sunday is still easy to give away.', nextMonth: 'Pick the October outing before the month starts.' },
      { goalId: 'goal-q3-health', mood: 'needs_attention', progress: 'Bedtime drifted on the nights I worked late.', nextMonth: 'Choose a bedtime that still feels kind.' },
      { goalId: 'goal-q3-rhythm', mood: 'steady', progress: 'The good work happened in the morning more often than I expected.', nextMonth: 'Keep one deep block before noon.' },
    ],
    timeEnergy: {
      best: 'Late morning, after I had already started.',
      drained: 'After 8, especially if the laptop was still open.',
      meaningfulWork: 'Between breakfast and lunch.',
      tookLonger: 'Anything I left for the evening.',
      evenings: 'Better when they were a walk and not a second shift.',
    },
    memoryEntryIds: ['leaves'],
    releasedMemoryIds: [],
    extraMemories: ['The way the light looked on the sidewalk.'],
    moreOf: ['Unscheduled evenings', 'Morning focus'],
    lessOf: ['Late-night tasks', 'Extra tabs'],
    migrationDecisions: [],
    monthInOneSentence: 'I was more myself on the days I stopped earlier.',
    updatedAt: iso,
  }

  const review: QuarterlyReview = {
    id: reviewId(2026, 3),
    quarter: 3,
    year: 2026,
    goalReviews: [
      {
        goalId: 'goal-q3-family',
        intended: 'Be around without turning family time into another task.',
        happened: 'The walks became real. A few Sundays still got eaten by small errands.',
        worked: 'Putting the walk in the log made it visible.',
        difficult: 'I kept treating leftover time as the plan.',
        learned: 'Presence needs a boundary, not a better checklist.',
        stillMatters: 'yes',
        decision: 'continue',
        nextStep: 'Carry the same wish into Q4, with two actual outings.',
      },
      {
        goalId: 'goal-q3-health',
        intended: 'Get to bed before I am already exhausted.',
        happened: 'Some weeks held. The late work nights undid them.',
        worked: 'Naming the bedtime in the monthly focus.',
        difficult: 'I used tiredness as a reason to stay up.',
        learned: 'Sleep is the thing the rest of the journal depends on.',
        stillMatters: 'yes',
        decision: 'change',
        nextStep: 'Make the target kinder and stop scheduling work after 9.',
      },
      {
        goalId: 'goal-q3-rhythm',
        intended: 'Do the real work earlier in the day.',
        happened: 'The best work really did happen before lunch.',
        worked: 'A short plan at the top of the day.',
        difficult: 'Evenings full of tasks I was too tired to do.',
        learned: 'The plan is a guess. The log is the day.',
        stillMatters: 'yes',
        decision: 'continue',
        nextStep: 'Keep the morning block. Let the evening be smaller.',
      },
    ],
    proudOf: 'I noticed the shape of my days instead of only judging them.',
    learned: 'What I migrate at night was usually written at night.',
    tooMuchEnergyOn: 'Small tasks that felt urgent after dinner.',
    moreOf: 'Walks, morning focus, unplanned time with family.',
    lessOf: 'Late screens and last-minute plans.',
    continuingGoals: ['Family', 'Work rhythm'],
    releasedGoals: [],
    updatedAt: iso,
  }

  const collections: Collection[] = [
    {
      id: 'col-vacation',
      title: 'December Vacation',
      description: 'A relaxed trip. No last-minute scramble.',
      content: 'We want sun, a kitchen, and nowhere we have to be before breakfast.\n\nHawaii is the idea. The structure can stay loose until the route feels obvious.',
      bullets: [
        { id: 'vac-1', type: 'task', content: 'Decide the island hopping question', taskStatus: 'open', checked: false, signifiers: [], sortOrder: 0 },
        { id: 'vac-2', type: 'note', content: 'Prefer a place we can walk for coffee.', taskStatus: null, checked: false, signifiers: [], sortOrder: 1 },
        { id: 'vac-3', type: 'event', content: 'Look at flights on a rested evening', taskStatus: null, checked: false, signifiers: [], sortOrder: 2 },
        { id: 'vac-4', type: 'check', content: 'Budget understood', taskStatus: null, checked: false, signifiers: [], sortOrder: 3 },
      ],
      linkedEntryIds: [],
      tags: ['travel'],
      icon: 'plane',
      archived: false,
      pinned: true,
      defaultBullet: 'task',
      createdAt: iso,
      updatedAt: iso,
    },
    {
      id: 'col-ziva',
      title: 'Ziva Memories',
      description: 'Small moments I don’t want to file as tasks.',
      content: 'She notices things I walk past.',
      bullets: [
        { id: 'ziva-1', type: 'note', content: 'Tried saying “pumpkin.”', taskStatus: null, checked: false, signifiers: ['important'], sortOrder: 0 },
        { id: 'ziva-2', type: 'note', content: 'Stopped for every yellow leaf on the sidewalk.', taskStatus: null, checked: false, signifiers: ['important'], sortOrder: 1 },
      ],
      linkedEntryIds: ['leaves'],
      tags: ['family'],
      icon: 'heart',
      archived: false,
      pinned: true,
      defaultBullet: 'note',
      createdAt: iso,
      updatedAt: iso,
    },
    {
      id: 'col-ideas',
      title: 'Ideas',
      description: 'Not every idea needs to become a project.',
      content: 'This page is for noticing. Nothing here is a commitment.',
      bullets: [
        { id: 'idea-1', type: 'note', content: 'A paper journal that can live on a phone.', taskStatus: null, checked: false, signifiers: [], sortOrder: 0 },
        { id: 'idea-2', type: 'note', content: 'Write the month in one sentence before planning the next one.', taskStatus: null, checked: false, signifiers: ['insight'], sortOrder: 1 },
        { id: 'idea-3', type: 'note', content: 'Maybe a quiet recipe page, later.', taskStatus: null, checked: false, signifiers: [], sortOrder: 2 },
      ],
      linkedEntryIds: [],
      tags: ['ideas'],
      icon: 'bulb',
      archived: false,
      pinned: false,
      defaultBullet: 'note',
      createdAt: iso,
      updatedAt: iso,
    },
  ]

  const snapshot = emptySnapshot(now)
  snapshot.entries = entries
  snapshot.futureItems = futureItems
  snapshot.goals = goals
  snapshot.collections = collections
  snapshot.monthlyLogs = currentLog.year === 2026 && currentLog.month === 10 ? [octoberLog] : [currentLog, octoberLog]
  snapshot.reflections = [reflection]
  snapshot.reviews = [review]
  snapshot.days = [
    {
      date: today,
      planCollapsed: false,
      manualOrder: false,
      planItems: [
        { id: 'plan-work', time: '09:00', content: 'Work' },
        { id: 'plan-lunch', time: '12:00', content: 'Lunch' },
        { id: 'plan-ai', time: '15:00', content: 'AI practice' },
        { id: 'plan-family', time: '18:00', content: 'Family time' },
        { id: 'plan-hawaii', time: '20:30', content: 'Hawaii research' },
      ],
    },
  ]
  snapshot.indexOverrides = [
    { id: 'collection-col-vacation', hidden: false, pinned: true, sortOrder: 20 },
    { id: 'collection-col-ziva', hidden: false, pinned: true, sortOrder: 21 },
  ]
  return snapshot
}

function daysIn(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

function goal(
  id: string,
  title: string,
  quarter: 3 | 4,
  sortOrder: number,
  status: Goal['status'],
  goalText: string,
  why: string,
  measures: string[],
  nextActions: string[],
  startDate: string,
  iso: string,
): Goal {
  return {
    id,
    title,
    category: title,
    quarter,
    year: 2026,
    goalText,
    why,
    measures,
    nextActions,
    status,
    notes: '',
    startDate,
    relatedEntryIds: [],
    sortOrder,
    createdAt: iso,
    updatedAt: iso,
  }
}

function future(
  id: string,
  year: number,
  month: number,
  content: string,
  type: FutureLogItem['type'],
  iso: string,
  relatedGoalId: string | null = null,
): FutureLogItem {
  return {
    id,
    targetYear: year,
    targetMonth: month,
    type,
    content,
    taskStatus: type === 'task' ? 'open' : null,
    signifiers: [],
    relatedGoalId,
    sourceEntryId: null,
    reviewed: false,
    sortOrder: 0,
    createdAt: iso,
    updatedAt: iso,
  }
}
