import type { OpeningPhase } from '../lib/journal-opening.ts'

const coverArt = `${import.meta.env.BASE_URL}cover/journal-cover.webp`

export function JournalCover({
  phase,
  reduced,
  onAccelerate,
}: {
  phase: Extract<OpeningPhase, 'closed' | 'opening'>
  reduced: boolean
  onAccelerate: () => void
}) {
  return (
    <div className={phase === 'opening' ? 'opening-scene is-opening' : 'opening-scene'} data-reduced={reduced || undefined}>
      <button type="button" className="opening-hit" aria-label="Open your journal" onClick={onAccelerate}>
        <span className="opening-stage">
          <span className="opening-book">
            <span className="opening-shadow" />
            <span className="opening-pages" />
            <span className="opening-cover">
              <span className="opening-front">
                <img className="opening-cover-art" src={coverArt} alt="" />
                <span className="opening-cover-text">My Bullet Journal. Capture everything. Commit to very little.</span>
              </span>
              <span className="opening-inside" />
            </span>
          </span>
        </span>
      </button>
    </div>
  )
}
