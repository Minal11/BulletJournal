import { Link, useParams } from 'react-router-dom'
import { addDays, formatDayHeading, formatFriendlyDate, isISODate, isLastWeekOfMonth, monthOf, quarterOf, todayISO, weekdayShort, weekDates } from '../domain/dates.ts'
import { dayEntries } from '../domain/entries.ts'
import { goalsForMonth } from '../domain/goals.ts'
import { tasksAwaitingMigration } from '../domain/migration.ts'
import { journal } from '../state/store.ts'
import { useJournal } from '../state/use-journal.ts'
import { Composer, EntryRow, PlanBlock } from '../components/entries.tsx'
import { SortableList, SortableRow } from '../components/sortable.tsx'
import { EmptyNote } from '../components/ui.tsx'

export function TodayPage() {
  const { snapshot } = useJournal()
  const params = useParams()
  const today = todayISO()
  const date = params.date && isISODate(params.date) ? params.date : today
  const { year, month } = monthOf(date)
  const quarter = quarterOf(year, month)
  const day = snapshot.days.find((item) => item.date === date)
  const entries = dayEntries(snapshot.entries, date, day?.manualOrder ?? false)
  const carried = entries.filter((entry) => entry.migratedFromId && !entry.timestamp)
  const logged = entries.filter((entry) => !(entry.migratedFromId && !entry.timestamp))
  const log = snapshot.monthlyLogs.find((item) => item.year === year && item.month === month)
  const goals = goalsForMonth(snapshot.goals, year, month)
  const waiting = snapshot.futureItems.filter((item) => !item.reviewed && item.targetYear === year && item.targetMonth === month)
  const yesterdayOpen = snapshot.entries.filter(
    (entry) => entry.date === addDays(date, -1) && entry.scope === 'day' && entry.type === 'task' && entry.taskStatus === 'open',
  )
  const openThisMonth = tasksAwaitingMigration(snapshot.entries, year, month).length

  return (
    <article className="page">
      <header className="day-head today-head">
        <div className="today-title">
          <p className="kicker">{date === today ? 'Today' : formatFriendlyDate(date, snapshot.settings.dateFormat)}</p>
          <h1>{formatDayHeading(date)}</h1>
          <p className="whisper">Day = action + reality</p>
          <nav className="week-strip" aria-label="This week">
            {weekDates(date, snapshot.settings.firstDayOfWeek).map((dayDate) => (
              <Link key={dayDate} to={dayDate === today ? '/' : `/day/${dayDate}`} className={dayDate === date ? 'on' : undefined}>
                {weekdayShort(dayDate).slice(0, 1)} {monthOf(dayDate).day}
              </Link>
            ))}
          </nav>
        </div>
        <div className="today-turns">
          <Link className="page-turn" to={`/day/${addDays(date, -1)}`}>
            ← {weekdayShort(addDays(date, -1))}
          </Link>
          <Link className="page-turn" to={addDays(date, 1) === today ? '/' : `/day/${addDays(date, 1)}`}>
            {weekdayShort(addDays(date, 1))} →
          </Link>
        </div>
      </header>
      <div className="page-body">
        {waiting.length > 0 && (
          <aside className="margin-note">
            Something you scheduled for this month is still in the Future Log.{' '}
            <Link to="/future">Review it</Link> before moving it.
          </aside>
        )}
        {isLastWeekOfMonth(date) && openThisMonth > 0 && (
          <aside className="margin-note">
            This month is nearly done. A few tasks are still open.{' '}
            <Link to={`/reflection/${year}/${month}#migration`}>Walk through them</Link>.
          </aside>
        )}
        {log && log.goalFocus.length > 0 && (
          <section className="focus-strip">
            <h2>This month’s focus</h2>
            <ul>
              {log.goalFocus.map((focus) => {
                const goal = goals.find((item) => item.id === focus.goalId) ?? snapshot.goals.find((item) => item.id === focus.goalId)
                return (
                  <li key={focus.id}>
                    {goal ? <Link to={`/goals/${goal.year}/${goal.quarter}`}>{goal.title}</Link> : <span>Goal</span>}
                    <span> → {focus.text}</span>
                  </li>
                )
              })}
            </ul>
          </section>
        )}
        <PlanBlock date={date} />
        {carried.length > 0 && (
          <section>
            <h2>From yesterday</h2>
            {carried.map((entry) => (
              <EntryRow key={entry.id} entry={entry} />
            ))}
          </section>
        )}
        {yesterdayOpen.length > 0 && (
          <p className="whisper">
            Yesterday still has {yesterdayOpen.length} open {yesterdayOpen.length === 1 ? 'task' : 'tasks'}.{' '}
            <Link to={`/day/${addDays(date, -1)}`}>Look back</Link>
          </p>
        )}
        <section className="log-section">
          <div className="section-row">
            <h2>Log</h2>
            <button type="button" className="quiet-btn" onClick={() => journal.updateDay(date, { manualOrder: !(day?.manualOrder ?? false) })}>
              {day?.manualOrder ? 'Order by time' : 'Arrange by hand'}
            </button>
          </div>
          {logged.length === 0 && <EmptyNote>No entries yet. Start with what is on your mind.</EmptyNote>}
          {day?.manualOrder ? (
            <SortableList ids={logged.map((entry) => entry.id)} label="Daily log" onReorder={(ids) => journal.reorderEntries(ids)}>
              {logged.map((entry) => (
                <SortableRow key={entry.id} id={entry.id}>
                  <EntryRow entry={entry} />
                </SortableRow>
              ))}
            </SortableList>
          ) : (
            logged.map((entry) => <EntryRow key={entry.id} entry={entry} />)
          )}
        </section>
        <Composer date={date} />
        <nav className="page-links" aria-label="Nearby pages">
          <Link to={`/month/${year}/${month}`}>Monthly Log</Link>
          <Link to={`/goals/${quarter.year}/${quarter.quarter}`}>Goals</Link>
          <Link to="/collections">Collections</Link>
        </nav>
      </div>
    </article>
  )
}
