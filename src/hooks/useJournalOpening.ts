import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  JOURNAL_RESUME_THRESHOLD_MS,
  OPENING_FLIP_MS,
  OPENING_HOLD_MS,
  OPENING_TAP_DELAY_MS,
  REDUCED_FADE_MS,
  REDUCED_HOLD_MS,
  nextOpeningPhase,
  shouldReplayOpening,
  type OpeningPhase,
} from '../lib/journal-opening.ts'

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function useJournalOpening() {
  const navigate = useNavigate()
  const location = useLocation()
  const [phase, setPhase] = useState<OpeningPhase>('closed')
  const [reduced, setReduced] = useState(false)
  const phaseRef = useRef<OpeningPhase>('closed')
  const startedAt = useRef(0)
  const hiddenAt = useRef<number | null>(null)
  const timers = useRef<number[]>([])

  const clearTimers = useCallback(() => {
    for (const id of timers.current) window.clearTimeout(id)
    timers.current = []
  }, [])

  const begin = useCallback(() => {
    clearTimers()
    const motion = prefersReducedMotion()
    setReduced(motion)
    startedAt.current = Date.now()
    phaseRef.current = 'closed'
    setPhase('closed')
    const hold = motion ? REDUCED_HOLD_MS : OPENING_HOLD_MS
    const flip = motion ? REDUCED_FADE_MS : OPENING_FLIP_MS
    const holdTimer = window.setTimeout(() => {
      if (phaseRef.current !== 'closed') return
      phaseRef.current = 'opening'
      setPhase('opening')
      const flipTimer = window.setTimeout(() => {
        if (phaseRef.current !== 'opening') return
        phaseRef.current = 'complete'
        setPhase('complete')
      }, flip)
      timers.current.push(flipTimer)
    }, hold)
    timers.current.push(holdTimer)
  }, [clearTimers])

  useEffect(() => {
    begin()
    return clearTimers
  }, [begin, clearTimers])

  useEffect(() => {
    function markHidden() {
      hiddenAt.current = Date.now()
    }
    function maybeResume() {
      if (document.visibilityState !== 'visible') return
      const at = hiddenAt.current
      if (at == null) return
      hiddenAt.current = null
      if (!shouldReplayOpening(at, Date.now(), JOURNAL_RESUME_THRESHOLD_MS)) return
      begin()
    }
    function onVisibility() {
      if (document.visibilityState === 'hidden') markHidden()
      else maybeResume()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', markHidden)
    window.addEventListener('pageshow', maybeResume)
    window.addEventListener('focus', maybeResume)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', markHidden)
      window.removeEventListener('pageshow', maybeResume)
      window.removeEventListener('focus', maybeResume)
    }
  }, [begin])

  useLayoutEffect(() => {
    if (phase === 'complete' || location.pathname === '/index') return
    navigate('/index', { replace: true })
  }, [phase, location.pathname, navigate])

  useEffect(() => {
    if (phase === 'complete') return
    document.documentElement.classList.add('journal-opening')
    return () => document.documentElement.classList.remove('journal-opening')
  }, [phase])

  const accelerate = useCallback(() => {
    const canTap = Date.now() - startedAt.current >= OPENING_TAP_DELAY_MS
    const next = nextOpeningPhase(phaseRef.current, 'tap', canTap)
    if (next === phaseRef.current) return
    clearTimers()
    phaseRef.current = next
    setPhase(next)
    if (next !== 'opening') return
    const flip = prefersReducedMotion() ? REDUCED_FADE_MS : Math.min(OPENING_FLIP_MS, 420)
    const flipTimer = window.setTimeout(() => {
      if (phaseRef.current !== 'opening') return
      phaseRef.current = 'complete'
      setPhase('complete')
    }, flip)
    timers.current.push(flipTimer)
  }, [clearTimers])

  return { phase, reduced, accelerate }
}
