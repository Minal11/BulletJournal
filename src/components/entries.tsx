import { useEffect, useRef, useState } from 'react'
import { bulletLabel, markForEntry, signifierMarks, TASK_STATUS_LABEL, TYPE_LABEL } from '../domain/bullets.ts'
import { currentTime, formatComposerTime, normalizeTime, upcomingMonths } from '../domain/dates.ts'
import { entryCaptions } from '../domain/migration.ts'
import type { BulletType, JournalEntry, PlanItem, Signifier, TaskStatus } from '../domain/types.ts'
import { journal } from '../state/store.ts'
import { useJournal } from '../state/use-journal.ts'
import { composerKeyAction } from '../lib/keyboard.ts'
import { InkMark } from './marks.tsx'
import { cls } from './ui.tsx'

export function EntryRow({ entry }: { entry: JournalEntry }) {
  const { snapshot } = useJournal()
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const [draft, setDraft] = useState(entry.content)
  const [note, setNote] = useState(entry.note)
  const contentRef = useRef<HTMLTextAreaElement>(null)
  const [editingTime, setEditingTime] = useState(false)
  const cancelEdit = useRef(false)
  const longPress = useRef(false)
  const timer = useRef(0)

  useEffect(() => setDraft(entry.content), [entry.content])
  useEffect(() => {
    const node = contentRef.current
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
  useEffect(() => setNote(entry.note), [entry.note])

  const captions = entryCaptions(entry, snapshot.entries, snapshot.futureItems)
  const collections = snapshot.collections.filter((collection) => entry.collectionIds.includes(collection.id))
  const goals = snapshot.goals.filter((goal) => entry.goalIds.includes(goal.id))
  const mark = markForEntry(entry)

  function openMenu(x: number, y: number) {
    setMenu({ x: Math.min(x, window.innerWidth - 240), y: Math.min(y, window.innerHeight - 280) })
  }

  return (
    <article className={cls('entry', entry.taskStatus === 'cancelled' && 'is-dropped')}>
      <div className="entry-time">
        {entry.showTimestamp && entry.timestamp ? (
          editingTime ? (
            <input
              className="time-edit"
              aria-label="Time"
              defaultValue={formatComposerTime(entry.timestamp)}
              autoFocus
              onBlur={(event) => {
                const next = normalizeTime(event.target.value)
                journal.updateEntry(entry.id, { timestamp: next, showTimestamp: Boolean(next) })
                setEditingTime(false)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur()
              }}
            />
          ) : (
            <button type="button" className="time-btn" onClick={() => setEditingTime(true)}>
              <time dateTime={entry.timestamp}>{formatComposerTime(entry.timestamp)}</time>
            </button>
          )
        ) : (
          <button type="button" className="time-btn faint" onClick={() => journal.updateEntry(entry.id, { timestamp: currentTime(), showTimestamp: true })}>
            ·
          </button>
        )}
      </div>
      <span className="journal-margin" aria-hidden="true" />
      <button
        type="button"
        className="symbol-btn"
        aria-label={bulletLabel(entry)}
        aria-haspopup="menu"
        onContextMenu={(event) => {
          event.preventDefault()
          openMenu(event.clientX, event.clientY)
        }}
        onPointerDown={() => {
          longPress.current = false
          timer.current = window.setTimeout(() => {
            longPress.current = true
            openMenu(window.innerWidth / 2, window.innerHeight / 3)
          }, 520)
        }}
        onPointerUp={() => window.clearTimeout(timer.current)}
        onPointerLeave={() => window.clearTimeout(timer.current)}
        onClick={() => {
          if (longPress.current) {
            longPress.current = false
            return
          }
          journal.cycleEntry(entry.id)
        }}
      >
        <InkMark name={mark} />
      </button>
      <div className="entry-body">
        <div className="entry-line">
          <textarea
            ref={contentRef}
            className="entry-edit"
            rows={1}
            aria-label="Entry"
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value)
              event.target.style.height = 'auto'
              event.target.style.height = `${event.target.scrollHeight}px`
            }}
            onBlur={() => {
              if (cancelEdit.current) {
                cancelEdit.current = false
                setDraft(entry.content)
                return
              }
              if (draft.trim() && draft !== entry.content) journal.updateEntry(entry.id, { content: draft.trim() })
              if (!draft.trim()) setDraft(entry.content)
            }}
            onKeyDown={(event) => {
              const action = composerKeyAction({
                key: event.key,
                shiftKey: event.shiftKey,
                metaKey: event.metaKey,
                ctrlKey: event.ctrlKey,
                altKey: event.altKey,
                target: event.target,
              })
              if (action === 'save') {
                event.preventDefault()
                event.currentTarget.blur()
              }
              if (action === 'cancel') {
                event.preventDefault()
                event.stopPropagation()
                cancelEdit.current = true
                setDraft(entry.content)
                event.currentTarget.blur()
              }
            }}
          />
          {signifierMarks(entry.signifiers.filter((item) => mark !== 'star' || item !== 'important')) && (
            <span className="signifiers">{signifierMarks(entry.signifiers)}</span>
          )}
          <button type="button" className="more-btn" aria-label="Entry actions" onClick={(event) => openMenu(event.clientX, event.clientY)}>
            ···
          </button>
        </div>
        {(note || entry.note) && (
          <textarea
            className="entry-note"
            rows={2}
            aria-label="Longer note"
            value={note}
            placeholder="A longer note"
            onChange={(event) => setNote(event.target.value)}
            onBlur={() => {
              if (note !== entry.note) journal.updateEntry(entry.id, { note })
            }}
          />
        )}
        {captions.map((caption) => (
          <p key={caption} className="entry-caption">
            {caption}
          </p>
        ))}
        {(collections.length > 0 || goals.length > 0) && (
          <p className="entry-links">
            {collections.map((collection) => (
              <a key={collection.id} href={`#/collections/${collection.id}`}>
                → {collection.title}
              </a>
            ))}
            {goals.map((goal) => (
              <a key={goal.id} href={`#/goals/${goal.year}/${goal.quarter}`}>
                → {goal.title}
              </a>
            ))}
          </p>
        )}
      </div>
      {menu && <EntryMenu entry={entry} x={menu.x} y={menu.y} onClose={() => setMenu(null)} />}
    </article>
  )
}

