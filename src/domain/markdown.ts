import { symbolChar, markForEntry } from './bullets.ts'
import { formatDayHeading, formatDisplayTime, formatMonthYear, monthName, quarterLabel, quarterSpan, weekdayShort } from './dates.ts'
import { goalSymbol, GOAL_STATUS_LABEL } from './goals.ts'
import { dayEntries, monthTasks } from './entries.ts'
import { daysInMonth } from './dates.ts'
import type { Collection, JournalSnapshot, MonthlyReflection, QuarterlyReview } from './types.ts'

function line(symbol: string, text: string): string {
  return `${symbol} ${text}`.trimEnd()
}

export function monthToMarkdown(snapshot: JournalSnapshot, year: number, month: number): string {
  const title = formatMonthYear(year, month)
  const log = snapshot.monthlyLogs.find((item) => item.year === year && item.month === month)
  const parts = [`# ${title}`, '']
  parts.push('## Calendar', '')
  const total = daysInMonth(year, month)
  for (let day = 1; day <= total; day++) {
    const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const marks = log?.calendar.filter((mark) => mark.day === day) ?? []
    const suffix = marks.map((mark) => `${mark.type === 'task' ? '•' : mark.type === 'note' ? '–' : '○'} ${mark.content}`).join('  ')
    parts.push(`${day} ${weekdayShort(iso)}${suffix ? `  ${suffix}` : ''}`)
  }
  parts.push('', `## ${monthName(month)} tasks`, '')
  const tasks = monthTasks(snapshot.entries, year, month)
  if (tasks.length === 0) parts.push('_No monthly tasks._')
  for (const task of tasks) parts.push(line(symbolChar(markForEntry(task)), task.content))

  parts.push('', '## Monthly goal focus', '')
  if (!log || log.goalFocus.length === 0) parts.push('_No focus written yet._')
  for (const focus of log?.goalFocus ?? []) {
    const goal = snapshot.goals.find((item) => item.id === focus.goalId)
    parts.push(`${goal?.title ?? 'Goal'} → ${focus.text}`)
  }

  const reflection = snapshot.reflections.find((item) => item.year === year && item.month === month)
  if (reflection) {
    parts.push('', reflectionToMarkdown(snapshot, reflection))
  }
  return parts.join('\n')
}

export function reflectionToMarkdown(snapshot: JournalSnapshot, reflection: MonthlyReflection): string {
  const parts = [`## ${monthName(reflection.month)} reflection`, '']
  if (reflection.monthInOneSentence) parts.push(reflection.monthInOneSentence, '')
  parts.push('### What went well?', '', reflection.wentWell.proud || '_', '')
  parts.push('### What felt heavy?', '', reflection.feltHeavy.drained || '_', '')
  parts.push('### What did I learn?', '', reflection.learned || '_', '')
  for (const check of reflection.goalCheckIns) {
    const goal = snapshot.goals.find((item) => item.id === check.goalId)
    parts.push(`**${goal?.title ?? 'Goal'}**`, check.progress || '_', '')
  }
  return parts.join('\n')
}

export function collectionToMarkdown(collection: Collection): string {
  const parts = [`# ${collection.title || 'Untitled'}`, '']
  if (collection.description) parts.push(collection.description, '')
  if (collection.content) parts.push(collection.content, '')
  for (const bullet of collection.bullets.slice().sort((a, b) => a.sortOrder - b.sortOrder)) {
    const symbol = bullet.type === 'check' ? (bullet.checked ? '✓' : '○') : bullet.type === 'task' ? '•' : bullet.type === 'event' ? '○' : '–'
    parts.push(line(symbol, bullet.content))
  }
  return parts.join('\n')
}

export function reviewToMarkdown(snapshot: JournalSnapshot, review: QuarterlyReview): string {
  const parts = [`# ${quarterLabel(review.year, review.quarter)} Review`, quarterSpan(review.year, review.quarter), '']
  for (const item of review.goalReviews) {
    const goal = snapshot.goals.find((candidate) => candidate.id === item.goalId)
    parts.push(`## ${goal?.title || 'Goal'}`, '')
    parts.push(`Status: ${goal ? `${goalSymbol(goal.status)} ${GOAL_STATUS_LABEL[goal.status]}` : ''}`, '')
    parts.push('Original goal:', item.intended || '_', '')
    parts.push('What happened?', item.happened || '_', '')
    parts.push('What worked?', item.worked || '_', '')
    parts.push('What did not work?', item.difficult || '_', '')
    parts.push('What did I learn?', item.learned || '_', '')
    parts.push(`Do I still want this goal? ${item.stillMatters || '—'}`, '')
    parts.push(`Next step: ${item.nextStep || '—'}`, '')
  }
  parts.push('## Big picture', '')
  parts.push(`I am proud of: ${review.proudOf || '—'}`, '')
  parts.push(`I learned: ${review.learned || '—'}`, '')
  parts.push(`I spent too much energy on: ${review.tooMuchEnergyOn || '—'}`, '')
  parts.push(`I want more of: ${review.moreOf || '—'}`, '')
  parts.push(`I want less of: ${review.lessOf || '—'}`, '')
  if (review.continuingGoals.length) parts.push('Continuing:', ...review.continuingGoals.map((goal) => `- ${goal}`), '')
  if (review.releasedGoals.length) parts.push('Releasing:', ...review.releasedGoals.map((goal) => `- ${goal}`), '')
  return parts.join('\n')
}

export function dayToMarkdown(snapshot: JournalSnapshot, date: string): string {
  const day = snapshot.days.find((item) => item.date === date)
  const entries = dayEntries(snapshot.entries, date, day?.manualOrder ?? false)
  const parts = [`# ${formatDayHeading(date)}`, '']
  if (day && day.planItems.length > 0) {
    parts.push('## Plan', '')
    for (const item of day.planItems) {
      parts.push(`${item.time ? formatDisplayTime(item.time) : '–'} ${item.content}`)
    }
    parts.push('')
  }
  for (const entry of entries) {
    const time = entry.showTimestamp && entry.timestamp ? `${formatDisplayTime(entry.timestamp)}  ` : ''
    parts.push(`${time}${symbolChar(markForEntry(entry))} ${entry.content}`)
    if (entry.note) parts.push(`    ${entry.note}`)
  }
  return parts.join('\n')
}
