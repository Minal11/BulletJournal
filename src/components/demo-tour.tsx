import { useEffect, useRef, useState } from 'react'

const base = import.meta.env.BASE_URL

export function DemoTourButton({ label, className = 'quiet-btn' }: { label: string; className?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        {label}
      </button>
      <DemoTourDialog open={open} onClose={() => setOpen(false)} />
    </>
  )
}

function DemoTourDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
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
      className="tour-dialog"
      aria-label="Demo tour"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
    >
      <p className="kicker">A short tour</p>
      {open && (
        <video controls playsInline preload="metadata" poster={`${base}demo/bullet-journal-tour-poster.webp`}>
          <source src={`${base}demo/bullet-journal-tour.mp4`} type="video/mp4" />
        </video>
      )}
      <p className="dialog-actions">
        <button type="button" className="quiet-btn" onClick={onClose}>
          Close
        </button>
      </p>
    </dialog>
  )
}
