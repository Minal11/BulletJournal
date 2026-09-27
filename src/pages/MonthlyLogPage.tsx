import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { daysInMonth, formatMonthYear, isoDate, monthName, shiftMonth, todayISO, weekdayShort } from '../domain/dates.ts'
import { monthToMarkdown } from '../domain/markdown.ts'
import { downloadText } from '../lib/download.ts'
import { monthTasks } from '../domain/entries.ts'
import { goalsForMonth } from '../domain/goals.ts'
import { journal } from '../state/store.ts'
import { useJournal } from '../state/use-journal.ts'
import { Composer, EntryRow } from '../components/entries.tsx'
import { InkMark } from '../components/marks.tsx'
import { SortableList, SortableRow } from '../components/sortable.tsx'
import { EmptyNote } from '../components/ui.tsx'

export function MonthlyLogPage() {
  const { snapshot } = useJournal()
  const params = useParams()
  const today = todayISO()
  const year = Number(params.year)
  const month = Number(params.month)
  const safeYear = Number.isFinite(year) ? year : Number(today.slice(0, 4))
  const safeMonth = Number.isFinite(month) && month >= 1 && month <= 12 ? month : Number(today.slice(5, 7))
  const prev = shiftMonth(safeYear, safeMonth, -1)
  const next = shiftMonth(safeYear, safeMonth, 1)
  const log = snapshot.monthlyLogs.find((item) => item.year === safeYear && item.month === safeMonth)
  const tasks = monthTasks(snapshot.entries, safeYear, safeMonth)
  const goals = goalsForMonth(snapshot.goals, safeYear, safeMonth)
  const [adding, setAdding] = useState<number | null>(null)
  const [markText, setMarkText] = useState('')
  const [focusGoal, setFocusGoal] = useState(goals[0]?.id ?? '')
  const [focusText, setFocusText] = useState('')
  const total = daysInMonth(safeYear, safeMonth)
  const prefix = `${safeYear}-${String(safeMonth).padStart(2, '0')}`

  return (
    <article className="page">
      <header className="day-head">
        <Link className="page-turn" to={`/month/${prev.year}/${prev.month}`}>
          ←
        </Link>
        <div>
          <p className="kicker">Monthly log</p>
          <h1>{formatMonthYear(safeYear, safeMonth)}</h1>
          <p className="whisper">Month = focus</p>
        </div>
        <Link className="page-turn" to={`/month/${next.year}/${next.month}`}>
          →
        </Link>
      </header>
      <div className="page-body">
        <section>
          <h2>Calendar</h2>
          <ol className="month-list">
            {Array.from({ length: total }, (_, index) => {
              const day = index + 1
              const iso = isoDate(safeYear, safeMonth, day)
              const marks = log?.calendar.filter((mark) => mark.day === day) ?? []
              return (
                <li key={iso} className={iso === today ? 'cal-row is-today' : 'cal-row'}>
                  <Link to={iso === today ? '/' : `/day/${iso}`} className="cal-date">
                    <span>{day}</span>
                    <span>{weekdayShort(iso)}</span>
                  </Link>
                  <div className="cal-marks">
                    {marks.map((mark) => (
                      <span key={mark.id} className="cal-mark">
                        <InkMark name={mark.type === 'task' ? 'task' : mark.type === 'note' ? 'note' : 'event'} />
                        {mark.content}
                        <button type="button" aria-label="Remove this note" onClick={() => journal.removeCalendarMark(safeYear, safeMonth, mark.id)}>
                          ×
                        </button>
                      </span>
                    ))}
                    {adding === day ? (
                      <form
                        onSubmit={(event) => {
                          event.preventDefault()
                          journal.addCalendarMark(safeYear, safeMonth, day, markText, 'event')
                          setMarkText('')
                          setAdding(null)
                        }}
                      >
                        <input
                          className="ink-input"
                          autoFocus
                          aria-label={`Note beside ${monthName(safeMonth)} ${day}`}
                          value={markText}
                          placeholder="A moment or event"
                          onChange={(event) => setMarkText(event.target.value)}
                          onBlur={() => {
                            if (!markText.trim()) setAdding(null)
                          }}
                        />
                      </form>
                    ) : (
                      <button type="button" className="cal-add" aria-label={`Add a note on ${monthName(safeMonth)} ${day}`} onClick={() => setAdding(day)}>
                        +
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ol>
        </section>

        <section>
          <h2>Monthly goal focus</h2>
          {(!log || log.goalFocus.length === 0) && <EmptyNote>A few intentions for the month. Not a scorecard.</EmptyNote>}
          <ul className="focus-list">
            {(log?.goalFocus ?? []).map((focus) => {
              const goal = snapshot.goals.find((item) => item.id === focus.goalId)
              return (
                <li key={focus.id}>
                  {goal ? <Link to={`/goals/${goal.year}/${goal.quarter}`}>{goal.title}</Link> : <span>Goal</span>}
                  <input
                    className="ink-input"
                    aria-label="Focus"
                    value={focus.text}
                    onChange={(event) => journal.updateFocus(safeYear, safeMonth, focus.id, event.target.value)}
                  />
                  <button type="button" className="quiet-btn" aria-label="Remove focus" onClick={() => journal.removeFocus(safeYear, safeMonth, focus.id)}>
                    ×
                  </button>
                </li>
              )
            })}
          </ul>
          {goals.length > 0 && (
            <form
              className="inline-add"
              onSubmit={(event) => {
                event.preventDefault()
                if (!focusGoal || !focusText.trim()) return
                journal.addFocus(safeYear, safeMonth, { goalId: focusGoal, text: focusText.trim() })
                setFocusText('')
              }}
            >
              <div className="choice-row" role="radiogroup" aria-label="Goal for this focus">
                {goals.map((goal) => (
                  <button key={goal.id} type="button" className={focusGoal === goal.id ? 'choice on' : 'choice'} onClick={() => setFocusGoal(goal.id)}>
                    {goal.title}
                  </button>
                ))}
              </div>
              <input className="ink-input" placeholder="→ what this month is for" value={focusText} onChange={(event) => setFocusText(event.target.value)} />
            </form>
          )}
        </section>

        <section>
          <h2>{monthName(safeMonth)} tasks</h2>
          {tasks.length === 0 && <EmptyNote>Tasks for the month live here. Daily life stays in the log.</EmptyNote>}
          <SortableList ids={tasks.map((task) => task.id)} label="Monthly tasks" onReorder={(ids) => journal.reorderEntries(ids)}>
            {tasks.map((task) => (
              <SortableRow key={task.id} id={task.id}>
                <EntryRow entry={task} />
              </SortableRow>
            ))}
          </SortableList>
          <Composer date={`${prefix}-01`} scope="month" placeholder={`Add a ${monthName(safeMonth).toLowerCase()} task`} />
        </section>

        <p className="page-links">
          <Link to={`/reflection/${safeYear}/${safeMonth}`}>Monthly reflection</Link>
          <button
            type="button"
            className="quiet-btn"
            onClick={() => downloadText(`${monthName(safeMonth).toLowerCase()}-${safeYear}.md`, monthToMarkdown(snapshot, safeYear, safeMonth), 'text/markdown')}
          >
            Export month
          </button>
        </p>
      </div>
    </article>
  )
}
