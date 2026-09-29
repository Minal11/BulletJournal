import { useState } from 'react'
import { daysInMonth, isoDate, monthName, monthOf, shiftMonth, todayISO } from '../domain/dates.ts'
import { habitActiveInMonth, habitChecked, habitSummary, monthHabits } from '../domain/habits.ts'
import type { Habit } from '../domain/types.ts'
import { journal } from '../state/store.ts'
import { useJournal } from '../state/use-journal.ts'
import { EmptyNote } from '../components/ui.tsx'

export function HabitsPage() {
  const { snapshot } = useJournal()
  const today = todayISO()
  const current = monthOf(today)
  const [cursor, setCursor] = useState({ year: current.year, month: current.month })
  const [managing, setManaging] = useState(false)
  const habits = monthHabits(snapshot, cursor.year, cursor.month)
  const days = daysInMonth(cursor.year, cursor.month)
  const previous = shiftMonth(cursor.year, cursor.month, -1)
  const next = shiftMonth(cursor.year, cursor.month, 1)

  return (
    <article className="page">
      <header className="day-head">
        <div>
          <p className="kicker">Habit tracker</p>
          <h1>
            <button type="button" className="quiet-btn" aria-label="Previous month" onClick={() => setCursor(previous)}>
              ‹
            </button>{' '}
            {monthName(cursor.month)} {cursor.year}{' '}
            <button type="button" className="quiet-btn" aria-label="Next month" onClick={() => setCursor(next)}>
              ›
            </button>
          </h1>
        </div>
        <button type="button" className="quiet-btn" onClick={() => setManaging((value) => !value)}>
          {managing ? 'Close habits' : 'Manage habits'}
        </button>
      </header>
      <div className="page-body">
        {managing && <HabitManager year={cursor.year} month={cursor.month} />}
        {habits.length === 0 && <EmptyNote>Choose the habits you want on this month. They do not carry forward on their own.</EmptyNote>}
        {habits.length > 0 && (
          <>
            <div className="habit-scroll">
              <table className="habit-grid">
                <thead>
                  <tr>
                    <th>Date</th>
                    {habits.map((habit) => (
                      <th key={habit.id}>{habit.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: days }, (_, index) => {
                    const day = index + 1
                    const date = isoDate(cursor.year, cursor.month, day)
                    return (
                      <tr key={date}>
                        <th>{day}</th>
                        {habits.map((habit) => {
                          const checked = habitChecked(snapshot.habitLogs, habit.id, date)
                          return (
                            <td key={habit.id}>
                              <button
                                type="button"
                                className="habit-check"
                                aria-pressed={checked}
                                aria-label={`${habit.name} on ${date}`}
                                onClick={() => journal.toggleHabit(habit.id, date)}
                              >
                                {checked ? '✓' : '☐'}
                              </button>
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <ul className="plain-list">
              {habits.map((habit) => {
                const summary = habitSummary(snapshot.habitLogs, habit.id, cursor.year, cursor.month, days)
                return (
                  <li key={habit.id}>
                    {habit.name} {summary.done} / {summary.days}
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </div>
    </article>
  )
}

function HabitManager({ year, month }: { year: number; month: number }) {
  const { snapshot } = useJournal()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [activeFrom, setActiveFrom] = useState(isoDate(year, month, 1))
  const [carry, setCarry] = useState(false)
  const today = todayISO()

  return (
    <section>
      <h2>Habits</h2>
      <form
        className="composer"
        onSubmit={(event) => {
          event.preventDefault()
          const habit = journal.addHabit({ name, description, activeFrom, defaultForFutureMonths: carry })
          if (!habit) return
          if (carry) journal.setHabitMonth(habit.id, year, month, true)
          setName('')
          setDescription('')
          setCarry(false)
        }}
      >
        <input className="composer-input" aria-label="Habit name" placeholder="Name" value={name} onChange={(event) => setName(event.target.value)} />
        <input className="ink-input" aria-label="Habit description" placeholder="Description, if you want one" value={description} onChange={(event) => setDescription(event.target.value)} />
        <label className="whisper">
          Start{' '}
          <input type="date" aria-label="Start date" value={activeFrom} onChange={(event) => setActiveFrom(event.target.value)} />
        </label>
        <label className="whisper">
          <input type="checkbox" checked={carry} onChange={(event) => setCarry(event.target.checked)} /> Suggest for later months
        </label>
        <button type="submit" className="quiet-btn">
          Add habit
        </button>
      </form>
      <ul className="plain-list">
        {snapshot.habits.map((habit) => (
          <HabitRow key={habit.id} habit={habit} year={year} month={month} today={today} />
        ))}
      </ul>
    </section>
  )
}

function HabitRow({ habit, year, month, today }: { habit: Habit; year: number; month: number; today: string }) {
  const { snapshot } = useJournal()
  const selected = snapshot.habitMonths.some((item) => item.habitId === habit.id && item.year === year && item.month === month && item.enabled)
  const stopped = Boolean(habit.inactiveFrom) || habit.archived
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(habit.name)
  return (
    <li>
      <p>
        {editing ? (
          <input className="ink-input" aria-label="Habit name" value={name} onChange={(event) => setName(event.target.value)} />
        ) : (
          habit.name
        )}
        {habit.description && <span className="whisper"> — {habit.description}</span>}
        {stopped && <span className="whisper"> · paused</span>}
      </p>
      <p className="page-links">
        <label className="whisper">
          <input
            type="checkbox"
            checked={selected}
            aria-label={`Track ${habit.name} in ${monthName(month)}`}
            onChange={(event) => journal.setHabitMonth(habit.id, year, month, event.target.checked)}
          />{' '}
          This month
        </label>
        {editing ? (
          <button
            type="button"
            className="quiet-btn"
            onClick={() => {
              journal.updateHabit(habit.id, { name })
              setEditing(false)
            }}
          >
            Save
          </button>
        ) : (
          <button type="button" className="quiet-btn" onClick={() => setEditing(true)}>
            Edit
          </button>
        )}
        {stopped ? (
          <button type="button" className="quiet-btn" onClick={() => journal.updateHabit(habit.id, { inactiveFrom: null, archived: false })}>
            Reactivate
          </button>
        ) : (
          <button type="button" className="quiet-btn" onClick={() => journal.updateHabit(habit.id, { inactiveFrom: today })}>
            Pause
          </button>
        )}
        {!habit.archived && (
          <button type="button" className="quiet-btn" onClick={() => journal.updateHabit(habit.id, { archived: true, inactiveFrom: habit.inactiveFrom ?? today })}>
            Archive
          </button>
        )}
        {habitActiveInMonth(habit, year, month) ? null : <span className="whisper">Not active this month</span>}
      </p>
    </li>
  )
}
