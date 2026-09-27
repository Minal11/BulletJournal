import { useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { monthOf, quarterLabel, quarterOf, quarterSpan, todayISO } from '../domain/dates.ts'
import { goalsForQuarter, GOAL_STATUS_LABEL, goalSymbol } from '../domain/goals.ts'
import type { Goal, Quarter } from '../domain/types.ts'
import { journal } from '../state/store.ts'
import { useJournal } from '../state/use-journal.ts'
import { SortableList, SortableRow } from '../components/sortable.tsx'
import { EmptyNote, InkField, LineList, PaperDialog } from '../components/ui.tsx'

function isQuarter(value: number): value is Quarter {
  return value === 1 || value === 2 || value === 3 || value === 4
}

export function GoalsRedirect() {
  const today = todayISO()
  const parts = monthOf(today)
  const quarter = quarterOf(parts.year, parts.month)
  return <Navigate to={`/goals/${quarter.year}/${quarter.quarter}`} replace />
}

export function GoalsPage() {
  const { snapshot } = useJournal()
  const params = useParams()
  const year = Number(params.year)
  const quarterNumber = Number(params.quarter)
  const quarter = isQuarter(quarterNumber) ? quarterNumber : 4
  const safeYear = Number.isFinite(year) ? year : 2026
  const goals = goalsForQuarter(snapshot.goals, safeYear, quarter)
  const [removing, setRemoving] = useState<string | null>(null)

  return (
    <article className="page">
      <header className="day-head">
        <div>
          <p className="kicker">Goals collection</p>
          <h1>
            {quarterLabel(safeYear, quarter)} Goals
          </h1>
          <p className="whisper">Quarter = direction · {quarterSpan(safeYear, quarter)}</p>
        </div>
      </header>
      <div className="page-body">
        <nav className="quarter-switch" aria-label="Quarters">
          {[1, 2, 3, 4].map((item) => (
            <Link key={item} to={`/goals/${safeYear}/${item}`} className={item === quarter ? 'on' : undefined}>
              Q{item}
            </Link>
          ))}
          <Link to={`/goals/${safeYear - 1}/${quarter}`}>{safeYear - 1}</Link>
          <Link to={`/goals/${safeYear + 1}/${quarter}`}>{safeYear + 1}</Link>
        </nav>
        {goals.length === 0 && <EmptyNote>A quarter can hold a handful of directions. Not a dozen projects.</EmptyNote>}
        <SortableList ids={goals.map((goal) => goal.id)} label="Goals" onReorder={(ids) => journal.reorderGoals(ids)}>
          {goals.map((goal, index) => (
            <SortableRow key={goal.id} id={goal.id}>
              <GoalArticle goal={goal} index={index + 1} entries={snapshot.entries} logs={snapshot.monthlyLogs} onRemove={() => setRemoving(goal.id)} />
            </SortableRow>
          ))}
        </SortableList>
        <button type="button" className="quiet-btn add-goal" onClick={() => journal.addGoal(safeYear, quarter)}>
          Add a goal
        </button>
        <p className="page-links">
          <Link to={`/review/${safeYear}/${quarter}`}>Quarterly review</Link>
        </p>
      </div>
      <PaperDialog
        open={Boolean(removing)}
        title="Let this goal leave the page?"
        confirmLabel="Remove goal"
        onClose={() => setRemoving(null)}
        onConfirm={() => {
          if (removing) journal.deleteGoal(removing)
          setRemoving(null)
        }}
      >
        <p>The daily lines that pointed here will stay. They just won’t be tied to this goal.</p>
      </PaperDialog>
    </article>
  )
}

function GoalArticle({
  goal,
  index,
  entries,
  logs,
  onRemove,
}: {
  goal: Goal
  index: number
  entries: ReturnType<typeof useJournal>['snapshot']['entries']
  logs: ReturnType<typeof useJournal>['snapshot']['monthlyLogs']
  onRemove: () => void
}) {
  const related = entries.filter((entry) => entry.goalIds.includes(goal.id)).slice(0, 8)
  const focuses = logs.flatMap((log) => log.goalFocus.filter((focus) => focus.goalId === goal.id).map((focus) => ({ ...focus, year: log.year, month: log.month })))
  const today = todayISO()

  return (
    <article className="goal">
      <header className="goal-head">
        <p className="kicker">{index}.</p>
        <input
          className="goal-title"
          aria-label="Goal name"
          value={goal.title}
          placeholder="Name"
          onChange={(event) => journal.updateGoal(goal.id, { title: event.target.value, category: event.target.value })}
        />
        <button type="button" className="status-btn" onClick={() => journal.cycleGoal(goal.id)} aria-label={`Status ${GOAL_STATUS_LABEL[goal.status]}. Change status.`}>
          <span aria-hidden="true">{goalSymbol(goal.status)}</span> {GOAL_STATUS_LABEL[goal.status]}
        </button>
      </header>
      <InkField label="Goal" value={goal.goalText} onChange={(goalText) => journal.updateGoal(goal.id, { goalText })} rows={2} />
      <InkField label="Why" value={goal.why} onChange={(why) => journal.updateGoal(goal.id, { why })} rows={2} />
      <LineList label="Measures / signs of progress" items={goal.measures} onChange={(measures) => journal.updateGoal(goal.id, { measures })} />
      <div className="line-list">
        <h3>Next actions</h3>
        {(goal.nextActions.length ? goal.nextActions : ['']).map((action, actionIndex) => (
          <div className="line-row" key={`${goal.id}-action-${actionIndex}`}>
            <span aria-hidden="true">•</span>
            <input
              className="ink-input"
              value={action}
              aria-label={`Next action ${actionIndex + 1}`}
              onChange={(event) => {
                const next = goal.nextActions.length ? goal.nextActions.slice() : ['']
                next[actionIndex] = event.target.value
                journal.updateGoal(goal.id, { nextActions: next })
              }}
            />
            {action.trim() && (
              <button
                type="button"
                className="quiet-btn"
                onClick={() =>
                  journal.addEntry({
                    date: today,
                    content: action,
                    type: 'task',
                    goalIds: [goal.id],
                    timestamp: null,
                    showTimestamp: false,
                  })
                }
              >
                → today
              </button>
            )}
          </div>
        ))}
        <button type="button" className="quiet-btn" onClick={() => journal.updateGoal(goal.id, { nextActions: [...goal.nextActions, ''] })}>
          Another action
        </button>
      </div>
      <InkField label="Notes" value={goal.notes} onChange={(notes) => journal.updateGoal(goal.id, { notes })} rows={2} placeholder="Optional" />
      <p className="whisper">
        <button type="button" className="quiet-btn" onClick={onRemove}>
          Remove this goal
        </button>
      </p>
      {focuses.length > 0 && (
        <div>
          <h3>Seen in a month</h3>
          <ul className="plain-list">
            {focuses.map((focus) => (
              <li key={focus.id}>
                <Link to={`/month/${focus.year}/${focus.month}`}>
                  → {focus.text}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      {related.length > 0 && (
        <div>
          <h3>Seen in the log</h3>
          <ul className="plain-list">
            {related.map((entry) => (
              <li key={entry.id}>
                <Link to={entry.date === today ? '/' : `/day/${entry.date}`}>{entry.content}</Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  )
}
