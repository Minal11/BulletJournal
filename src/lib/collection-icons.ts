import type { CollectionIcon } from '../domain/types.ts'

export const COLLECTION_ICONS: CollectionIcon[] = ['none', 'plane', 'heart', 'star', 'book', 'leaf', 'home', 'bulb', 'pencil', 'sun']

/** Canonical cover names. Each button uses its own id. */
export const COLLECTION_ICON_LABEL: Record<CollectionIcon, string> = {
  none: 'None',
  plane: 'Plane',
  heart: 'Heart',
  star: 'Star',
  book: 'Book',
  leaf: 'Leaf',
  home: 'Home',
  bulb: 'Bulb',
  pencil: 'Pencil',
  sun: 'Sun',
}

export function collectionIconChoice(clicked: CollectionIcon): CollectionIcon {
  return clicked
}