function EntryMenu({ entry, x, y, onClose }: { entry: JournalEntry; x: number; y: number; onClose: () => void }) {
  const { snapshot } = useJournal()
  const ref = useRef<HTMLDivElement>(null)
  const { year, month } = { year: Number(entry.date.slice(0, 4)), month: Number(entry.date.slice(5, 7)) }
  const months = upcomingMonths(year, month, 8)

  useEffect(() => {
    function onPointer(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) onClose()
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('mousedown', onPointer)
    window.addEventListener('keydown', onKey)
    ref.current?.querySelector('button')?.focus()
    return () => {
      window.removeEventListener('mousedown', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  function chooseStatus(status: TaskStatus, target?: { year: number; month: number }) {
    journal.setEntryStatus(entry.id, status, target)
    onClose()
  }

  return (
    <div ref={ref} className="entry-menu" role="menu" style={{ left: x, top: y }}>
      <p>Kind</p>
      {(['task', 'event', 'note'] as BulletType[]).map((type) => (
        <button key={type} type="button" role="menuitem" className={cls(entry.type === type && 'on')} onClick={() => { journal.setEntryType(entry.id, type); onClose() }}>
          {TYPE_LABEL[type]}
        </button>
      ))}
      {entry.type === 'task' && (
        <>
          <p>State</p>
          {(Object.keys(TASK_STATUS_LABEL) as TaskStatus[]).map((status) => (
            <button key={status} type="button" role="menuitem" className={cls(entry.taskStatus === status && 'on')} onClick={() => chooseStatus(status)}>
              {TASK_STATUS_LABEL[status]}
            </button>
          ))}
          <p>Schedule into</p>
          {months.map((item) => (
            <button key={`${item.year}-${item.month}`} type="button" role="menuitem" onClick={() => chooseStatus('scheduled', item)}>
              {item.label}
            </button>
          ))}
        </>
      )}
      <p>Signifier</p>
      {(['important', 'insight', 'research'] as Signifier[]).map((signifier) => (
        <button key={signifier} type="button" role="menuitem" className={cls(entry.signifiers.includes(signifier) && 'on')} onClick={() => journal.toggleSignifier(entry.id, signifier)}>
          {signifier === 'important' ? '★ Important' : signifier === 'insight' ? '! Insight' : '? Needs research'}
        </button>
      ))}
      <p>Page</p>
      <button type="button" role="menuitem" onClick={() => { journal.updateEntry(entry.id, { showTimestamp: !entry.showTimestamp }); onClose() }}>
        {entry.showTimestamp ? 'Hide time' : 'Show time'}
      </button>
      <button type="button" role="menuitem" onClick={() => { journal.updateEntry(entry.id, { note: entry.note || ' ' }); onClose() }}>
        Longer note
      </button>
      {snapshot.collections.filter((collection) => !collection.archived).map((collection) => (
        <button key={collection.id} type="button" role="menuitem" className={cls(entry.collectionIds.includes(collection.id) && 'on')} onClick={() => journal.toggleCollection(entry.id, collection.id)}>
          {entry.collectionIds.includes(collection.id) ? 'Remove from' : 'File in'} {collection.title}
        </button>
      ))}
      {snapshot.goals.map((goal) => (
        <button key={goal.id} type="button" role="menuitem" className={cls(entry.goalIds.includes(goal.id) && 'on')} onClick={() => journal.toggleGoal(entry.id, goal.id)}>
          {entry.goalIds.includes(goal.id) ? 'Untie' : 'Tie to'} {goal.title}
        </button>
      ))}
      <button type="button" role="menuitem" className="danger" onClick={() => { journal.deleteEntry(entry.id); onClose() }}>
        Remove line
      </button>
    </div>
  )
}

export function Composer({
  date,
  scope = 'day',
  placeholder = 'What’s on your mind?',
}: {
  date: string
  scope?: 'day' | 'month'
  placeholder?: string
}) {
  const { snapshot } = useJournal()
  const [type, setType] = useState<BulletType>('task')
  const [signifiers, setSignifiers] = useState<Signifier[]>([])
  const [text, setText] = useState('')
  const [time, setTime] = useState(snapshot.settings.showTimestampsByDefault ? formatComposerTime(currentTime()) : '')
  const [saveError, setSaveError] = useState<string | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const saving = useRef(false)

  useEffect(() => {
    function focus() {
      inputRef.current?.scrollIntoView({ block: 'center' })
      inputRef.current?.focus()
    }
    document.addEventListener('bj-compose', focus)
    return () => document.removeEventListener('bj-compose', focus)
  }, [])

  useEffect(() => {
    const node = inputRef.current
    if (!node || CSS.supports('field-sizing', 'content')) return
    node.style.height = 'auto'
    node.style.height = `${node.scrollHeight}px`
  }, [text])

  async function submit() {
    const draft = text
    if (!draft.trim() || saving.current) return
    saving.current = true
    setSaveError(null)
    const timestamp = scope === 'day' ? normalizeTime(time) : null
    const entry = journal.addEntry({
      date,
      content: draft,
      type,
      scope,
      timestamp,
      showTimestamp: Boolean(timestamp) && snapshot.settings.showTimestampsByDefault,
      signifiers,
    })
    if (!entry) {
      saving.current = false
      setSaveError('This line could not be kept.')
      return
    }
    await journal.flush()
    saving.current = false
    if (journal.getSnapshot().error) {
      setSaveError(journal.getSnapshot().error)
      return
    }
    setText('')
    setSignifiers([])
    if (snapshot.settings.showTimestampsByDefault && scope === 'day') setTime(formatComposerTime(currentTime()))
    inputRef.current?.focus()
  }

  function applySlash(value: string) {
    const parsed = value.match(/^\/(task|event|note|memory)\s+/i)
    if (!parsed) {
      setText(value)
      return
    }
    const word = parsed[1]?.toLowerCase()
    if (word === 'memory') {
      setType('event')
      setSignifiers(['important'])
    } else if (word === 'note') {
      setType('note')
      setSignifiers([])
    } else if (word === 'event') {
      setType('event')
      setSignifiers([])
    } else {
      setType('task')
      setSignifiers([])
    }
    setText(value.slice(parsed[0].length))
  }

  return (
    <form
      className="composer log-composer"
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
    >
      <div className="entry-time">
        {scope === 'day' ? (
          <input
            className="time-edit"
            aria-label="Time for the new entry"
            value={time}
            placeholder="time"
            onChange={(event) => setTime(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                event.currentTarget.form?.requestSubmit()
              }
            }}
          />
        ) : null}
      </div>
      <span className="journal-margin" aria-hidden="true" />
      <button
        type="button"
        className="symbol-btn"
        aria-label={`New ${TYPE_LABEL[type]}. Change kind.`}
        onClick={() => {
          setSignifiers([])
          setType(type === 'task' ? 'event' : type === 'event' ? 'note' : 'task')
        }}
      >
        <InkMark name={signifiers.includes('important') && type === 'event' ? 'star' : type === 'task' ? 'task' : type === 'event' ? 'event' : 'note'} />
      </button>
      <textarea
        ref={inputRef}
        className="composer-input"
        rows={1}
        aria-label="New entry"
        placeholder={placeholder}
        value={text}
        onChange={(event) => {
          setSaveError(null)
          applySlash(event.target.value)
        }}
        onKeyDown={(event) => {
          const action = composerKeyAction({
            key: event.key,
            shiftKey: event.shiftKey,
            metaKey: event.metaKey,
            ctrlKey: event.ctrlKey,
            altKey: event.altKey,
            target: event.target,
          })
          if (action === 'cancel') {
            event.preventDefault()
            setText('')
            setSaveError(null)
          }
          if (action === 'save') {
            event.preventDefault()
            event.currentTarget.form?.requestSubmit()
          }
        }}
      />
      <button type="submit" className="visually-hidden">
        Keep this line
      </button>
      {saveError && <p className="composer-error">{saveError}</p>}
      <p className="composer-hint">/task · /event · /note · /memory · Enter keeps it</p>
    </form>
  )
}

function PlanLine({ date, item }: { date: string; item: PlanItem }) {
  const [time, setTime] = useState(item.time ? formatComposerTime(item.time) : '')
  const [content, setContent] = useState(item.content)
  const skipTime = useRef(false)
  const skipContent = useRef(false)

  useEffect(() => {
    setTime(item.time ? formatComposerTime(item.time) : '')
  }, [item.time])
  useEffect(() => setContent(item.content), [item.content])

  return (
    <li>
      <input
        className="time-edit"
        aria-label="Plan time"
        value={time}
        onChange={(event) => setTime(event.target.value)}
        onBlur={() => {
          if (skipTime.current) {
            skipTime.current = false
            return
          }
          journal.updatePlanItem(date, item.id, { time: normalizeTime(time) })
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur()
          if (event.key === 'Escape') {
            event.preventDefault()
            skipTime.current = true
            setTime(item.time ? formatComposerTime(item.time) : '')
            event.currentTarget.blur()
          }
        }}
      />
      <span className="journal-margin" aria-hidden="true" />
      <input
        className="ink-input"
        aria-label="Plan"
        value={content}
        onChange={(event) => setContent(event.target.value)}
        onBlur={() => {
          if (skipContent.current) {
            skipContent.current = false
            setContent(item.content)
            return
          }
          const next = content.trim()
          if (!next) setContent(item.content)
          else journal.updatePlanItem(date, item.id, { content: next })
        }}
        onKeyDown={(event) => {
          const action = composerKeyAction({
            key: event.key,
            shiftKey: event.shiftKey,
            metaKey: event.metaKey,
            ctrlKey: event.ctrlKey,
            altKey: event.altKey,
            target: event.target,
          })
          if (action === 'save') {
            event.preventDefault()
            event.currentTarget.blur()
          }
          if (action === 'cancel') {
            event.preventDefault()
            skipContent.current = true
            setContent(item.content)
            event.currentTarget.blur()
          }
        }}
      />
      <button type="button" className="quiet-btn" aria-label="Remove plan line" onClick={() => journal.removePlanItem(date, item.id)}>
        ×
      </button>
    </li>
  )
}

export function PlanBlock({ date }: { date: string }) {
  const { snapshot } = useJournal()
  const day = snapshot.days.find((item) => item.date === date)
  const collapsed = day?.planCollapsed ?? false
  const items = day?.planItems ?? []
  const [time, setTime] = useState('')
  const [content, setContent] = useState('')

  return (
    <section className="plan-block">
      <div className="section-row">
        <h2>Plan</h2>
        <button type="button" className="quiet-btn" onClick={() => journal.updateDay(date, { planCollapsed: !collapsed })}>
          {collapsed ? 'Open' : 'Fold'}
        </button>
      </div>
      {!collapsed && (
        <>
          <p className="whisper">What you expected this day to hold.</p>
          {items.length === 0 && <p className="empty-note">No plan yet. A few intentions are enough.</p>}
          <ul className="plan-list">
            {items.map((item) => (
              <PlanLine key={item.id} date={date} item={item} />
            ))}
          </ul>
          <form
            className="plan-add"
            onSubmit={(event) => {
              event.preventDefault()
              if (!content.trim()) return
              journal.addPlanItem(date, { time: normalizeTime(time), content: content.trim() })
              setTime('')
              setContent('')
            }}
          >
            <input
              className="time-edit"
              aria-label="New plan time"
              placeholder="9:00"
              value={time}
              onChange={(event) => setTime(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  event.currentTarget.form?.requestSubmit()
                }
              }}
            />
            <span className="journal-margin" aria-hidden="true" />
            <input
              className="ink-input"
              aria-label="New plan line"
              placeholder="Add an intention"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              onKeyDown={(event) => {
                const action = composerKeyAction({
                  key: event.key,
                  shiftKey: event.shiftKey,
                  metaKey: event.metaKey,
                  ctrlKey: event.ctrlKey,
                  altKey: event.altKey,
                  target: event.target,
                })
                if (action === 'save') {
                  event.preventDefault()
                  event.currentTarget.form?.requestSubmit()
                }
                if (action === 'cancel') {
                  event.preventDefault()
                  setContent('')
                  setTime('')
                }
              }}
            />
            <button type="submit" className="visually-hidden">
              Add intention
            </button>
          </form>
        </>
      )}
    </section>
  )
}
