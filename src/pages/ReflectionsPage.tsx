import { Link } from 'react-router-dom'
import { formatMonthYear, quarterLabel } from '../domain/dates.ts'
import { useJournal } from '../state/use-journal.ts'
import { EmptyNote } from '../components/ui.tsx'

export function ReflectionsPage() {
  const { snapshot } = useJournal()
  const months = new Map<string, { year: number; month: number }>()
  for (const log of snapshot.monthlyLogs) months.set(`${log.year}-${log.month}`, { year: log.year, month: log.month })
  for (const reflection of snapshot.reflections) months.set(`${reflection.year}-${reflection.month}`, { year: reflection.year, month: reflection.month })
  const monthList = [...months.values()].sort((a, b) => b.year - a.year || b.month - a.month)
  const reviews = snapshot.reviews.slice().sort((a, b) => b.year - a.year || b.quarter - a.quarter)

  return (
    <article className="page">
      <header className="day-head">
        <div>
          <p className="kicker">Reflections</p>
          <h1>Looking back</h1>
          <p className="whisper">A page for the month. A page for the quarter.</p>
        </div>
      </header>
      <div className="page-body">
        <section>
          <h2>Months</h2>
          {monthList.length === 0 && <EmptyNote>When a month has a log, its reflection can live here.</EmptyNote>}
          <ul className="index-list">
            {monthList.map((month) => (
              <li key={`${month.year}-${month.month}`}>
                <Link to={`/reflection/${month.year}/${month.month}`}>{formatMonthYear(month.year, month.month)} reflection</Link>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2>Quarters</h2>
          {reviews.length === 0 && <EmptyNote>The quarterly review appears when you open a quarter.</EmptyNote>}
          <ul className="index-list">
            {reviews.map((review) => (
              <li key={review.id}>
                <Link to={`/review/${review.year}/${review.quarter}`}>{quarterLabel(review.year, review.quarter)} review</Link>
              </li>
            ))}
          </ul>
          <p className="whisper">Open a goals page and follow “Quarterly review” to begin one.</p>
        </section>
      </div>
    </article>
  )
}
