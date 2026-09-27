import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { searchJournal } from '../domain/search.ts'
import type { BulletType, SearchFilters } from '../domain/types.ts'
import { useJournal } from '../state/use-journal.ts'
import { EmptyNote, cls } from '../components/ui.tsx'

const EMPTY: SearchFilters = {
  query: '',
  from: null,
  to: null,
  types: [],
  completed: false,
  migrated: false,
  starred: false,
  collectionId: null,
  goalId: null,
  tag: null,
}

export function SearchPage() {
  const { snapshot } = useJournal()
  const [filters, setFilters] = useState<SearchFilters>(EMPTY)
  const hits = useMemo(() => searchJournal(snapshot, filters), [snapshot, filters])
  const tags = [...new Set(snapshot.entries.flatMap((entry) => entry.tags))].sort()

  function toggleType(type: BulletType) {
    setFilters((current) => ({
      ...current,
      types: current.types.includes(type) ? current.types.filter((item) => item !== type) : [...current.types, type],
    }))
  }

  return (
    <article className="page">
      <header className="day-head">
        <div>
          <p className="kicker">Search</p>
          <h1>Find a line</h1>
        </div>
      </header>
      <div className="page-body">
        <input
          className="search-line"
          aria-label="Search the journal"
          placeholder="Search the journal"
          value={filters.query}
          onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))}
        />
        <div className="choice-row" role="group" aria-label="Kind">
          {(['task', 'event', 'note'] as BulletType[]).map((type) => (
            <button key={type} type="button" className={cls('choice', filters.types.includes(type) && 'on')} onClick={() => toggleType(type)}>
              {type}
            </button>
          ))}
          <button type="button" className={cls('choice', filters.completed && 'on')} onClick={() => setFilters((current) => ({ ...current, completed: !current.completed }))}>
            completed
          </button>
          <button type="button" className={cls('choice', filters.migrated && 'on')} onClick={() => setFilters((current) => ({ ...current, migrated: !current.migrated }))}>
            migrated
          </button>
          <button type="button" className={cls('choice', filters.starred && 'on')} onClick={() => setFilters((current) => ({ ...current, starred: !current.starred }))}>
            starred
          </button>
        </div>
        <div className="filter-dates">
          <label>
            From
            <input type="date" value={filters.from ?? ''} onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value || null }))} />
          </label>
          <label>
            To
            <input type="date" value={filters.to ?? ''} onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value || null }))} />
          </label>
        </div>
        <label className="field">
          <span>Collection</span>
          <select value={filters.collectionId ?? ''} onChange={(event) => setFilters((current) => ({ ...current, collectionId: event.target.value || null }))}>
            <option value="">Any</option>
            {snapshot.collections.map((collection) => (
              <option key={collection.id} value={collection.id}>
                {collection.title}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Goal</span>
          <select value={filters.goalId ?? ''} onChange={(event) => setFilters((current) => ({ ...current, goalId: event.target.value || null }))}>
            <option value="">Any</option>
            {snapshot.goals.map((goal) => (
              <option key={goal.id} value={goal.id}>
                {goal.title}
              </option>
            ))}
          </select>
        </label>
        {tags.length > 0 && (
          <div className="choice-row">
            {tags.map((tag) => (
              <button key={tag} type="button" className={cls('choice', filters.tag === tag && 'on')} onClick={() => setFilters((current) => ({ ...current, tag: current.tag === tag ? null : tag }))}>
                #{tag}
              </button>
            ))}
          </div>
        )}
        {hits.length === 0 && <EmptyNote>Search a word, a name, a task.</EmptyNote>}
        <ul className="snippets">
          {hits.map((hit) => (
            <li key={`${hit.kind}-${hit.id}`}>
              <Link to={hit.route} className="snippet">
                <span className="snippet-meta">{hit.meta}</span>
                <span className="snippet-body">
                  <span className="snippet-symbol">{hit.symbol}</span>
                  {hit.text}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </article>
  )
}
