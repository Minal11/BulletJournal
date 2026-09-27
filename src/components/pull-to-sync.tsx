import { useEffect, useRef, useState, type RefObject } from 'react'
import { isEditableTarget } from '../lib/keyboard.ts'
import { canBeginPull, finishPull, pullCue, resistedPull } from '../lib/pull-sync.ts'
import { syncService } from '../services/syncService.ts'
import { cls } from './ui.tsx'

function scrollTopOf(node: HTMLElement | null): number {
  if (node && node.scrollHeight > node.clientHeight + 1) return node.scrollTop
  return document.scrollingElement?.scrollTop ?? window.scrollY ?? 0
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return Boolean(target.closest('button, a, select, .drag-handle, .symbol-btn, .entry-menu'))
}

export function PullToSync({ scrollerRef }: { scrollerRef: RefObject<HTMLElement | null> }) {
  const [distance, setDistance] = useState(0)
  const [rawDistance, setRawDistance] = useState(0)
  const [notice, setNotice] = useState('')
  const rawRef = useRef(0)
  const tracking = useRef(false)
  const ran = useRef(false)
  const startY = useRef(0)
  const startX = useRef(0)

  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return

    function onStart(event: TouchEvent) {
      if (event.touches.length !== 1) return
      const allowed = canBeginPull({
        pointer: 'touch',
        scrollTop: scrollTopOf(scroller),
        editable: isEditableTarget(event.target),
        interactive: isInteractiveTarget(event.target),
      })
      tracking.current = allowed
      ran.current = false
      startY.current = event.touches[0]?.clientY ?? 0
      startX.current = event.touches[0]?.clientX ?? 0
      if (!allowed) setDistance(0)
    }

    function onMove(event: TouchEvent) {
      if (!tracking.current || event.touches.length !== 1) return
      if (scrollTopOf(scroller) > 0) {
        tracking.current = false
        rawRef.current = 0
        setRawDistance(0)
        setDistance(0)
        return
      }
      const raw = (event.touches[0]?.clientY ?? startY.current) - startY.current
      const sideways = Math.abs((event.touches[0]?.clientX ?? startX.current) - startX.current)
      if (sideways > raw) {
        tracking.current = false
        rawRef.current = 0
        setRawDistance(0)
        setDistance(0)
        return
      }
      if (raw <= 0) {
        rawRef.current = 0
        setRawDistance(0)
        setDistance(0)
        return
      }
      rawRef.current = raw
      setRawDistance(raw)
      setDistance(resistedPull(raw))
      if (raw > 12) event.preventDefault()
    }

    function onEnd() {
      if (!tracking.current) return
      tracking.current = false
      const action = finishPull(rawRef.current, ran.current)
      rawRef.current = 0
      setRawDistance(0)
      setDistance(0)
      if (action === 'sync') {
        ran.current = true
        void runSync(setNotice)
      }
    }

    scroller.addEventListener('touchstart', onStart, { passive: true })
    scroller.addEventListener('touchmove', onMove, { passive: false })
    scroller.addEventListener('touchend', onEnd)
    scroller.addEventListener('touchcancel', onEnd)
    return () => {
      scroller.removeEventListener('touchstart', onStart)
      scroller.removeEventListener('touchmove', onMove)
      scroller.removeEventListener('touchend', onEnd)
      scroller.removeEventListener('touchcancel', onEnd)
    }
  }, [scrollerRef])

  const cue = pullCue(rawDistance)
  const label = notice || (cue === 'ready' ? '↻ Release to sync' : cue === 'pull' ? '↓ Pull to sync' : '')
  const open = distance > 6 || Boolean(notice)
  const height = notice ? 36 : distance

  return (
    <div className={cls('pull-sync', open && 'is-open')} style={{ height }} aria-live="polite">
      {label && <span>{label}</span>}
    </div>
  )
}

async function runSync(setNotice: (value: string) => void) {
  setNotice('↻ Syncing...')
  await syncService.syncNow()
  const latest = syncService.getSnapshot()
  const offline = typeof navigator !== 'undefined' && !navigator.onLine
  if (offline || latest.phase === 'offline') setNotice('Offline — changes are still saved locally')
  else if (latest.conflicts.length > 0) {
    setNotice('! Sync needs attention')
    document.dispatchEvent(new Event('bj-open-sync'))
  } else if (latest.phase === 'error') setNotice('Offline / Sync unavailable')
  else setNotice('✓ Up to date')
  window.setTimeout(() => setNotice(''), 1400)
}
