import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { journal } from '../state/store.ts'
import { useJournal } from '../state/use-journal.ts'
import { CollectionGlyph } from '../components/marks.tsx'
import { EmptyNote } from '../components/ui.tsx'

export function CollectionsPage() {
  const { snapshot } = useJournal()
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const open = snapshot.collections.filter((collection) => !collection.archived)
  const archived = snapshot.collections.filter((collection) => collection.archived)

  return (
    <article className="page">
      <header className="day-head">
        <div>
          <p className="kicker">Collections</p>
          <h1>Pages</h1>
          <p className="whisper">A topic gets a page when it needs one.</p>
        </div>
      </header>
      <div className="page-body">
        {open.length === 0 && <EmptyNote>No collections yet. Create one when a topic needs its own page.</EmptyNote>}
        <ul className="index-list">
          {open.map((collection) => (
            <li key={collection.id}>
              <CollectionGlyph name={collection.icon} />
              <div>
                <Link to={`/collections/${collection.id}`}>{collection.title}</Link>
                {collection.description && <p className="whisper">{collection.description}</p>}
              </div>
            </li>
          ))}
        </ul>
        <form
          className="inline-add"
          onSubmit={(event) => {
            event.preventDefault()
            const id = journal.addCollection(title)
            setTitle('')
            if (id) navigate(`/collections/${id}`)
          }}
        >
          <input className="ink-input" aria-label="New collection title" placeholder="New collection" value={title} onChange={(event) => setTitle(event.target.value)} />
          <p className="whisper">Not every idea needs to become a project.</p>
        </form>
        {archived.length > 0 && (
          <section>
            <h2>Archived</h2>
            <ul className="index-list">
              {archived.map((collection) => (
                <li key={collection.id}>
                  <Link to={`/collections/${collection.id}`}>{collection.title}</Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </article>
  )
}
