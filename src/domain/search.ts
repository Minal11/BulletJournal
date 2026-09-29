import { formatDisplayTime, formatShortDate, monthName, quarterLabel } from './dates.ts'
import { symbolChar, markForEntry } from './bullets.ts'
import type { JournalSnapshot, SearchFilters, SearchHit } from './types.ts'

function includes(text: string, query: string): boolean {
  return text.toLowerCase().includes(query)
}

function entryFiltersActive(filters: SearchFilters): boolean {
  return (
    filters.types.length > 0 ||
    filters.completed ||
    filters.migrated ||
    filters.starred ||
    Boolean(filters.collectionId) ||
    Boolean(filters.goalId) ||
    Boolean(filters.tag) ||
    Boolean(filters.from) ||
    Boolean(filters.to)
  )
}

export function searchJournal(snapshot: JournalSnapshot, filters: SearchFilters): SearchHit[] {
  const query = filters.query.trim().toLowerCase()
  const hits: SearchHit[] = []
  const narrow = entryFiltersActive(filters)

  for (const entry of snapshot.entries) {
    if (filters.types.length > 0 && !filters.types.includes(entry.type)) continue
    if (filters.completed && !(entry.type === 'task' && entry.taskStatus === 'complete')) continue
    if (filters.migrated && entry.taskStatus !== 'migrated') continue
    if (filters.starred && !entry.signifiers.includes('important')) continue
    if (filters.collectionId && !entry.collectionIds.includes(filters.collectionId)) continue
    if (filters.goalId && !entry.goalIds.includes(filters.goalId)) continue
    if (filters.tag && !entry.tags.includes(filters.tag.toLowerCase())) continue
    if ((filters.from || filters.to) && !entry.date) continue
    if (filters.from && entry.date && entry.date < filters.from) continue
    if (filters.to && entry.date && entry.date > filters.to) continue
    const haystack = `${entry.content} ${entry.note} ${entry.tags.join(' ')}`
    if (query && !includes(haystack, query)) continue
    const time = entry.showTimestamp && entry.timestamp ? ` · ${formatDisplayTime(entry.timestamp)}` : ''
    hits.push({
      id: entry.id,
      kind: 'entry',
      route: entry.date ? `/day/${entry.date}` : '/tasks',
      meta: entry.date ? `${formatShortDate(entry.date)}${time}` : `Master tasks${time}`,
      symbol: symbolChar(markForEntry(entry)),
      text: entry.content,
    })
  }

  for (const item of snapshot.futureItems) {
    if (filters.types.length > 0 && !filters.types.includes(item.type)) continue
    if (filters.starred && !item.signifiers.includes('important')) continue
    if (filters.completed || filters.migrated || filters.collectionId || filters.goalId || filters.tag) continue
    if (query && !includes(item.content, query)) continue
    hits.push({
      id: item.id,
      kind: 'future',
      route: '/future',
      meta: `${monthName(item.targetMonth)} ${item.targetYear} · Future Log`,
      symbol: item.type === 'event' ? '○' : item.type === 'note' ? '–' : '•',
      text: item.content,
    })
  }

  if (!narrow) {
    for (const collection of snapshot.collections) {
      const haystack = `${collection.title} ${collection.description} ${collection.content} ${collection.tags.join(' ')} ${collection.bullets.map((bullet) => bullet.content).join(' ')}`
      if (query && !includes(haystack, query)) continue
      if (!query && filters.query.trim()) continue
      hits.push({
        id: collection.id,
        kind: 'collection',
        route: `/collections/${collection.id}`,
        meta: 'Collection',
        symbol: '–',
        text: collection.title,
      })
    }
    for (const goal of snapshot.goals) {
      const haystack = `${goal.title} ${goal.goalText} ${goal.why} ${goal.notes} ${goal.measures.join(' ')} ${goal.nextActions.join(' ')}`
      if (query && !includes(haystack, query)) continue
      hits.push({
        id: goal.id,
        kind: 'goal',
        route: `/goals/${goal.year}/${goal.quarter}`,
        meta: quarterLabel(goal.year, goal.quarter),
        symbol: '●',
        text: goal.title || goal.goalText,
      })
    }
    for (const reflection of snapshot.reflections) {
      const haystack = `${reflection.learned} ${reflection.monthInOneSentence} ${reflection.wentWell.proud} ${reflection.feltHeavy.drained}`
      if (query && !includes(haystack, query)) continue
      hits.push({
        id: reflection.id,
        kind: 'reflection',
        route: `/reflection/${reflection.year}/${reflection.month}`,
        meta: 'Reflection',
        symbol: '–',
        text: reflection.monthInOneSentence || `${monthName(reflection.month)} reflection`,
      })
    }
    for (const habit of snapshot.habits ?? []) {
      const haystack = `${habit.name} ${habit.description}`
      if (query && !includes(haystack, query)) continue
      hits.push({
        id: habit.id,
        kind: 'habit',
        route: '/habits',
        meta: 'Habit',
        symbol: '☐',
        text: habit.name,
      })
    }
    for (const review of snapshot.reviews) {
      const haystack = `${review.proudOf} ${review.learned} ${review.moreOf} ${review.lessOf} ${review.goalReviews.map((item) => item.happened).join(' ')}`
      if (query && !includes(haystack, query)) continue
      hits.push({
        id: review.id,
        kind: 'review',
        route: `/review/${review.year}/${review.quarter}`,
        meta: 'Quarterly review',
        symbol: '–',
        text: review.proudOf || `${quarterLabel(review.year, review.quarter)} review`,
      })
    }
  }

  if (!query && !narrow) return []
  return hits.slice(0, 80)
}
