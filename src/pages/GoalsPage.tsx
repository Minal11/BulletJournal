import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { monthOf, quarterLabel, quarterOf, quarterSpan, todayISO } from '../domain/dates.ts'
import { goalProgress } from '../domain/goal-progress.ts'
import { blankGoal, goalsForQuarter, GOAL_STATUS_LABEL, goalSymbol, nextGoalStatus } from '../domain/goals.ts'
import { defaultGoalOpen, goalHeaderShouldToggle } from '../lib/goal-ui.ts'
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
  const [creating, setCreating] = useState<Goal | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

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
              <GoalArticle goal={goal} index={index + 1} goalCount={goals.length} entries={snapshot.entries} logs={snapshot.monthlyLogs} onRemove={() => setRemoving(goal.id)} />
            </SortableRow>
          ))}
        </SortableList>
        {creating && (
          <GoalArticle
            goal={creating}
            index={goals.length + 1}
            goalCount={goals.length}
            entries={snapshot.entries}
            logs={snapshot.monthlyLogs}
            persist={false}
            saveError={saveError}
            onRemove={() => {
              setCreating(null)
              setSaveError(null)
            }}
            onSave={async (draft) => {
              if (!draft.title.trim() && !draft.goalText.trim()) {
                setSaveError('Give the goal a name or a line before saving.')
                return
              }
              journal.insertGoal({ ...draft, updatedAt: new Date().toISOString() })
              await journal.flush()
              if (journal.getSnapshot().error) {
                setSaveError("Couldn't save this goal locally. Your text is still here.")
                return
              }
              setSaveError(null)
              setCreating(null)
            }}
          />
        )}
        <button
          type="button"
          className="quiet-btn add-goal"
          onClick={() => {
            if (creating) return
            setSaveError(null)
            setCreating(blankGoal(safeYear, quarter, goals.length))
          }}
        >
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
  goalCount,
  entries,
  logs,
  onRemove,
  persist = true,
  saveError,
  onSave,
}: {
  goal: Goal
  index: number
  goalCount: number
  entries: ReturnType<typeof useJournal>['snapshot']['entries']
  logs: ReturnType<typeof useJournal>['snapshot']['monthlyLogs']
  onRemove: () => void
  persist?: boolean
  saveError?: string | null
  onSave?: (draft: Goal) => void
}) {
  const [draft, setDraft] = useState(goal)
  const [open, setOpen] = useState(() => (persist ? storedGoalOpen(goal.id, goalCount) : true))
  const [taskText, setTaskText] = useState('')
  const [boundId, setBoundId] = useState(goal.id)
  if (goal.id !== boundId) {
    setBoundId(goal.id)
    setDraft(goal)
  }
  useEffect(() => {
    if (!persist || draft.id !== goal.id) return
    if (
      draft.title === goal.title &&
      draft.category === goal.category &&
      draft.goalText === goal.goalText &&
      draft.why === goal.why &&
      draft.notes === goal.notes &&
      draft.status === goal.status &&
      draft.year === goal.year &&
      draft.quarter === goal.quarter &&
      draft.startDate === goal.startDate &&
      draft.measures.join('\n') === goal.measures.join('\n') &&
      draft.nextActions.join('\n') === goal.nextActions.join('\n')
    ) {
      return
    }
    const handle = window.setTimeout(() => journal.updateGoal(draft.id, draft), 400)
    return () => window.clearTimeout(handle)
  }, [draft, persist, goal])
  const related = entries.filter((entry) => entry.goalIds.includes(goal.id)).slice(0, 8)
  const focuses = logs.flatMap((log) => log.goalFocus.filter((focus) => focus.goalId === goal.id).map((focus) => ({ ...focus, year: log.year, month: log.month })))
  const today = todayISO()
  const actions = draft.nextActions.length ? draft.nextActions : ['']

  const progress = goalProgress(entries, goal.id)
  const linked = entries.filter((entry) => entry.type === 'task' && entry.goalIds.includes(goal.id) && (entry.taskStatus === 'open' || entry.taskStatus === 'complete'))
  function toggle() {
    setOpen((current) => {
      const next = !current
      rememberGoalOpen(goal.id, next)
      return next
    })
  }

  return (
    <article className={open ? 'goal is-open' : 'goal'}>
      <header
        className="goal-head"
        onClick={(event) => {
          if (goalHeaderShouldToggle((event.target as HTMLElement).tagName)) toggle()
        }}
      >
        <button type="button" className="goal-chevron" aria-expanded={open} aria-label={open ? 'Collapse goal' : 'Expand goal'} onClick={toggle}>
          {open ? '▾' : '▸'}
        </button>
        <p className="kicker">{index}.</p>
        <input
          className="goal-title"
          aria-label="Goal name"
          value={draft.title}
          placeholder="Name"
          onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
        />
        <button
          type="button"
          className="status-btn"
          onClick={() => setDraft((current) => ({ ...current, status: nextGoalStatus(current.status) }))}
          aria-label={`Status ${GOAL_STATUS_LABEL[draft.status]}. Change status.`}
        >
          <span aria-hidden="true">{goalSymbol(draft.status)}</span> {GOAL_STATUS_LABEL[draft.status]}
        </button>
        <p className="whisper goal-meta">
          {draft.category || 'Goal'} · Q{draft.quarter}
        </p>
        <GoalMeter progress={progress} />
      </header>
      <div className="goal-fold" inert={!open ? true : undefined}>
      <div>
      <label className="field">
        <span>Category</span>
        <input className="ink-input" aria-label="Category" value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))} />
      </label>
      <div className="choice-row">
        <label className="whisper">
          Year{' '}
          <input className="ink-input" aria-label="Year" type="number" value={draft.year} onChange={(event) => setDraft((current) => ({ ...current, year: Number(event.target.value) || current.year }))} />
        </label>
        <label className="whisper">
          Quarter{' '}
          <select aria-label="Quarter" value={draft.quarter} onChange={(event) => setDraft((current) => ({ ...current, quarter: Number(event.target.value) as Goal['quarter'] }))}>
            <option value={1}>Q1</option>
            <option value={2}>Q2</option>
            <option value={3}>Q3</option>
            <option value={4}>Q4</option>
          </select>
        </label>
        <label className="whisper">
          Start date{' '}
          <input className="ink-input" aria-label="Start date" type="date" value={draft.startDate ?? ''} onChange={(event) => setDraft((current) => ({ ...current, startDate: event.target.value || null }))} />
        </label>
      </div>
      <InkField live label="Goal" value={draft.goalText} onChange={(goalText) => setDraft((current) => ({ ...current, goalText }))} rows={2} />
      <InkField live label="Why" value={draft.why} onChange={(why) => setDraft((current) => ({ ...current, why }))} rows={2} />
      <LineList label="Measures / signs of progress" items={draft.measures} onChange={(measures) => setDraft((current) => ({ ...current, measures }))} />
      {persist ? (
        <div className="line-list">
          <h3>Tasks</h3>
          {linked.length === 0 && <p className="whisper">No tasks yet</p>}
          <ul className="plain-list">
            {linked.map((entry) => (
              <li key={entry.id}>
                {entry.taskStatus === 'complete' ? 'X' : '•'} {entry.content}
                {!entry.date && <span className="whisper"> · Master tasks</span>}
              </li>
            ))}
          </ul>
          <form
            className="composer compact"
            onSubmit={(event) => {
              event.preventDefault()
              const created = journal.addMasterTask({ content: taskText, goalIds: [goal.id] })
              if (created) setTaskText('')
            }}
          >
            <input className="composer-input" aria-label="Add a task for this goal" placeholder="Add a task" value={taskText} onChange={(event) => setTaskText(event.target.value)} />
          </form>
        </div>
      ) : (
      <div className="line-list">
        <h3>Next actions</h3>
        {actions.map((action, actionIndex) => (
          <div className="line-row" key={`${draft.id}-action-${actionIndex}`}>
            <span aria-hidden="true">•</span>
            <input
              className="ink-input"
              value={action}
              aria-label={`Next action ${actionIndex + 1}`}
              onChange={(event) => {
                const next = actions.slice()
                next[actionIndex] = event.target.value
                setDraft((current) => ({ ...current, nextActions: next }))
              }}
            />
            {persist && action.trim() && (
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
        <button type="button" className="quiet-btn" onClick={() => setDraft((current) => ({ ...current, nextActions: [...actions, ''] }))}>
          Another action
        </button>
      </div>
      )}
      <InkField live label="Notes" value={draft.notes} onChange={(notes) => setDraft((current) => ({ ...current, notes }))} rows={2} placeholder="Optional" />
      {!persist && (
        <p className="page-links">
          <button type="button" className="quiet-btn" onClick={() => onSave?.(draft)}>
            Save
          </button>
          <button type="button" className="quiet-btn" onClick={onRemove}>
            Cancel
          </button>
        </p>
      )}
      {saveError && <p className="composer-error">{saveError}</p>}
      {persist && (
        <p className="whisper">
          <button type="button" className="quiet-btn" onClick={onRemove}>
            Remove this goal
          </button>
        </p>
      )}
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
                <Link to={!entry.date ? '/tasks' : entry.date === today ? '/' : `/day/${entry.date}`}>{entry.content}</Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      </div>
      </div>
    </article>
  )
}

function GoalMeter({ progress }: { progress: ReturnType<typeof goalProgress> }) {
  if (progress.percent === null) return <p className="goal-meter whisper">No tasks yet</p>
  return (
    <p className="goal-meter">
      <span className="goal-bar" style={{ ['--goal-progress' as string]: `${progress.percent}%` }} aria-hidden="true" />
      <span>{progress.percent}%</span>
    </p>
  )
}

function storedGoalOpen(id: string, goalCount: number): boolean {
  try {
    const raw = localStorage.getItem('bj-open-goals')
    const map = raw ? (JSON.parse(raw) as Record<string, boolean>) : {}
    if (id in map) return Boolean(map[id])
  } catch {
    /* keep the default */
  }
  return defaultGoalOpen(goalCount)
}

function rememberGoalOpen(id: string, open: boolean) {
  try {
    const raw = localStorage.getItem('bj-open-goals')
    const map = raw ? (JSON.parse(raw) as Record<string, boolean>) : {}
    map[id] = open
    localStorage.setItem('bj-open-goals', JSON.stringify(map))
  } catch {
    /* the page still toggles for this visit */
  }
}
