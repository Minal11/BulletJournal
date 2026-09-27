import { monthOf, todayISO } from '../domain/dates.ts'
import { makeEntry } from '../domain/entries.ts'
import { monthLogId, reflectionId } from '../domain/ids.ts'
import { emptySnapshot } from '../domain/schema.ts'
import type { Collection, Goal, JournalSnapshot, MonthlyReflection } from '../domain/types.ts'

/** A fictional notebook used only by the development demo route. */
export function buildTourJournal(now = new Date()): JournalSnapshot {
  const today = todayISO(now)
  const { year, month } = monthOf(today)
  const iso = now.toISOString()
  const goals: Goal[] = [
    goal('goal-family', 'Family', 'Be present for the people at home.', 'The days go better when family time is planned, not leftover.', ['One unhurried evening each week', 'One outing this month'], ['Protect Saturday afternoon'], iso),
    goal('goal-health', 'Health', 'Keep a kinder sleep rhythm.', 'Energy follows the night before.', ['Lights out near the same hour', 'A short walk most days'], ['Choose a bedtime and keep it for a week'], iso),
    goal('goal-career', 'Career', 'Get stronger at the work that matters.', 'Skill grows from focused practice, not from a longer list.', ['8 focused learning sessions', 'One topic carried through the month'], ['Finish the next practice session'], iso),
    goal('goal-travel', 'Travel', 'Shape a calm trip before the dates arrive.', 'Decisions made early leave the trip itself unhurried.', ['Destination chosen', 'A simple budget'], ['Write down the must-haves'], iso),
  ]
  const reflection: MonthlyReflection = {
    id: reflectionId(year, month),
    year,
    month,
    bigMoments: ['A quiet dinner at home', 'The morning the work finally clicked', ''],
    wentWell: {
      proud: 'The focused mornings.',
      easier: 'Keeping the daily list short.',
      habits: 'Writing the day down before opening anything else.',
      finished: 'The practice sessions I actually scheduled.',
    },
    feltHeavy: {
      drained: 'Too many open tasks at once.',
      postponed: 'The trip planning.',
      stress: 'Saying yes to every small request.',
      overcommit: 'Treating every idea as a project.',
    },
    learned: 'A short list is easier to keep.',
    goalCheckIns: goals.map((item) => ({
      goalId: item.id,
      mood: 'steady' as const,
      progress: '',
      nextMonth: '',
    })),
    timeEnergy: { best: 'Morning', drained: 'Late evening', meaningfulWork: 'Before noon', tookLonger: 'Planning', evenings: 'Family time' },
    memoryEntryIds: [],
    releasedMemoryIds: [],
    extraMemories: [''],
    moreOf: ['Quiet mornings'],
    lessOf: ['Late-night planning'],
    migrationDecisions: [],
    monthInOneSentence: 'A steady month, with room left over.',
    updatedAt: iso,
  }
  const collections: Collection[] = [
    collection('col-travel', 'Travel Plans', 'Ideas for a calm trip.', 'plane', 'A few places, and the reason each one belongs.', iso),
    collection('col-family', 'Family Memories', 'Moments worth keeping.', 'heart', 'Not a scrapbook. Just the lines worth finding later.', iso),
    collection('col-ideas', 'Ideas', 'Not every idea needs to become a project.', 'bulb', 'Park thoughts here until they earn a page of their own.', iso),
  ]
  const snapshot = emptySnapshot(now)
  snapshot.settings = { ...snapshot.settings, theme: 'light', font: 'patrick', paperStyle: 'dotted', showTimestampsByDefault: false }
  snapshot.goals = goals
  snapshot.collections = collections
  snapshot.reflections = [reflection]
  snapshot.monthlyLogs = [
    {
      id: monthLogId(year, month),
      year,
      month,
      calendar: [
        { id: 'cal-dinner', day: 12, type: 'event', content: 'Dinner with family', signifiers: [] },
        { id: 'cal-walk', day: 20, type: 'event', content: 'Morning walk', signifiers: [] },
      ],
      goalFocus: [{ id: 'focus-career', goalId: 'goal-career', title: '', text: 'Complete 8 focused learning sessions' }],
      reflectionId: reflection.id,
    },
  ]
  snapshot.entries = [
    makeEntry({
      id: 'tour-open-task',
      date: `${year}-${String(month).padStart(2, '0')}-12`,
      content: 'Finish the reading list',
      type: 'task',
      scope: 'day',
      taskStatus: 'open',
      now,
    }),
  ]
  snapshot.days = [{ date: today, planCollapsed: false, planItems: [], manualOrder: false }]
  return snapshot
}

function goal(id: string, title: string, goalText: string, why: string, measures: string[], nextActions: string[], iso: string): Goal {
  return {
    id,
    title,
    category: title,
    quarter: 3,
    year: 2026,
    goalText,
    why,
    measures,
    nextActions,
    status: title === 'Health' ? 'in_progress' : title === 'Travel' ? 'not_started' : 'active',
    notes: '',
    startDate: '2026-07-01',
    relatedEntryIds: [],
    sortOrder: ['Family', 'Health', 'Career', 'Travel'].indexOf(title),
    createdAt: iso,
    updatedAt: iso,
  }
}

function collection(id: string, title: string, description: string, icon: Collection['icon'], content: string, iso: string): Collection {
  return {
    id,
    title,
    description,
    content,
    bullets: [],
    linkedEntryIds: [],
    tags: [],
    icon,
    archived: false,
    pinned: false,
    defaultBullet: 'note',
    createdAt: iso,
    updatedAt: iso,
  }
}
