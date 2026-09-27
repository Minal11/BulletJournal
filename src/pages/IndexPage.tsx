import { Link } from 'react-router-dom'
import { buildIndex, visibleIndex } from '../domain/index-pages.ts'
import type { IndexOverride } from '../domain/types.ts'
import { journal } from '../state/store.ts'
import { useJournal } from '../state/use-journal.ts'
import { SortableList, SortableRow } from '../components/sortable.tsx'

export function IndexPage() {
  const { snapshot } = useJournal()
  const rows = buildIndex(snapshot)
  const visible = visibleIndex(rows, false)

  function write(nextRows = rows, orderedIds?: string[]) {
    const order = new Map((orderedIds ?? visible.map((row) => row.id)).map((id, index) => [id, index]))
    const overrides: IndexOverride[] = nextRows.map((row) => ({
      id: row.id,
      hidden: row.hidden,
      pinned: row.pinned,
      sortOrder: order.get(row.id) ?? row.sortOrder,
    }))
    journal.setIndexOverrides(overrides)
  }

  return (
    <article className="page index-page">
      <header className="day-head">
        <div>
          <p className="kicker">Index</p>
          <h1>Index</h1>
          <p className="whisper">Quarter = direction · Month = focus · Day = action + reality</p>
        </div>
      </header>
      <div className="page-body">
        <SortableList
          ids={visible.map((row) => row.id)}
          label="Index"
          onReorder={(ids) => write(rows, ids)}
        >
          {visible.map((row) => (
            <SortableRow key={row.id} id={row.id}>
              <div className="index-row">
                <Link to={row.route}>{row.label}</Link>
                <button
                  type="button"
                  className="quiet-btn"
                  onClick={() => write(rows.map((item) => (item.id === row.id ? { ...item, pinned: !item.pinned } : item)))}
                >
                  {row.pinned ? 'Unpin' : 'Pin'}
                </button>
                <button
                  type="button"
                  className="quiet-btn"
                  onClick={() => write(rows.map((item) => (item.id === row.id ? { ...item, hidden: true } : item)))}
                >
                  Hide
                </button>
              </div>
            </SortableRow>
          ))}
        </SortableList>
        {rows.some((row) => row.hidden) && (
          <section>
            <h2>Hidden</h2>
            <ul className="plain-list">
              {rows
                .filter((row) => row.hidden)
                .map((row) => (
                  <li key={row.id}>
                    {row.label}{' '}
                    <button type="button" className="quiet-btn" onClick={() => write(rows.map((item) => (item.id === row.id ? { ...item, hidden: false } : item)))}>
                      Show
                    </button>
                  </li>
                ))}
            </ul>
          </section>
        )}
        <p className="colophon">Capture everything. Commit to very little.</p>
      </div>
    </article>
  )
}
