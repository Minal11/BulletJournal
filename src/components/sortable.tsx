import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { ReactNode } from 'react'
import { moveIds } from '../domain/entries.ts'

export function SortableList({
  ids,
  onReorder,
  children,
  label,
}: {
  ids: string[]
  onReorder: (ids: string[]) => void
  children: ReactNode
  label: string
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    onReorder(moveIds(ids, String(active.id), String(over.id)))
  }
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div role="list" aria-label={label}>
          {children}
        </div>
      </SortableContext>
    </DndContext>
  )
}

export function SortableRow({ id, children }: { id: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id })
  return (
    <div
      ref={setNodeRef}
      role="listitem"
      className="sortable-row"
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <button type="button" className="drag-handle" aria-label="Drag to reorder" {...attributes} {...listeners}>
        <span />
        <span />
      </button>
      <div className="sortable-body">{children}</div>
    </div>
  )
}
