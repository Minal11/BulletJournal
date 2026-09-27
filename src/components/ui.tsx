import { useEffect, useId, useRef, useState, type ReactNode } from 'react'

export function cls(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return <p className="empty-note">{children}</p>
}

export function PaperDialog({
  open,
  title,
  children,
  confirmLabel,
  dismissLabel,
  confirmDanger = true,
  onConfirm,
  onClose,
}: {
  open: boolean
  title: string
  children: ReactNode
  confirmLabel: string
  dismissLabel?: string
  confirmDanger?: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className="paper-dialog"
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
    >
      <h2>{title}</h2>
      <div className="dialog-body">{children}</div>
      <div className="dialog-actions">
        <button type="button" className="quiet-btn" onClick={onClose}>
          {dismissLabel ?? (confirmLabel ? 'Keep it' : 'Close')}
        </button>
        {confirmLabel && (
          <button type="button" className={cls('quiet-btn', confirmDanger && 'danger')} onClick={onConfirm}>
            {confirmLabel}
          </button>
        )}
      </div>
    </dialog>
  )
}

export function Choice<T extends string | number>({
  name,
  value,
  current,
  onChange,
  children,
}: {
  name: string
  value: T
  current: T
  onChange: (value: T) => void
  children: ReactNode
}) {
  const id = useId()
  const on = current === value
  return (
    <label className={cls('choice', on && 'on')} htmlFor={id}>
      <input
        id={id}
        type="radio"
        name={name}
        value={String(value)}
        checked={on}
        onChange={() => onChange(value)}
      />
      {children}
    </label>
  )
}

export function InkField({
  label,
  value,
  onChange,
  rows = 3,
  placeholder,
  live = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  rows?: number
  placeholder?: string
  live?: boolean
}) {
  const [draft, setDraft] = useState(value)
  const dirty = useRef(false)
  useEffect(() => {
    if (!dirty.current) setDraft(value)
  }, [value])
  return (
    <label className="field">
      <span>{label}</span>
      {rows <= 1 ? (
        <input
          className="ink-input"
          value={draft}
          placeholder={placeholder}
          onChange={(event) => {
            dirty.current = true
            setDraft(event.target.value)
            if (live) onChange(event.target.value)
          }}
          onBlur={() => {
            dirty.current = false
            if (draft !== value) onChange(draft)
          }}
        />
      ) : (
        <textarea
          className="ink-area"
          rows={rows}
          value={draft}
          placeholder={placeholder}
          onChange={(event) => {
            dirty.current = true
            setDraft(event.target.value)
            if (live) onChange(event.target.value)
          }}
          onBlur={() => {
            dirty.current = false
            if (draft !== value) onChange(draft)
          }}
        />
      )}
    </label>
  )
}

export function LineList({
  label,
  items,
  onChange,
  symbol = '•',
  placeholder = 'Write a line',
}: {
  label?: string
  items: string[]
  onChange: (items: string[]) => void
  symbol?: string
  placeholder?: string
}) {
  const lines = items.length > 0 ? items : ['']
  function update(index: number, value: string) {
    const next = lines.slice()
    next[index] = value
    onChange(next)
  }
  return (
    <div className="line-list">
      {label && <h3>{label}</h3>}
      {lines.map((line, index) => (
        <label className="line-row" key={index}>
          <span aria-hidden="true">{symbol}</span>
          <input
            className="ink-input"
            value={line}
            placeholder={placeholder}
            aria-label={label ? `${label} ${index + 1}` : `Line ${index + 1}`}
            onChange={(event) => update(index, event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                const next = lines.slice()
                next.splice(index + 1, 0, '')
                onChange(next)
              }
              if (event.key === 'Backspace' && line === '' && lines.length > 1) {
                event.preventDefault()
                onChange(lines.filter((_, itemIndex) => itemIndex !== index))
              }
            }}
          />
        </label>
      ))}
    </div>
  )
}
