import type { BulletType, Signifier } from '../domain/types.ts'

/** What the page offers. Memory is kept as an event marked important, with a memory tag. */
export type EntryKind = 'task' | 'event' | 'note' | 'memory'

export const ENTRY_KINDS: EntryKind[] = ['task', 'event', 'note', 'memory']

export const ENTRY_KIND_LABEL: Record<EntryKind, string> = {
  task: 'Task',
  event: 'Event',
  note: 'Note',
  memory: 'Memory',
}

export interface ParsedEntryInput {
  kind: EntryKind
  content: string
  commandOnly: boolean
}

const COMMAND = /^\/(task|event|note|memory)\b\s*([\s\S]*)$/i

export function parseEntryInput(input: string, currentKind: EntryKind): ParsedEntryInput {
  const match = input.match(COMMAND)
  if (!match) return { kind: currentKind, content: input, commandOnly: false }
  const kind = match[1]?.toLowerCase() as EntryKind
  const content = (match[2] ?? '').trim()
  return { kind, content, commandOnly: content.length === 0 }
}

export function storedEntry(kind: EntryKind): { type: BulletType; signifiers: Signifier[]; memory: boolean } {
  if (kind === 'memory') return { type: 'event', signifiers: ['important'], memory: true }
  return { type: kind, signifiers: [], memory: false }
}

export function entryKindOf(entry: { type: BulletType; tags?: string[] }): EntryKind {
  if (entry.tags?.includes('memory')) return 'memory'
  if (entry.type === 'task' || entry.type === 'event' || entry.type === 'note') return entry.type
  return 'note'
}

/** A failed local save leaves the typed line in place. A cloud miss after a local save does not. */
export function textAfterSave(savedLocally: boolean, text: string): { text: string; message: string | null } {
  if (!savedLocally) return { text, message: "Couldn't save this entry locally. Your text is still here." }
  return { text: '', message: null }
}
