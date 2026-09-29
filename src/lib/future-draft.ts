/** A Future Log line keeps its own draft until Save. A store refresh must not put the old text back. */
export function futureDraftAfterRefresh(
  draft: { id: string; content: string; dirty: boolean },
  saved: { id: string; content: string } | null,
): { id: string; content: string; dirty: boolean } {
  if (!saved || saved.id !== draft.id) return { id: saved?.id ?? draft.id, content: saved?.content ?? draft.content, dirty: false }
  if (draft.dirty) return draft
  return { id: draft.id, content: saved.content, dirty: false }
}
