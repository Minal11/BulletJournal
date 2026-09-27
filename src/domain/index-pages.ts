import { formatMonthYear, quarterLabel } from './dates.ts'
import type { IndexOverride, IndexRow, JournalSnapshot } from './types.ts'

function overrideOf(overrides: IndexOverride[], id: string): IndexOverride | undefined {
  return overrides.find((item) => item.id === id)
}

export function buildIndex(snapshot: JournalSnapshot): IndexRow[] {
  const rows: IndexRow[] = []
  const push = (row: Omit<IndexRow, 'pinned' | 'hidden' | 'sortOrder'> & { defaultOrder: number }) => {
    const custom = overrideOf(snapshot.indexOverrides, row.id)
    rows.push({
      id: row.id,
      label: row.label,
      route: row.route,
      kind: row.kind,
      pinned: custom?.pinned ?? false,
      hidden: custom?.hidden ?? false,
      sortOrder: custom?.sortOrder ?? row.defaultOrder,
    })
  }

  push({ id: 'future', label: 'Future Log', route: '/future', kind: 'future', defaultOrder: 0 })

  const quarters = new Map<string, { year: number; quarter: 1 | 2 | 3 | 4 }>()
  for (const goal of snapshot.goals) quarters.set(`${goal.year}-${goal.quarter}`, { year: goal.year, quarter: goal.quarter })
  for (const review of snapshot.reviews) quarters.set(`${review.year}-${review.quarter}`, { year: review.year, quarter: review.quarter })
  const quarterList = [...quarters.values()].sort((a, b) => b.year - a.year || b.quarter - a.quarter)
  quarterList.forEach((quarter, index) => {
    push({
      id: `goals-${quarter.year}-${quarter.quarter}`,
      label: `${quarterLabel(quarter.year, quarter.quarter)} Goals`,
      route: `/goals/${quarter.year}/${quarter.quarter}`,
      kind: 'goals',
      defaultOrder: 10 + index,
    })
  })

  const months = new Map<string, { year: number; month: number }>()
  for (const log of snapshot.monthlyLogs) months.set(`${log.year}-${log.month}`, { year: log.year, month: log.month })
  for (const reflection of snapshot.reflections) {
    months.set(`${reflection.year}-${reflection.month}`, { year: reflection.year, month: reflection.month })
  }
  for (const entry of snapshot.entries) {
    const [year, month] = entry.date.split('-').map(Number)
    if (year && month) months.set(`${year}-${month}`, { year, month })
  }
  const monthList = [...months.values()].sort((a, b) => b.year - a.year || b.month - a.month)
  monthList.forEach((month, index) => {
    push({
      id: `month-${month.year}-${month.month}`,
      label: formatMonthYear(month.year, month.month),
      route: `/month/${month.year}/${month.month}`,
      kind: 'month',
      defaultOrder: 100 + index,
    })
    const reflection = snapshot.reflections.find((item) => item.year === month.year && item.month === month.month)
    if (reflection) {
      push({
        id: `reflection-${month.year}-${month.month}`,
        label: `${formatMonthYear(month.year, month.month)} Reflection`,
        route: `/reflection/${month.year}/${month.month}`,
        kind: 'reflection',
        defaultOrder: 200 + index,
      })
    }
  })

  const reviews = snapshot.reviews.slice().sort((a, b) => b.year - a.year || b.quarter - a.quarter)
  reviews.forEach((review, index) => {
    push({
      id: `review-${review.year}-${review.quarter}`,
      label: `${quarterLabel(review.year, review.quarter)} Review`,
      route: `/review/${review.year}/${review.quarter}`,
      kind: 'review',
      defaultOrder: 300 + index,
    })
  })

  const collections = snapshot.collections
    .filter((collection) => !collection.archived || collection.pinned)
    .slice()
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.title.localeCompare(b.title))
  collections.forEach((collection, index) => {
    push({
      id: `collection-${collection.id}`,
      label: collection.title || 'Untitled page',
      route: `/collections/${collection.id}`,
      kind: 'collection',
      defaultOrder: 400 + index,
    })
  })

  return rows.sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.sortOrder - b.sortOrder || a.label.localeCompare(b.label))
}

export function visibleIndex(rows: IndexRow[], showHidden = false): IndexRow[] {
  return showHidden ? rows : rows.filter((row) => !row.hidden)
}
