'use client'

import { useState, useRef, useEffect } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { MoreVertical, Trash2 } from 'lucide-react'
import type { WorkforcePerson, WorkforceStatus, WorkforceTier } from '@/lib/workforce/types'

interface Props {
  person: WorkforcePerson
  statuses: WorkforceStatus[]
  tiers: WorkforceTier[]
  onUpdate?: (updates: Partial<WorkforcePerson>) => void
  onDelete?: () => void
  isDragging?: boolean
}

function TierPicker({
  value,
  tiers,
  onChange,
}: {
  value: string | null
  tiers: WorkforceTier[]
  onChange: (id: string | null) => void
}) {
  const tier = tiers.find(t => t.id === value)
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
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={e => { e.stopPropagation(); setOpen(o => !o) }}
        className="w-7 h-7 rounded-md font-bold text-xs text-white flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity"
        style={{ backgroundColor: tier?.color ?? '#94a3b8' }}
        title="Change tier"
      >
        {tier?.label ?? '?'}
      </button>
      {open && (
        <div className="absolute z-20 mt-1 left-0 bg-white rounded-md shadow-lg border border-slate-200 p-1.5 flex flex-col gap-1 min-w-[44px]">
          {[...tiers].sort((a, b) => a.position - b.position).map(t => (
            <button
              key={t.id}
              type="button"
              onClick={e => { e.stopPropagation(); onChange(t.id); setOpen(false) }}
              className="w-7 h-7 rounded font-bold text-xs text-white hover:scale-110 transition-transform mx-auto"
              style={{ backgroundColor: t.color }}
              title={t.label}
            >
              {t.label}
            </button>
          ))}
          {value && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onChange(null); setOpen(false) }}
              className="w-full rounded text-[10px] text-slate-400 hover:text-slate-600 py-0.5"
            >
              clear
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function StatusPicker({
  value,
  statuses,
  onChange,
}: {
  value: string | null
  statuses: WorkforceStatus[]
  onChange: (id: string | null) => void
}) {
  const status = statuses.find(s => s.id === value)
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
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={e => { e.stopPropagation(); setOpen(o => !o) }}
        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white cursor-pointer hover:opacity-80 transition-opacity"
        style={{ backgroundColor: status?.color ?? '#94a3b8' }}
        title="Change status"
      >
        {status?.label ?? 'Set status'}
      </button>
      {open && (
        <div className="absolute z-20 mt-1 left-0 bg-white rounded-md shadow-lg border border-slate-200 p-1.5 flex flex-col gap-1 min-w-[110px]">
          {[...statuses].sort((a, b) => a.position - b.position).map(s => (
            <button
              key={s.id}
              type="button"
              onClick={e => { e.stopPropagation(); onChange(s.id); setOpen(false) }}
              className="flex items-center gap-2 rounded px-2 py-1 text-xs font-semibold text-white hover:opacity-90 transition-opacity"
              style={{ backgroundColor: s.color }}
            >
              {s.label}
            </button>
          ))}
          {value && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onChange(null); setOpen(false) }}
              className="rounded px-2 py-1 text-[10px] text-slate-400 hover:text-slate-600"
            >
              clear
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function PersonMenu({ onDelete }: { onDelete?: () => void }) {
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
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={e => { e.stopPropagation(); setOpen(o => !o) }}
        className="text-slate-400 hover:text-slate-600 p-0.5 rounded"
      >
        <MoreVertical size={14} />
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-32 bg-white rounded-md shadow-lg border border-slate-200 py-1">
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onDelete?.(); setOpen(false) }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
          >
            <Trash2 size={12} /> Delete
          </button>
        </div>
      )}
    </div>
  )
}

export function PersonCard({ person, statuses, tiers, onUpdate, onDelete, isDragging }: Props) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging: sortableDragging } =
    useSortable({ id: person.id, data: { type: 'person' } })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: sortableDragging || isDragging ? 0.4 : 1,
  }

  const status = statuses.find(s => s.id === person.status_id)

  const [editingName, setEditingName] = useState(false)
  const [editingRole, setEditingRole] = useState(false)

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        borderLeftColor: status?.color ?? '#e2e8f0',
        borderLeftWidth: 4,
      }}
      className="bg-white rounded-md shadow-sm border border-slate-200 p-3 select-none"
    >
      <div className="flex items-start gap-2">
        <TierPicker
          value={person.tier_id}
          tiers={tiers}
          onChange={tier_id => onUpdate?.({ tier_id })}
        />

        <div className="flex-1 min-w-0">
          {/* Drag handle wraps name + role */}
          <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
            {editingName ? (
              <input
                defaultValue={person.name}
                autoFocus
                onBlur={e => { onUpdate?.({ name: e.target.value.trim() || person.name }); setEditingName(false) }}
                onKeyDown={e => {
                  if (e.key === 'Enter') { onUpdate?.({ name: (e.target as HTMLInputElement).value.trim() || person.name }); setEditingName(false) }
                  if (e.key === 'Escape') setEditingName(false)
                }}
                onClick={e => e.stopPropagation()}
                className="text-sm font-medium text-slate-900 bg-white border border-orange-400 ring-1 ring-orange-100 rounded px-1.5 py-0.5 w-full focus:outline-none"
              />
            ) : (
              <h4
                onClick={e => { e.stopPropagation(); setEditingName(true) }}
                className="text-sm font-medium text-slate-900 truncate cursor-text hover:bg-slate-50 rounded px-0.5"
              >
                {person.name}
              </h4>
            )}
          </div>

          {editingRole ? (
            <input
              defaultValue={person.role ?? ''}
              autoFocus
              placeholder="Role (e.g. Crew Lead)"
              onBlur={e => { onUpdate?.({ role: e.target.value.trim() || null }); setEditingRole(false) }}
              onKeyDown={e => {
                if (e.key === 'Enter') { onUpdate?.({ role: (e.target as HTMLInputElement).value.trim() || null }); setEditingRole(false) }
                if (e.key === 'Escape') setEditingRole(false)
              }}
              onClick={e => e.stopPropagation()}
              className="text-xs text-slate-600 bg-white border border-orange-400 ring-1 ring-orange-100 rounded px-1.5 py-0.5 mt-0.5 w-full focus:outline-none"
            />
          ) : (
            <p
              onClick={e => { e.stopPropagation(); setEditingRole(true) }}
              className="text-xs text-slate-500 mt-0.5 cursor-text hover:bg-slate-50 rounded px-0.5"
            >
              {person.role ?? <span className="italic text-slate-400">+ Add role</span>}
            </p>
          )}

          <div className="mt-2">
            <StatusPicker
              value={person.status_id}
              statuses={statuses}
              onChange={status_id => onUpdate?.({ status_id })}
            />
          </div>
        </div>

        <PersonMenu onDelete={onDelete} />
      </div>
    </div>
  )
}
