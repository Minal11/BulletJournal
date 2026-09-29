import { useState } from 'react'
import { masterTasks } from '../domain/tasks.ts'
import type { JournalEntry } from '../domain/types.ts'
import { journal } from '../state/store.ts'
import { useJournal } from '../state/use-journal.ts'
import { EmptyNote } from '../components/ui.tsx'

export function MasterTasksPage() {
  const { snapshot } = useJournal()
  const [text, setText] = useState('')
  const [goalId, setGoalId] = useState('')
  const [tag, setTag] = useState('')
  const open = masterTasks(snapshot.entries)
  const tags = [...new Set(open.flatMap((task) => task.tags))].sort()
  const visible = open.filter((task) => {
    if (goalId && !task.goalIds.includes(goalId)) return false
    if (tag && !task.tags.includes(tag)) return false
    return true
  })

  return (
    <article className="page">
      <header className="day-head">
        <div>
          <p className="kicker">Master tasks</p>
          <h1>Not yet dated</h1>
          <p className="whisper">Open tasks with no day. Moving one onto a day takes it off this page.</p>
        </div>
      </header>
      <div className="page-body">
        <form
          className="composer"
          onSubmit={(event) => {
            event.preventDefault()
            const created = journal.addMasterTask({ content: text, goalIds: goalId ? [goalId] : [], tags: tag ? [tag] : [] })
            if (created) setText('')
          }}
        >
          <input className="composer-input" aria-label="Add a master task" placeholder="Add a task" value={text} onChange={(event) => setText(event.target.value)} />
        </form>
        <div className="choice-row">
          <label className="whisper">
            Goal{' '}
            <select aria-label="Filter by goal" value={goalId} onChange={(event) => setGoalId(event.target.value)}>
              <option value="">All unscheduled</option>
              {snapshot.goals.map((goal) => (
                <option key={goal.id} value={goal.id}>
                  {goal.title || 'Untitled goal'}
                </option>
              ))}
            </select>
          </label>
          <label className="whisper">
            Tag{' '}
            <select aria-label="Filter by tag" value={tag} onChange={(event) => setTag(event.target.value)}>
              <option value="">Any tag</option>
              {tags.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        </div>
        {visible.length === 0 && <EmptyNote>Nothing is waiting without a day.</EmptyNote>}
        <ul className="plain-list master-list">
          {visible.map((task) => (
            <MasterRow key={task.id} task={task} goals={snapshot.goals} />
          ))}
        </ul>
      </div>
    </article>
  )
}

function MasterRow({ task, goals }: { task: JournalEntry; goals: { id: string; title: string }[] }) {
  const [editing, setEditing] = useState(false)
  const [content, setContent] = useState(task.content)
  const [date, setDate] = useState('')
  return (
    <li>
      <p>
        <span aria-hidden="true">• </span>
        {editing ? (
          <input
            className="ink-input"
            aria-label="Task"
            value={content}
            onChange={(event) => setContent(event.target.value)}
          />
        ) : (
          task.content
        )}
      </p>
      <p className="page-links">
        {editing ? (
          <button
            type="button"
            className="quiet-btn"
            onClick={() => {
              journal.updateEntry(task.id, { content })
              setEditing(false)
            }}
          >
            Save
          </button>
        ) : (
          <button type="button" className="quiet-btn" onClick={() => { setContent(task.content); setEditing(true) }}>
            Edit
          </button>
        )}
        <label className="whisper">
          Move to day{' '}
          <input
            type="date"
            aria-label={`Move ${task.content} to a day`}
            value={date}
            onChange={(event) => {
              setDate(event.target.value)
              if (event.target.value) journal.scheduleEntry(task.id, event.target.value)
            }}
          />
        </label>
        <button type="button" className="quiet-btn" onClick={() => journal.completeTask(task.id)}>
          Complete
        </button>
        <button type="button" className="quiet-btn" onClick={() => journal.setEntryStatus(task.id, 'cancelled')}>
          Drop
        </button>
        <label className="whisper">
          Goal{' '}
          <select
            aria-label={`Goal for ${task.content}`}
            value={task.goalIds[0] ?? ''}
            onChange={(event) => {
              const next = event.target.value
              const current = task.goalIds[0]
              if (current && current !== next) journal.toggleGoal(task.id, current)
              if (next) journal.toggleGoal(task.id, next)
            }}
          >
            <option value="">None</option>
            {goals.map((goal) => (
              <option key={goal.id} value={goal.id}>
                {goal.title || 'Untitled goal'}
              </option>
            ))}
          </select>
        </label>
      </p>
    </li>
  )
}
