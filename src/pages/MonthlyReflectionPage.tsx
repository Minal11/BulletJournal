import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { dateInMonth, formatMonthYear, formatShortDate, monthName } from '../domain/dates.ts'
import { CHECKIN_LABEL, goalsForMonth, moodSymbol, nextMood } from '../domain/goals.ts'
import { journalPatterns } from '../domain/insights.ts'
import { tasksAwaitingMigration } from '../domain/migration.ts'
import type { JournalEntry, MigrationAction, MonthlyReflection } from '../domain/types.ts'
import { journal } from '../state/store.ts'
import { useJournal } from '../state/use-journal.ts'
import { InkMark } from '../components/marks.tsx'
import { EmptyNote, InkField, LineList } from '../components/ui.tsx'

export function MonthlyReflectionPage() {
  const { snapshot } = useJournal()
  const params = useParams()
  const year = Number(params.year)
  const month = Number(params.month)
  useEffect(() => {
    if (Number.isFinite(year) && Number.isFinite(month)) journal.ensureReflection(year, month)
  }, [year, month, snapshot.goals.length])

  const reflection = snapshot.reflections.find((item) => item.year === year && item.month === month)
  if (!reflection || !Number.isFinite(year) || month < 1 || month > 12) {
    return (
      <article className="page">
        <div className="page-body">
          <EmptyNote>Opening the reflection…</EmptyNote>
        </div>
      </article>
    )
  }

  const goals = goalsForMonth(snapshot.goals, year, month)
  const monthEntries = snapshot.entries.filter((entry) => entry.date && dateInMonth(entry.date, year, month))
  const patterns = journalPatterns(monthEntries)
  const memories = reflection.memoryEntryIds
    .map((id) => snapshot.entries.find((entry) => entry.id === id))
    .filter((entry): entry is JournalEntry & { date: string } => Boolean(entry?.date))
  const waiting = tasksAwaitingMigration(snapshot.entries, year, month)
  const patch = (recipe: (current: MonthlyReflection) => MonthlyReflection) => journal.updateReflection(reflection.id, recipe)

  return (
    <article className="page">
      <header className="day-head">
        <div>
          <p className="kicker">Monthly reflection</p>
          <h1>{formatMonthYear(year, month)}</h1>
        </div>
      </header>
      <div className="page-body reflection">
        <section>
          <h2>1. Big moments</h2>
          <LineList symbol="○" items={reflection.bigMoments} onChange={(bigMoments) => patch((current) => ({ ...current, bigMoments }))} />
        </section>
        <section>
          <h2>2. What went well?</h2>
          <InkField label="What am I proud of?" value={reflection.wentWell.proud} onChange={(proud) => patch((current) => ({ ...current, wentWell: { ...current.wentWell, proud } }))} />
          <InkField label="What felt easier this month?" value={reflection.wentWell.easier} onChange={(easier) => patch((current) => ({ ...current, wentWell: { ...current.wentWell, easier } }))} />
          <InkField label="What habits or routines helped?" value={reflection.wentWell.habits} onChange={(habits) => patch((current) => ({ ...current, wentWell: { ...current.wentWell, habits } }))} />
          <InkField label="What did I actually finish?" value={reflection.wentWell.finished} onChange={(finished) => patch((current) => ({ ...current, wentWell: { ...current.wentWell, finished } }))} />
        </section>
        <section>
          <h2>3. What felt heavy?</h2>
          <InkField label="What drained my energy?" value={reflection.feltHeavy.drained} onChange={(drained) => patch((current) => ({ ...current, feltHeavy: { ...current.feltHeavy, drained } }))} />
          <InkField label="What kept getting postponed?" value={reflection.feltHeavy.postponed} onChange={(postponed) => patch((current) => ({ ...current, feltHeavy: { ...current.feltHeavy, postponed } }))} />
          <InkField label="What created stress?" value={reflection.feltHeavy.stress} onChange={(stress) => patch((current) => ({ ...current, feltHeavy: { ...current.feltHeavy, stress } }))} />
          <InkField label="Where did I overcommit?" value={reflection.feltHeavy.overcommit} onChange={(overcommit) => patch((current) => ({ ...current, feltHeavy: { ...current.feltHeavy, overcommit } }))} />
        </section>
        <section>
          <h2>4. What did I learn?</h2>
          <InkField label="Notes" value={reflection.learned} onChange={(learned) => patch((current) => ({ ...current, learned }))} rows={5} />
        </section>
        <section>
          <h2>5. Goal check-in</h2>
          {goals.length === 0 && <EmptyNote>This month’s quarter doesn’t have goals yet.</EmptyNote>}
          {reflection.goalCheckIns.map((check) => {
            const goal = goals.find((item) => item.id === check.goalId)
            if (!goal) return null
            return (
              <article key={check.goalId} className="check-in">
                <header>
                  <h3>{goal.title}</h3>
                  <button
                    type="button"
                    className="status-btn"
                    onClick={() =>
                      patch((current) => ({
                        ...current,
                        goalCheckIns: current.goalCheckIns.map((item) => (item.goalId === check.goalId ? { ...item, mood: nextMood(item.mood) } : item)),
                      }))
                    }
                  >
                    {moodSymbol(check.mood)} {CHECKIN_LABEL[check.mood]}
                  </button>
                </header>
                <InkField
                  label={`${monthName(month)} progress`}
                  value={check.progress}
                  onChange={(progress) =>
                    patch((current) => ({
                      ...current,
                      goalCheckIns: current.goalCheckIns.map((item) => (item.goalId === check.goalId ? { ...item, progress } : item)),
                    }))
                  }
                />
                <InkField
                  label="Next month"
                  value={check.nextMonth}
                  onChange={(nextMonth) =>
                    patch((current) => ({
                      ...current,
                      goalCheckIns: current.goalCheckIns.map((item) => (item.goalId === check.goalId ? { ...item, nextMonth } : item)),
                    }))
                  }
                />
              </article>
            )
          })}
        </section>
        <section>
          <h2>6. Time & energy</h2>
          <InkField label="When did I usually feel best?" value={reflection.timeEnergy.best} onChange={(best) => patch((current) => ({ ...current, timeEnergy: { ...current.timeEnergy, best } }))} />
          <InkField label="When did I feel drained?" value={reflection.timeEnergy.drained} onChange={(drained) => patch((current) => ({ ...current, timeEnergy: { ...current.timeEnergy, drained } }))} />
          <InkField label="What time did meaningful work actually happen?" value={reflection.timeEnergy.meaningfulWork} onChange={(meaningfulWork) => patch((current) => ({ ...current, timeEnergy: { ...current.timeEnergy, meaningfulWork } }))} />
          <InkField label="What repeatedly took longer than expected?" value={reflection.timeEnergy.tookLonger} onChange={(tookLonger) => patch((current) => ({ ...current, timeEnergy: { ...current.timeEnergy, tookLonger } }))} />
          <InkField label="What did evenings really look like?" value={reflection.timeEnergy.evenings} onChange={(evenings) => patch((current) => ({ ...current, timeEnergy: { ...current.timeEnergy, evenings } }))} />
          <aside className="patterns">
            <h3>Noticed in the log</h3>
            {patterns.length === 0 && <p className="whisper">Not enough timestamps yet to notice a pattern.</p>}
            {patterns.map((pattern) => (
              <p key={pattern}>{pattern}</p>
            ))}
          </aside>
        </section>
        <section>
          <h2>7. Moments I don’t want to forget</h2>
          {memories.length === 0 && <EmptyNote>Star a daily line and it can gather here.</EmptyNote>}
          <ul className="memory-list">
            {memories.map((entry) => (
              <li key={entry.id}>
                <InkMark name="star" />
                <Link to={`/day/${entry.date}`}>
                  {formatShortDate(entry.date)} — {entry.content}
                </Link>
                <button
                  type="button"
                  className="quiet-btn"
                  onClick={() =>
                    patch((current) => ({
                      ...current,
                      memoryEntryIds: current.memoryEntryIds.filter((id) => id !== entry.id),
                      releasedMemoryIds: [...current.releasedMemoryIds, entry.id],
                    }))
                  }
                >
                  Leave out
                </button>
              </li>
            ))}
          </ul>
          <LineList symbol="★" label="Also" items={reflection.extraMemories} onChange={(extraMemories) => patch((current) => ({ ...current, extraMemories }))} />
        </section>
        <section>
          <h2>8. More of / less of</h2>
          <LineList label="More of" symbol="→" items={reflection.moreOf} onChange={(moreOf) => patch((current) => ({ ...current, moreOf }))} />
          <LineList label="Less of" symbol="→" items={reflection.lessOf} onChange={(lessOf) => patch((current) => ({ ...current, lessOf }))} />
        </section>
        <section id="migration">
          <h2>9. Migration</h2>
          <p className="whisper">{monthName(month)} migration. Nothing moves unless you choose.</p>
          {waiting.length === 0 && <EmptyNote>Nothing to migrate. Nice.</EmptyNote>}
          <ul className="migration-list">
            {waiting.map((entry) => (
              <li key={entry.id}>
                <p>
                  <InkMark name="task" /> {entry.content}
                  <span className="whisper"> {formatShortDate(entry.date)}</span>
                </p>
                <div className="migration-actions">
                  <MigrationButton label="> Next month" action="next_month" entryId={entry.id} />
                  <MigrationButton label="< Future log" action="future" entryId={entry.id} />
                  <MigrationButton label="X Complete" action="complete" entryId={entry.id} />
                  <MigrationButton label="— Let go" action="let_go" entryId={entry.id} />
                </div>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2>10. {monthName(month)} in one sentence</h2>
          <InkField label={`${monthName(month).toUpperCase()} IN ONE SENTENCE`} value={reflection.monthInOneSentence} onChange={(monthInOneSentence) => patch((current) => ({ ...current, monthInOneSentence }))} rows={2} />
        </section>
      </div>
    </article>
  )
}

function MigrationButton({ label, action, entryId }: { label: string; action: MigrationAction; entryId: string }) {
  return (
    <button type="button" className="quiet-btn" onClick={() => journal.migrateEntry(entryId, action)}>
      {label}
    </button>
  )
}
