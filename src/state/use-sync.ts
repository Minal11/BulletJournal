import { useSyncExternalStore } from 'react'
import { syncService } from '../services/syncService.ts'

export function useSync() {
  return useSyncExternalStore(syncService.subscribe, syncService.getSnapshot, syncService.getSnapshot)
}
