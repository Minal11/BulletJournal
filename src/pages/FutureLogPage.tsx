import { useState } from 'react'
import { monthName, shiftMonth, todayISO, monthOf } from '../domain/dates.ts'
import type { BulletType } from '../domain/types.ts'
import { journal } from '../state/store.ts'
import { useJournal } from '../state/use-journal.ts'
import { InkMark } from '../components/marks.tsx'
import { EmptyNote } from '../components/ui.tsx'

export function FutureLogPage() {
  const { snapshot } = useJournal()
  const today = todayISO()
  const { year, month } = monthOf(today)
  const groups = new Map<string, typeof snapshot.futureItems>()
  for (let index = 0; index < 14; index += 1) {
    const next = shiftMonth(year, month, index)
    groups.set(`${next.year}-${next.month}`, [])
  }
  for (const item of snapshot.futureItems) {
    const key = `${item.targetYear}-${item.targetMonth}`
    const list = groups.get(key) ?? []
    list.push(item)
    groups.set(key, list)
  }
  const ordered = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))

  return (
    <article className="page">
      <header className="day-head">
        <div>
          <p className="kicker">Future log</p>
          <h1>Later</h1>
          <p className="whisper">Nothing moves itself when the month arrives.</p>
        </div>
      </header>
      <div className="page-body">
        {ordered.map(([key, items]) => {
          const [itemYear, itemMonth] = key.split('-').map(Number)
          const current = itemYear === year && itemMonth === month
          const started = itemYear < year || (itemYear === year && itemMonth < month)
          const waiting = items.filter((item) => !item.reviewed)
          return (
            <section key={key} className="future-month">
              <h2>
                {monthName(itemMonth ?? 1)} {itemYear}
              </h2>
              {(current || started) && waiting.length > 0 && (
                <p className="margin-note">These were scheduled for a month that has started. Bring one in only if you still want it.</p>
              )}
              {waiting.length === 0 && items.length === 0 && <EmptyNote>Leave a note for this month when you think of it.</EmptyNote>}
              <ul className="future-list">
                {items.map((item) => (
                  <li key={item.id} className={item.reviewed ? 'is-reviewed' : undefined}>
                    <InkMark name={item.type === 'event' ? 'event' : item.type === 'note' ? 'note' : 'task'} />
                    <input
                      className="ink-input"
                      aria-label="Future log line"
                      value={item.content}
                      onChange={(event) => journal.updateFutureItem(item.id, { content: event.target.value })}
                    />
                    {!item.reviewed && (current || started) && (
                      <button type="button" className="quiet-btn" onClick={() => journal.bringFuture(item.id)}>
                        Bring into this month
                      </button>
                    )}
                    {item.reviewed && <span className="whisper">Brought in</span>}
                    <button type="button" className="quiet-btn" aria-label="Remove from the future log" onClick={() => journal.removeFutureItem(item.id)}>
                      ×
                    </button>
                  </li>
                ))}
              </ul>
              <FutureAdd year={itemYear ?? year} month={itemMonth ?? month} />
            </section>
          )
        })}
      </div>
    </article>
  )
}

function FutureAdd({ year, month }: { year: number; month: number }) {
  const [text, setText] = useState('')
  const [type, setType] = useState<BulletType>('task')
  return (
    <form
      className="composer compact"
      onSubmit={(event) => {
        event.preventDefault()
        journal.addFutureItem(year, month, text, type)
        setText('')
      }}
    >
      <button type="button" className="symbol-btn" aria-label="Change kind" onClick={() => setType(type === 'task' ? 'event' : type === 'event' ? 'note' : 'task')}>
        <InkMark name={type === 'event' ? 'event' : type === 'note' ? 'note' : 'task'} />
      </button>
      <input className="composer-input" aria-label={`Add to ${monthName(month)}`} placeholder="Leave this for later" value={text} onChange={(event) => setText(event.target.value)} />
    </form>
  )
}
