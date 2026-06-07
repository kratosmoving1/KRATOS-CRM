'use client'

import { useState, useCallback } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, horizontalListSortingStrategy } from '@dnd-kit/sortable'
import { Plus } from 'lucide-react'
import { BoardColumn } from './BoardColumn'
import { PersonCard } from './PersonCard'
import type { BoardState, WorkforceColumn, WorkforcePerson } from '@/lib/workforce/types'

interface Props {
  initial: BoardState
}

function AddColumnButton({ onCreate }: { onCreate: (name: string) => void }) {
  const [editing, setEditing] = useState(false)

  if (editing) {
    return (
      <div className="w-72 flex-shrink-0">
        <input
          autoFocus
          placeholder="Column name..."
          onBlur={e => { if (e.target.value.trim()) onCreate(e.target.value.trim()); setEditing(false) }}
          onKeyDown={e => {
            if (e.key === 'Enter') { if ((e.target as HTMLInputElement).value.trim()) onCreate((e.target as HTMLInputElement).value.trim()); setEditing(false) }
            if (e.key === 'Escape') setEditing(false)
          }}
          className="w-full rounded-xl border-2 border-orange-400 bg-white px-3 py-3 text-sm focus:outline-none"
        />
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="w-72 flex-shrink-0 flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 py-4 text-sm text-slate-500 hover:border-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
    >
      <Plus size={15} /> Add Column
    </button>
  )
}

export function WorkforceBoard({ initial }: Props) {
  const [columns, setColumns] = useState<WorkforceColumn[]>(initial.columns)
  const [people, setPeople] = useState<WorkforcePerson[]>(initial.people)
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const [activeDragType, setActiveDragType] = useState<'column' | 'person' | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  )

  const peopleInColumn = useCallback((colId: string | null) =>
    people
      .filter(p => p.column_id === colId)
      .sort((a, b) => a.position - b.position),
    [people]
  )

  // ── Drag handlers ──────────────────────────────────────────────────────────

  function handleDragStart(e: DragStartEvent) {
    setActiveDragId(String(e.active.id))
    setActiveDragType(e.active.data.current?.type ?? null)
  }

  function handleDragOver(e: DragOverEvent) {
    const { active, over } = e
    if (!over || active.data.current?.type !== 'person') return

    const activePerson = people.find(p => p.id === active.id)
    if (!activePerson) return

    const overId = String(over.id)
    let overColumnId: string | null = null

    if (over.data.current?.type === 'column') {
      overColumnId = overId
    } else if (over.data.current?.type === 'person') {
      const overPerson = people.find(p => p.id === overId)
      overColumnId = overPerson?.column_id ?? null
    }

    if (overColumnId !== undefined && overColumnId !== activePerson.column_id) {
      setPeople(prev =>
        prev.map(p => p.id === activePerson.id ? { ...p, column_id: overColumnId } : p)
      )
    }
  }

  async function handleDragEnd(e: DragEndEvent) {
    setActiveDragId(null)
    setActiveDragType(null)
    const { active, over } = e
    if (!over) return

    // ── Column reorder ────────────────────────────────────────────────────────
    if (active.data.current?.type === 'column' && over.data.current?.type === 'column') {
      const oldIdx = columns.findIndex(c => c.id === active.id)
      const newIdx = columns.findIndex(c => c.id === over.id)
      if (oldIdx === newIdx) return

      const reordered = arrayMove(columns, oldIdx, newIdx).map((c, i) => ({ ...c, position: i }))
      setColumns(reordered)

      await fetch('/api/admin/workforce/columns/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: reordered.map(({ id, position }) => ({ id, position })) }),
      })
      return
    }

    // ── Card move (within or between columns) ─────────────────────────────────
    if (active.data.current?.type === 'person') {
      const movingPerson = people.find(p => p.id === active.id)
      if (!movingPerson) return

      const targetColumnId = movingPerson.column_id
      const inTarget = peopleInColumn(targetColumnId)

      let destIdx = inTarget.length > 0 ? inTarget.length - 1 : 0
      if (over.data.current?.type === 'person') {
        const idx = inTarget.findIndex(p => p.id === over.id)
        if (idx !== -1) destIdx = idx
      }

      const srcIdx = inTarget.findIndex(p => p.id === active.id)
      const effectiveSrcIdx = srcIdx === -1 ? inTarget.length - 1 : srcIdx

      const reorderedInCol = arrayMove(inTarget, effectiveSrcIdx, destIdx)
      const withPositions = reorderedInCol.map((p, i) => ({ ...p, position: i }))

      const updatedPeople = people.map(p => {
        const updated = withPositions.find(x => x.id === p.id)
        return updated ?? p
      })
      setPeople(updatedPeople)

      const updates = withPositions.map(({ id, column_id, position }) => ({ id, column_id, position }))

      await fetch('/api/admin/workforce/people/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      })
    }
  }

  // ── Column CRUD ────────────────────────────────────────────────────────────

  async function handleAddColumn(name: string) {
    const res = await fetch('/api/admin/workforce/columns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    if (res.ok) {
      const col: WorkforceColumn = await res.json()
      setColumns(prev => [...prev, col])
    }
  }

  async function handleRenameColumn(id: string, name: string) {
    const res = await fetch(`/api/admin/workforce/columns/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    if (res.ok) {
      setColumns(prev => prev.map(c => c.id === id ? { ...c, name } : c))
    }
  }

  async function handleDeleteColumn(id: string) {
    const res = await fetch(`/api/admin/workforce/columns/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setColumns(prev => prev.filter(c => c.id !== id))
      // People in this column become unassigned (column_id = null)
      setPeople(prev => prev.map(p => p.column_id === id ? { ...p, column_id: null } : p))
    }
  }

  // ── People CRUD ────────────────────────────────────────────────────────────

  async function handleAddPerson({ name, column_id }: { name: string; column_id: string }) {
    const res = await fetch('/api/admin/workforce/people', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, column_id }),
    })
    if (res.ok) {
      const person: WorkforcePerson = await res.json()
      setPeople(prev => [...prev, person])
    }
  }

  async function handleUpdatePerson(id: string, updates: Partial<WorkforcePerson>) {
    // Optimistic update
    setPeople(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p))

    await fetch(`/api/admin/workforce/people/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
  }

  async function handleDeletePerson(id: string) {
    const res = await fetch(`/api/admin/workforce/people/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setPeople(prev => prev.filter(p => p.id !== id))
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const activePerson = activeDragId && activeDragType === 'person'
    ? people.find(p => p.id === activeDragId) ?? null
    : null

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-6 items-start">
        <SortableContext items={columns.map(c => c.id)} strategy={horizontalListSortingStrategy}>
          {columns.map(column => (
            <BoardColumn
              key={column.id}
              column={column}
              people={peopleInColumn(column.id)}
              statuses={initial.statuses}
              tiers={initial.tiers}
              onRenameColumn={handleRenameColumn}
              onDeleteColumn={handleDeleteColumn}
              onAddPerson={handleAddPerson}
              onUpdatePerson={handleUpdatePerson}
              onDeletePerson={handleDeletePerson}
            />
          ))}
        </SortableContext>

        <AddColumnButton onCreate={handleAddColumn} />
      </div>

      <DragOverlay>
        {activePerson ? (
          <PersonCard
            person={activePerson}
            statuses={initial.statuses}
            tiers={initial.tiers}
            isDragging
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
