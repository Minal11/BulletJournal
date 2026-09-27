import type { MarkName } from '../domain/bullets.ts'

export function InkMark({ name }: { name: MarkName }) {
  return (
    <svg className="ink-mark" viewBox="0 0 24 24" aria-hidden="true">
      {name === 'task' && <circle cx="12" cy="12.5" r="3.15" fill="currentColor" />}
      {name === 'event' && <circle cx="12" cy="12.5" r="4.1" fill="none" stroke="currentColor" strokeWidth="1.7" />}
      {name === 'note' && <path d="M7 13.2h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />}
      {name === 'complete' && (
        <path d="M7.2 7.4 16.8 17M16.6 7.5 7.4 16.9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      )}
      {name === 'migrated' && <path d="M8 6.5 16 12.2 8 17.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />}
      {name === 'scheduled' && <path d="M16 6.5 8 12.2 16 17.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />}
      {name === 'cancelled' && <path d="M6 12.6h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />}
      {name === 'star' && (
        <path
          d="M12 4.4 13.7 9.1h4.9l-4 3.1 1.5 4.8L12 14.2 8 17l1.5-4.8-4-3.1h4.9z"
          fill="currentColor"
        />
      )}
      {name === 'check' && <circle cx="12" cy="12.5" r="4.1" fill="none" stroke="currentColor" strokeWidth="1.7" />}
      {name === 'checked' && <path d="M6.8 12.4 10.4 16l6.8-7.2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  )
}

export function CollectionGlyph({ name }: { name: string }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  return (
    <svg className="glyph" viewBox="0 0 24 24" aria-hidden="true">
      {name === 'plane' && <path {...common} d="M3 13.5 21 4.5 14 21l-2.2-6.2L3 13.5z" />}
      {name === 'heart' && <path {...common} d="M12 19s-6.5-4.1-6.5-8.2A3.4 3.4 0 0 1 12 8a3.4 3.4 0 0 1 6.5 2.8C18.5 14.9 12 19 12 19z" />}
      {name === 'star' && <path {...common} d="M12 4.5 14 9.4h5l-4 3.2 1.6 5L12 15.2 7.4 17.6 9 12.6l-4-3.2h5z" />}
      {name === 'book' && <path {...common} d="M5 5.5h6.2A3 3 0 0 1 14 8.2V19a2.4 2.4 0 0 0-2.2-1.2H5zM19 5.5h-6.2A3 3 0 0 0 10 8.2V19a2.4 2.4 0 0 1 2.2-1.2H19z" />}
      {name === 'leaf' && <path {...common} d="M6 16.5C6 9 12 5 19 5 18.5 14 14 19 6 16.5zM8 15c2-2 4.2-4.2 7.5-6.2" />}
      {name === 'home' && <path {...common} d="M4.5 11.5 12 5l7.5 6.5V19H4.5z" />}
      {name === 'bulb' && <path {...common} d="M9 16.5h6M10 19h4M12 5a5 5 0 0 0-2.8 9.1c.4.4.8 1 .8 1.6V16.5h4v-.8c0-.6.4-1.2.8-1.6A5 5 0 0 0 12 5z" />}
      {name === 'pencil' && <path {...common} d="M14 5.5 18.5 10 9 19.5H4.5V15z" />}
      {name === 'sun' && (
        <>
          <circle {...common} cx="12" cy="12" r="3.2" />
          <path {...common} d="M12 4.5v2M12 17.5v2M4.5 12h2M17.5 12h2M6.4 6.4l1.4 1.4M16.2 16.2l1.4 1.4M17.6 6.4l-1.4 1.4M7.8 16.2l-1.4 1.4" />
        </>
      )}
      {name === 'none' && <circle {...common} cx="12" cy="12" r="2.2" />}
    </svg>
  )
}
