import { emptySnapshot } from '../domain/schema.ts'
import type { JournalSnapshot } from '../domain/types.ts'

export const journalBridge = {
  getSnapshot(): JournalSnapshot {
    return emptySnapshot()
  },
  replaceQuiet(_snapshot: JournalSnapshot) {},
}
