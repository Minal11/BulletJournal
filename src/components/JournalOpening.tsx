import type { ReactNode } from 'react'
import { useJournalOpening } from '../hooks/useJournalOpening.ts'
import { JournalCover } from './JournalCover.tsx'
import '../styles/journal-opening.css'

export function JournalOpening({ children }: { children: ReactNode }) {
  const { phase, reduced, accelerate } = useJournalOpening()
  return (
    <>
      <div className="opening-app" inert={phase === 'complete' ? undefined : true}>
        {children}
      </div>
      {phase !== 'complete' && <JournalCover phase={phase} reduced={reduced} onAccelerate={accelerate} />}
    </>
  )
}
