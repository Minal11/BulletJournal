import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { cyclePrimarySignifier } from '../domain/bullets.ts'
import { collectionToMarkdown } from '../domain/markdown.ts'
import { downloadText } from '../lib/download.ts'
import { COLLECTION_ICON_LABEL, COLLECTION_ICONS } from '../lib/collection-icons.ts'
import type { CollectionBullet, TaskStatus } from '../domain/types.ts'
import { todayISO } from '../domain/dates.ts'
import { journal } from '../state/store.ts'
import { useJournal } from '../state/use-journal.ts'
import { CollectionGlyph, InkMark } from '../components/marks.tsx'
import { SortableList, SortableRow } from '../components/sortable.tsx'
import { EmptyNote } from '../components/ui.tsx'

function LineField({ value, label, onCommit }: { value: string; label: string; onCommit: (value: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const dirty = useRef(false)
  const [draft, setDraft] = useState(value)
  useEffect(() => {
    if (!dirty.current) setDraft(value)
  }, [value])
  useEffect(() => {
    const node = ref.current
    if (!node || CSS.supports('field-sizing', 'content')) return
    const fit = () => {
      node.style.height = 'auto'
      node.style.height = `${node.scrollHeight}px`
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(node.parentElement ?? node)
    return () => observer.disconnect()
  }, [draft])
  return (
    <textarea
      ref={ref}
      className="entry-edit"
      rows={1}
      aria-label={label}
      value={draft}
      onChange={(event) => {
        dirty.current = true
        setDraft(event.target.value)
      }}
      onBlur={() => {
        dirty.current = false
        onCommit(draft)
      }}
    />
  )
}

export function CollectionPage() {
  const { snapshot } = useJournal()
  const params = useParams()
  const collection = snapshot.collections.find((item) => item.id === params.id)
  const [text, setText] = useState('')
  const [draft, setDraft] = useState(collection ?? null)
  const [boundId, setBoundId] = useState(collection?.id ?? '')
  const today = todayISO()
  if (collection && collection.id !== boundId) {
    setBoundId(collection.id)
    setDraft(collection)
  }
  useEffect(() => {
    if (!draft || !collection || draft.id !== collection.id) return
    if (
      draft.title === collection.title &&
      draft.description === collection.description &&
      draft.content === collection.content &&
      draft.icon === collection.icon &&
      draft.defaultBullet === collection.defaultBullet
    ) {
      return
    }
    const handle = window.setTimeout(() => {
      journal.updateCollection(draft.id, {
        title: draft.title,
        description: draft.description,
        content: draft.content,
        icon: draft.icon,
        defaultBullet: draft.defaultBullet,
      })
    }, 350)
    return () => window.clearTimeout(handle)
  }, [draft, collection])
  if (!collection) {
    return (
      <article className="page">
        <div className="page-body">
          <EmptyNote>This page isn’t in the journal.</EmptyNote>
          <Link to="/collections">Back to collections</Link>
        </div>
      </article>
    )
  }
  const page = draft && draft.id === collection.id ? draft : collection
  const bullets = collection.bullets.slice().sort((a, b) => a.sortOrder - b.sortOrder)
  const linked = snapshot.entries.filter((entry) => entry.collectionIds.includes(page.id))

  const cycle = (bullet: CollectionBullet) => {
    if (bullet.type === 'check') {
      journal.updateCollectionBullet(page.id, bullet.id, { checked: !bullet.checked })
      return
    }
    if (bullet.type === 'task') {
      const order: TaskStatus[] = ['open', 'complete', 'cancelled']
      const next = order[(Math.max(0, order.indexOf(bullet.taskStatus ?? 'open')) + 1) % order.length] ?? 'open'
      journal.updateCollectionBullet(page.id, bullet.id, { taskStatus: next })
      return
    }
    journal.updateCollectionBullet(page.id, bullet.id, { signifiers: cyclePrimarySignifier(bullet.signifiers) })
  }

  return (
    <article className="page">
      <header className="day-head">
        <div>
          <p className="kicker">Collection</p>
          <input
            className="goal-title"
            aria-label="Collection title"
            value={page.title}
            onChange={(event) => setDraft((current) => (current ? { ...current, title: event.target.value } : current))}
          />
        </div>
      </header>
      <div className="page-body">
        <div className="icon-row" role="radiogroup" aria-label="Cover mark">
          {COLLECTION_ICONS.map((icon) => (
            <button
              key={icon}
              type="button"
              className={page.icon === icon ? 'icon-pick on' : 'icon-pick'}
              aria-label={COLLECTION_ICON_LABEL[icon]}
              aria-pressed={page.icon === icon}
              title={COLLECTION_ICON_LABEL[icon]}
              onClick={() => {
                const picked = icon
                setDraft((current) => (current ? { ...current, icon: picked } : current))
              }}
            >
              <CollectionGlyph name={icon} />
            </button>
          ))}
        </div>
        <textarea
          className="ink-area"
          rows={2}
          aria-label="Description"
          placeholder="What is this page for?"
          value={page.description}
          onChange={(event) => setDraft((current) => (current ? { ...current, description: event.target.value } : current))}
        />
        <textarea
          className="ink-area prose"
          rows={6}
          aria-label="Freeform notes"
          placeholder="Write freely. An idea can stay an idea."
          value={page.content}
          onChange={(event) => setDraft((current) => (current ? { ...current, content: event.target.value } : current))}
        />
        <div className="choice-row">
          <span className="whisper">New lines start as</span>
          {(['task', 'event', 'note'] as const).map((type) => (
            <button
              key={type}
              type="button"
              className={page.defaultBullet === type ? 'choice on' : 'choice'}
              aria-pressed={page.defaultBullet === type}
              onClick={() => setDraft((current) => (current ? { ...current, defaultBullet: type } : current))}
            >
              {type === 'task' ? 'Task' : type === 'event' ? 'Event' : 'Note'}
            </button>
          ))}
        </div>
        {bullets.length === 0 && <EmptyNote>{collection.defaultBullet === 'note' ? 'Notes can live here without becoming tasks.' : 'Add a line when you want one.'}</EmptyNote>}
        <SortableList ids={bullets.map((bullet) => bullet.id)} label="Collection lines" onReorder={(ids) => journal.reorderCollectionBullets(collection.id, ids)}>
          {bullets.map((bullet) => (
            <SortableRow key={bullet.id} id={bullet.id}>
              <div className="entry">
                <span />
                <button type="button" className="symbol-btn" aria-label="Change this line" onClick={() => cycle(bullet)}>
                  <InkMark
                    name={
                      bullet.type === 'check'
                        ? bullet.checked
                          ? 'checked'
                          : 'check'
                        : bullet.type === 'task' && bullet.taskStatus === 'complete'
                          ? 'complete'
                          : bullet.type === 'task' && bullet.taskStatus === 'cancelled'
                            ? 'cancelled'
                            : bullet.signifiers.includes('important')
                              ? 'star'
                              : bullet.type === 'event'
                                ? 'event'
                                : bullet.type === 'note'
                                  ? 'note'
                                  : 'task'
                    }
                  />
                </button>
                <div className="entry-line">
                  <LineField
                    value={bullet.content}
                    label="Collection line"
                    onCommit={(content) => {
                      const next = content.trim()
                      if (next) journal.updateCollectionBullet(collection.id, bullet.id, { content: next })
                    }}
                  />
                  <button type="button" className="quiet-btn" aria-label="Remove line" onClick={() => journal.removeCollectionBullet(collection.id, bullet.id)}>
                    ×
                  </button>
                </div>
              </div>
            </SortableRow>
          ))}
        </SortableList>
        <form
          className="composer compact"
          onSubmit={(event) => {
            event.preventDefault()
            journal.updateCollection(collection.id, {
              title: page.title,
              description: page.description,
              content: page.content,
              icon: page.icon,
              defaultBullet: page.defaultBullet,
            })
            journal.addCollectionBullet(collection.id, text)
            setText('')
          }}
        >
          <input className="composer-input" aria-label="New collection line" placeholder={collection.defaultBullet === 'note' ? 'A note, not a task' : 'Add a line'} value={text} onChange={(event) => setText(event.target.value)} />
        </form>
        {linked.length > 0 && (
          <section>
            <h2>From the daily log</h2>
            <ul className="plain-list">
              {linked.map((entry) => (
                <li key={entry.id}>
                  <Link to={entry.date === today ? '/' : `/day/${entry.date}`}>{entry.content}</Link>
                </li>
              ))}
            </ul>
          </section>
        )}
        <p className="page-links">
          <button type="button" className="quiet-btn" onClick={() => journal.updateCollection(collection.id, { archived: !collection.archived, pinned: collection.archived ? collection.pinned : false })}>
            {collection.archived ? 'Return this page' : 'Archive this page'}
          </button>
          <button type="button" className="quiet-btn" onClick={() => journal.updateCollection(collection.id, { pinned: !collection.pinned })}>
            {collection.pinned ? 'Unpin from the index' : 'Pin to the index'}
          </button>
          <button type="button" className="quiet-btn" onClick={() => downloadText(`${collection.title || 'collection'}.md`, collectionToMarkdown(collection), 'text/markdown')}>
            Export page
          </button>
        </p>
      </div>
    </article>
  )
}
