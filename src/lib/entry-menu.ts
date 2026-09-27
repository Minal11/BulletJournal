export interface MenuAnchor {
  top: number
  bottom: number
  left: number
  right: number
}

export interface MenuViewport {
  width: number
  height: number
  safeBottom?: number
  topInset?: number
}

export interface MenuBox {
  top: number
  left: number
  width: number
  maxHeight: number
}

/** Place the entry menu beside its button, flipping above when the lower page is too short. */
export function placeEntryMenu(anchor: MenuAnchor, menuHeight: number, viewport: MenuViewport): MenuBox {
  const margin = 8
  const safeBottom = viewport.safeBottom ?? 0
  const topInset = viewport.topInset ?? 0
  const width = Math.min(256, Math.max(160, viewport.width - margin * 2))
  const left = Math.max(margin, Math.min(anchor.right - width, viewport.width - width - margin))
  const spaceBelow = viewport.height - anchor.bottom - margin - safeBottom
  const spaceAbove = anchor.top - margin - topInset
  const below = spaceBelow >= 160 || spaceBelow >= spaceAbove
  const maxHeight = Math.max(120, Math.min(below ? spaceBelow : spaceAbove, viewport.height - margin * 2 - safeBottom - topInset))
  const height = Math.min(Math.max(menuHeight, 1), maxHeight)
  const top = below ? anchor.bottom + 4 : Math.max(margin + topInset, anchor.top - 4 - height)
  return { top, left, width, maxHeight }
}

/** Drop the menu once its entry leaves the scrolling page. */
export function menuOnScroll(anchorTop: number, anchorBottom: number, frameTop: number, frameBottom: number): 'place' | 'close' {
  if (anchorBottom < frameTop + 4 || anchorTop > frameBottom - 4) return 'close'
  return 'place'
}

let owner: string | null = null

/** Opening a menu replaces whichever entry had it. */
export function claimEntryMenu(id: string): string {
  owner = id
  return owner
}

export function entryMenuOwner(): string | null {
  return owner
}

export function releaseEntryMenu(id: string): void {
  if (owner === id) owner = null
}
