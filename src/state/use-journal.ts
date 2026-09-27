import { useSyncExternalStore } from 'react'
import { journal } from './store.ts'

export function useJournal() {
  return useSyncExternalStore(journal.subscribe, journal.getSnapshot, journal.getSnapshot)
}
