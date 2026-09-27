import { describe, expect, it } from 'vitest'
import { composerKeyAction, isEditableTarget, shouldApplyTypeShortcut } from './keyboard.ts'

const field = (tagName: string, type = 'text') => ({ tagName, type })

describe('journal typing', () => {
  it('treats inputs, textareas, selects, and contenteditable as editable', () => {
    expect(isEditableTarget(field('INPUT'))).toBe(true)
    expect(isEditableTarget(field('TEXTAREA'))).toBe(true)
    expect(isEditableTarget(field('SELECT'))).toBe(true)
    expect(isEditableTarget({ tagName: 'DIV', isContentEditable: true })).toBe(true)
    expect(isEditableTarget(field('INPUT', 'button'))).toBe(false)
    expect(isEditableTarget(null)).toBe(false)
  })

  it('does not fire T, E, or N shortcuts while typing in a field', () => {
    for (const key of ['t', 'T', 'e', 'E', 'n', 'N']) {
      expect(shouldApplyTypeShortcut({ key }, field('INPUT'))).toBe(false)
      expect(shouldApplyTypeShortcut({ key }, field('TEXTAREA'))).toBe(false)
      expect(composerKeyAction({ key, target: field('TEXTAREA') })).toBe('insert')
    }
  })

  it('saves on Enter and keeps Shift+Enter as a new line', () => {
    const target = field('TEXTAREA')
    expect(composerKeyAction({ key: 'Enter', target })).toBe('save')
    expect(composerKeyAction({ key: 'Enter', shiftKey: true, target })).toBe('newline')
    expect(composerKeyAction({ key: 'Escape', target })).toBe('cancel')
  })
})
