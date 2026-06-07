'use client'

import { useState, useRef, useEffect } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, MoreVertical, Trash2, Plus } from 'lucide-react'
import { PersonCard } from './PersonCard'
import type { WorkforceColumn, WorkforcePerson, WorkforceStatus, WorkforceTier } from '@/lib/workforce/types'

interface Props {
  column: WorkforceColumn
  people: WorkforcePerson[]
  statuses: WorkforceStatus[]
  tiers: WorkforceTier[]
  onRenameColumn: (id: string, name: string) => void
  onDeleteColumn: (id: string) => void
  onAddPerson: (data: { name: string; column_id: string }) => void
  onUpdatePerson: (id: string, updates: Partial<WorkforcePerson>) => void
  onDeletePerson: (id: string) => void
}

function ColumnMenu({ onDelete }: { onDelete: () => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="text-slate-400 hover:text-slate-600 p-0.5 rounded"
      >
        <MoreVertical size={14} />
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-36 bg-white rounded-md shadow-lg border border-slate-200 py-1">
          <button
            type="button"
            onClick={() => { onDelete(); setOpen(false) }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
          >
            <Trash2 size={12} /> Delete column
          </button>
        </div>
      )}
    </div>
  )
}

function AddPersonButton({ onCreate }: { onCreate: (name: string) => void }) {
  const [editing, setEditing] = useState(false)

  if (editing) {
    return (
      <input
        autoFocus
        placeholder="Name..."
        onBlur={e => { if (e.target.value.trim()) onCreate(e.target.value.trim()); setEditing(false) }}
        onKeyDown={e => {
          if (e.key === 'Enter') { if ((e.target as HTMLInputElement).value.trim()) onCreate((e.target as HTMLInputElement).value.trim()); setEditing(false) }
          if (e.key === 'Escape') setEditing(false)
        }}
        className="mt-2 w-full rounded-md border border-orange-400 ring-1 ring-orange-100 px-2.5 py-1.5 text-sm text-slate-900 focus:outline-none"
      />
    )
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-slate-300 py-2 text-xs text-slate-500 hover:border-slate-400 hover:text-slate-700 transition-colors"
    >
      <Plus size={12} /> Add person
    </button>
  )
}

export function BoardColumn({ column, people, statuses, tiers, onRenameColumn, onDeleteColumn, onAddPerson, onUpdatePerson, onDeletePerson }: Props) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: column.id,
    data: { type: 'column' },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const [editingName, setEditingName] = useState(false)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="w-72 flex-shrink-0 bg-slate-50 rounded-xl border border-slate-200 p-3 flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center gap-1.5 mb-3">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 p-0.5 shrink-0"
          title="Drag to reorder column"
        >
          <GripVertical size={14} />
        </button>

        {editingName ? (
          <input
            defaultValue={column.name}
            autoFocus
            onBlur={e => { const v = e.target.value.trim(); if (v) onRenameColumn(column.id, v); setEditingName(false) }}
            onKeyDown={e => {
              if (e.key === 'Enter') { const v = (e.target as HTMLInputElement).value.trim(); if (v) onRenameColumn(column.id, v); setEditingName(false) }
              if (e.key === 'Escape') setEditingName(false)
            }}
            className="flex-1 min-w-0 text-sm font-semibold text-slate-900 bg-white border border-orange-400 ring-1 ring-orange-100 rounded px-2 py-0.5 focus:outline-none"
          />
        ) : (
          <h3
            onClick={() => setEditingName(true)}
            className="flex-1 min-w-0 text-sm font-semibold text-slate-900 cursor-text hover:bg-slate-100 rounded px-2 py-0.5 truncate"
          >
            {column.name}
          </h3>
        )}

        <span className="shrink-0 text-xs text-slate-500 bg-slate-200 px-1.5 py-0.5 rounded font-medium">
          {people.length}
        </span>
        <ColumnMenu onDelete={() => onDeleteColumn(column.id)} />
      </div>

      {/* Cards */}
      <SortableContext items={people.map(p => p.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2 min-h-[40px]">
          {people.map(p => (
            <PersonCard
              key={p.id}
              person={p}
              statuses={statuses}
              tiers={tiers}
              onUpdate={updates => onUpdatePerson(p.id, updates)}
              onDelete={() => onDeletePerson(p.id)}
            />
          ))}
        </div>
      </SortableContext>

      <AddPersonButton onCreate={name => onAddPerson({ name, column_id: column.id })} />
    </div>
  )
}
