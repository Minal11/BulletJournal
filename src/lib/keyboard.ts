const TYPE_KEYS = new Set(['t', 'e', 'n'])
const NON_TEXT_INPUTS = new Set(['button', 'submit', 'reset', 'checkbox', 'radio', 'file', 'hidden', 'image', 'range', 'color'])

type KeyLike = {
  key: string
  shiftKey?: boolean
  metaKey?: boolean
  ctrlKey?: boolean
  altKey?: boolean
}

type EditableLike = {
  isContentEditable?: boolean
  tagName?: string
  type?: string
}

export function isEditableTarget(target: EventTarget | EditableLike | null): boolean {
  if (!target || typeof target !== 'object') return false
  const node = target as EditableLike
  if (node.isContentEditable) return true
  const tag = node.tagName?.toUpperCase()
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (tag === 'INPUT') {
    const type = (node.type || 'text').toLowerCase()
    return !NON_TEXT_INPUTS.has(type)
  }
  return false
}

/** T/E/N never apply while the person is writing in a field. */
export function shouldApplyTypeShortcut(event: KeyLike, target: EventTarget | EditableLike | null): boolean {
  if (isEditableTarget(target)) return false
  if (event.metaKey || event.ctrlKey || event.altKey) return false
  if (event.key.length !== 1) return false
  return TYPE_KEYS.has(event.key.toLowerCase())
}

export type ComposerKeyAction = 'insert' | 'save' | 'newline' | 'cancel' | 'shortcut'

export function composerKeyAction(event: KeyLike & { target: EventTarget | EditableLike | null }): ComposerKeyAction {
  if (event.key === 'Escape') return 'cancel'
  if (event.key === 'Enter' && event.shiftKey) return 'newline'
  if (event.key === 'Enter') return 'save'
  if (shouldApplyTypeShortcut(event, event.target)) return 'shortcut'
  return 'insert'
}
