'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  ArrowLeft, ChevronLeft, ChevronRight,
  Truck, CalendarDays, Inbox, Package, MapPin, Plus, X, Users, CheckCircle,
} from 'lucide-react'
import { Avatar } from '@/components/admin/workforce/Avatar'
import { formatCurrency } from '@/lib/format'
import type { DispatchCalendarEvent } from '@/lib/dispatch/calendar'
import type {
  DayDetailData, DispatchTruck, DispatchJobAssignment, DispatchCrewMember,
} from '@/lib/dispatch/types'

// ─── Constants ────────────────────────────────────────────────────────────────

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]

const CATEGORY_LABELS: Record<string, string> = { owned: 'Owned', rental: 'Rentals', contractor: 'Contractor' }
const CATEGORY_ORDER = ['owned', 'rental', 'contractor']
const PROVIDERS = ['Penske', 'Ryder', 'U-Haul', 'Home Depot', 'Other']
const SIZES = [
  { key: 'cargo_van', label: 'Cargo Van' },
  { key: '10ft', label: '10 ft' },
  { key: '15ft', label: '15 ft' },
  { key: '16ft', label: '16 ft' },
  { key: '20ft', label: '20 ft' },
  { key: '26ft', label: '26 ft' },
]

function formatHour(h: number) {
  if (h === 12) return '12p'
  if (h > 12) return `${h - 12}p`
  return `${h}a`
}

function formatDateForApi(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  date: Date
  initialData: DayDetailData
}

export function DispatchDayDetail({ date, initialData }: Props) {
  const router = useRouter()
  const [trucks, setTrucks] = useState<DispatchTruck[]>(initialData.trucks)
  const [crew] = useState<DispatchCrewMember[]>(initialData.crew)
  const [events] = useState<DispatchCalendarEvent[]>(initialData.events)
  const [assignments, setAssignments] = useState<DispatchJobAssignment[]>(initialData.assignments)
  const [activeJobId, setActiveJobId] = useState<string | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const activeEvent = events.find(e => e.id === activeJobId) ?? null

  const totalRevenue = events.reduce((sum, e) => sum + (e.total ?? 0), 0)
  const bookedCount = events.filter(e => e.status === 'booked').length
  const completedCount = events.filter(e => e.status === 'completed').length

  function navigateByDays(delta: number) {
    const newDate = new Date(date)
    newDate.setDate(date.getDate() + delta)
    router.push(`/admin/dispatch/calendar/${formatDateForApi(newDate)}`)
  }

  function handleDragStart(e: DragStartEvent) {
    if (e.active.data.current?.type === 'job') {
      setActiveJobId(e.active.data.current.opportunityId as string)
    }
  }

  async function handleDragEnd(e: DragEndEvent) {
    setActiveJobId(null)
    const { active, over } = e
    if (!over) return
    if (active.data.current?.type !== 'job') return
    if (over.data.current?.type !== 'truck') return

    const opportunityId = active.data.current.opportunityId as string
    const truckId = over.data.current.truckId as string
    const dateStr = formatDateForApi(date)
    const event = events.find(ev => ev.id === opportunityId)

    const tempId = `temp-${crypto.randomUUID()}`
    const optimistic: DispatchJobAssignment = {
      id: tempId,
      opportunity_id: opportunityId,
      truck_id: truckId,
      scheduled_date: dateStr,
      start_time: '08:00',
      duration_hours: 3,
      notes: null,
      created_by: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_deleted: false,
      deleted_at: null,
      opportunity: {
        id: opportunityId,
        move_size: event?.move_size ?? null,
        origin_city: event?.origin_city ?? null,
        dest_city: event?.dest_city ?? null,
        total_amount: event?.total ?? null,
        customer: { id: '', full_name: event?.customer_name ?? 'Unknown' },
      },
    }

    setAssignments(prev => [...prev, optimistic])

    try {
      const res = await fetch('/api/admin/dispatch/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opportunity_id: opportunityId, truck_id: truckId, scheduled_date: dateStr }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(j.error ?? 'Assignment failed')
      }
      const created = await res.json() as DispatchJobAssignment
      setAssignments(prev => prev.map(a => a.id === tempId ? created : a))
    } catch (err) {
      console.error('[dispatch] assign failed:', err)
      setAssignments(prev => prev.filter(a => a.id !== tempId))
    }
  }

  async function handleUnassign(assignmentId: string) {
    const previous = assignments
    setAssignments(prev => prev.filter(a => a.id !== assignmentId))
    try {
      const res = await fetch(`/api/admin/dispatch/assignments/${assignmentId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Unassign failed')
    } catch (err) {
      console.error('[dispatch] unassign failed:', err)
      setAssignments(previous)
    }
  }

  async function refreshTrucks() {
    const res = await fetch('/api/admin/dispatch/trucks')
    if (res.ok) setTrucks(await res.json() as DispatchTruck[])
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Link
            href={`/admin/dispatch/calendar?year=${date.getFullYear()}&month=${date.getMonth()}`}
            className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to month
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigateByDays(-1)}
              className="p-1.5 rounded-md hover:bg-slate-100 text-slate-600"
              aria-label="Previous day"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <h2 className="text-lg font-semibold text-slate-900 min-w-[280px] text-center">
              {DAY_NAMES[date.getDay()]}, {MONTH_NAMES[date.getMonth()]} {date.getDate()}, {date.getFullYear()}
            </h2>
            <button
              onClick={() => navigateByDays(1)}
              className="p-1.5 rounded-md hover:bg-slate-100 text-slate-600"
              aria-label="Next day"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Booked moves" value={bookedCount} />
          <StatCard label="Completed" value={completedCount} />
          <StatCard label="Revenue (day)" value={totalRevenue > 0 ? formatCurrency(totalRevenue) : '—'} />
        </div>

        {/* Three-column layout */}
        <div className="grid grid-cols-1 md:grid-cols-[260px_1fr_300px] gap-3 min-h-[400px]">
          <ResourcesPanel trucks={trucks} crew={crew} onTrucksChanged={refreshTrucks} />
          <ScheduleGrid trucks={trucks} assignments={assignments} onUnassign={handleUnassign} />
          <JobsPanel events={events} assignments={assignments} />
        </div>
      </div>

      {/* Drag overlay — follows cursor */}
      <DragOverlay>
        {activeEvent ? <JobCardOverlay event={activeEvent} /> : null}
      </DragOverlay>
    </DndContext>
  )
}

// ─── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-3">
      <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">{label}</p>
      <p className="text-xl font-semibold text-slate-900 mt-1">{value}</p>
    </div>
  )
}

// ─── Resources panel ──────────────────────────────────────────────────────────

interface ResourcesPanelProps {
  trucks: DispatchTruck[]
  crew: DispatchCrewMember[]
  onTrucksChanged: () => void
}

function ResourcesPanel({ trucks, crew, onTrucksChanged }: ResourcesPanelProps) {
  const [tab, setTab] = useState<'trucks' | 'crew'>('trucks')

  return (
    <div className="bg-white rounded-lg border border-slate-200 flex flex-col overflow-hidden">
      <div className="px-3 py-2.5 border-b border-slate-200 flex-shrink-0">
        <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Resources</h3>
      </div>
      <div className="flex border-b border-slate-200 flex-shrink-0">
        <button
          onClick={() => setTab('trucks')}
          className={`flex-1 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${tab === 'trucks' ? 'border-orange-500 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          Trucks ({trucks.length})
        </button>
        <button
          onClick={() => setTab('crew')}
          className={`flex-1 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${tab === 'crew' ? 'border-orange-500 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          Crew ({crew.length})
        </button>
      </div>
      {tab === 'trucks'
        ? <TrucksTab trucks={trucks} onAdded={onTrucksChanged} />
        : <CrewTab crew={crew} />}
    </div>
  )
}

// ─── Trucks tab ────────────────────────────────────────────────────────────────

interface TrucksTabProps {
  trucks: DispatchTruck[]
  onAdded: () => void
}

function TrucksTab({ trucks, onAdded }: TrucksTabProps) {
  const [adding, setAdding] = useState(false)

  const grouped: Record<string, DispatchTruck[]> = {}
  for (const t of trucks) {
    if (!grouped[t.category]) grouped[t.category] = []
    grouped[t.category].push(t)
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {trucks.length === 0 && !adding && (
          <div className="p-4 text-center">
            <Truck className="w-7 h-7 text-slate-300 mx-auto mb-2" />
            <p className="text-xs text-slate-500">No trucks yet. Add your first one.</p>
          </div>
        )}
        {CATEGORY_ORDER.map(cat => {
          const list = grouped[cat]
          if (!list || list.length === 0) return null
          return (
            <div key={cat}>
              <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide px-1 mb-1">
                {CATEGORY_LABELS[cat]} ({list.length})
              </div>
              <div className="space-y-0.5">
                {list.map(t => <TruckRow key={t.id} truck={t} />)}
              </div>
            </div>
          )
        })}
        {adding && (
          <AddTruckForm
            onClose={() => setAdding(false)}
            onAdded={() => { setAdding(false); onAdded() }}
          />
        )}
      </div>
      {!adding && (
        <div className="p-2 border-t border-slate-200 flex-shrink-0">
          <button
            onClick={() => setAdding(true)}
            className="w-full px-3 py-1.5 rounded-md bg-orange-500 hover:bg-orange-600 text-white text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add truck
          </button>
        </div>
      )}
    </div>
  )
}

function TruckRow({ truck }: { truck: DispatchTruck }) {
  return (
    <div className="px-2 py-1.5 rounded-md hover:bg-slate-50 flex items-center gap-2 text-xs">
      <div className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center flex-shrink-0">
        <Truck className="w-3 h-3 text-slate-500" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-slate-900 truncate">{truck.name}</div>
        <div className="text-[10px] text-slate-500">
          {truck.size.replace('_', ' ')}{truck.provider ? ` · ${truck.provider}` : ''}
        </div>
      </div>
    </div>
  )
}

interface AddTruckFormProps {
  onClose: () => void
  onAdded: () => void
}

function AddTruckForm({ onClose, onAdded }: AddTruckFormProps) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState<'owned' | 'rental' | 'contractor'>('owned')
  const [provider, setProvider] = useState('')
  const [size, setSize] = useState('16ft')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    if (!name.trim()) { setError('Name is required'); return }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/dispatch/trucks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          category,
          size,
          provider: category === 'rental' ? (provider || null) : null,
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(j.error ?? 'Failed to add truck')
      }
      onAdded()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-3 bg-orange-50 border border-orange-200 rounded-md space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-900">New truck</p>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <input
        type="text"
        autoFocus
        placeholder="Name (e.g. Penske 26ft #1)"
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
        className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-orange-400"
      />
      <div className="flex gap-1">
        {(['owned', 'rental', 'contractor'] as const).map(c => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`flex-1 px-2 py-1 text-[10px] rounded font-medium transition-colors ${category === c ? 'bg-orange-500 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
          >
            {CATEGORY_LABELS[c]}
          </button>
        ))}
      </div>
      {category === 'rental' && (
        <select
          value={provider}
          onChange={e => setProvider(e.target.value)}
          className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-orange-400 bg-white"
        >
          <option value="">— Select provider —</option>
          {PROVIDERS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      )}
      <select
        value={size}
        onChange={e => setSize(e.target.value)}
        className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-orange-400 bg-white"
      >
        {SIZES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
      </select>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full px-2 py-1.5 rounded bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium disabled:opacity-50 transition-colors"
      >
        {saving ? 'Saving…' : 'Save truck'}
      </button>
    </div>
  )
}

// ─── Crew tab ──────────────────────────────────────────────────────────────────

function CrewTab({ crew }: { crew: DispatchCrewMember[] }) {
  if (crew.length === 0) {
    return (
      <div className="p-5 text-center flex-1 flex flex-col items-center justify-center">
        <Users className="w-8 h-8 text-slate-300 mb-2" />
        <p className="text-xs text-slate-500 mb-1">No crew members yet.</p>
        <Link href="/admin/dispatch/workforce" className="text-xs text-orange-600 hover:text-orange-700 font-medium">
          Add people in Workforce
        </Link>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
      {crew.map(person => (
        <div key={person.id} className="px-2 py-1.5 rounded-md hover:bg-slate-50 flex items-center gap-2 text-xs">
          <Avatar src={person.profile_picture_url} name={person.name} size="sm" />
          <div className="flex-1 min-w-0">
            <div className="font-medium text-slate-900 truncate">{person.name}</div>
            <div className="text-[10px] text-slate-500 truncate">
              {person.role_data?.label ?? person.role ?? 'No role'}
              {person.status ? ` · ${person.status.label}` : ''}
            </div>
          </div>
          {person.tier && (
            <span
              className="text-[10px] font-bold text-white rounded px-1 py-0.5 flex-shrink-0"
              style={{ backgroundColor: person.tier.color }}
            >
              {person.tier.label}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Schedule grid ────────────────────────────────────────────────────────────

interface ScheduleGridProps {
  trucks: DispatchTruck[]
  assignments: DispatchJobAssignment[]
  onUnassign: (assignmentId: string) => void
}

function ScheduleGrid({ trucks, assignments, onUnassign }: ScheduleGridProps) {
  if (trucks.length === 0) {
    return <EmptyScheduleGrid />
  }

  const gridCols = `140px repeat(${HOURS.length}, minmax(0, 1fr))`

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden flex flex-col">
      <div className="px-3 py-2.5 border-b border-slate-200 flex-shrink-0">
        <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Schedule</h3>
      </div>

      {/* Hours header row */}
      <div className="grid border-b border-slate-200 bg-slate-50 flex-shrink-0" style={{ gridTemplateColumns: gridCols }}>
        <div className="border-r border-slate-200" />
        {HOURS.map((h, i) => (
          <div
            key={h}
            className={`px-1 py-1.5 text-[11px] font-medium text-slate-500 text-center ${i < HOURS.length - 1 ? 'border-r border-slate-100' : ''}`}
          >
            {formatHour(h)}
          </div>
        ))}
      </div>

      {/* Truck rows */}
      <div className="flex-1 overflow-y-auto">
        {trucks.map(truck => (
          <TruckScheduleRow
            key={truck.id}
            truck={truck}
            assignments={assignments.filter(a => a.truck_id === truck.id)}
            onUnassign={onUnassign}
            gridCols={gridCols}
          />
        ))}
      </div>
    </div>
  )
}

function EmptyScheduleGrid() {
  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden flex flex-col">
      <div className="px-3 py-2.5 border-b border-slate-200 flex-shrink-0">
        <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Schedule</h3>
      </div>
      <div
        className="grid border-b border-slate-200 bg-slate-50 flex-shrink-0"
        style={{ gridTemplateColumns: `repeat(${HOURS.length}, minmax(0, 1fr))` }}
      >
        {HOURS.map((h, i) => (
          <div
            key={h}
            className={`px-2 py-1.5 text-[11px] font-medium text-slate-500 text-center ${i < HOURS.length - 1 ? 'border-r border-slate-100' : ''}`}
          >
            {formatHour(h)}
          </div>
        ))}
      </div>
      <div
        className="flex-1 min-h-[280px] flex flex-col items-center justify-center p-8"
        style={{
          backgroundImage: `linear-gradient(to right, rgb(248 250 252) 0, rgb(248 250 252) 1px, transparent 1px, transparent calc(100% / ${HOURS.length}))`,
          backgroundSize: `calc(100% / ${HOURS.length}) 100%`,
        }}
      >
        <CalendarDays className="w-10 h-10 text-slate-300 mb-3" />
        <p className="text-sm font-medium text-slate-700">Schedule grid will appear here</p>
        <p className="text-xs text-slate-500 mt-1 max-w-md text-center leading-relaxed">
          Once trucks and crew are added, each truck gets a row across this grid.
          Drag jobs from the right panel onto a truck row to schedule a move at that time.
        </p>
      </div>
    </div>
  )
}

interface TruckScheduleRowProps {
  truck: DispatchTruck
  assignments: DispatchJobAssignment[]
  onUnassign: (assignmentId: string) => void
  gridCols: string
}

function TruckScheduleRow({ truck, assignments, onUnassign, gridCols }: TruckScheduleRowProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `truck-${truck.id}`,
    data: { type: 'truck', truckId: truck.id },
  })

  return (
    <div
      ref={setNodeRef}
      className={`grid border-b border-slate-100 min-h-[68px] transition-colors ${isOver ? 'bg-orange-50' : 'hover:bg-slate-50/50'}`}
      style={{ gridTemplateColumns: gridCols }}
    >
      {/* Truck label */}
      <div className="px-2 py-2 border-r border-slate-200 flex items-start gap-1.5 flex-shrink-0">
        <Truck className="w-3 h-3 text-slate-400 flex-shrink-0 mt-0.5" />
        <div className="min-w-0">
          <div className="text-xs font-medium text-slate-900 truncate leading-tight">{truck.name}</div>
          <div className="text-[10px] text-slate-500 truncate">{truck.size.replace('_', ' ')}</div>
        </div>
      </div>

      {/* Schedule area — spans all hour columns */}
      <div className="p-1.5" style={{ gridColumn: '2 / -1' }}>
        {assignments.length === 0 ? (
          <div className={`h-full flex items-center justify-center text-[11px] ${isOver ? 'text-orange-400 font-medium' : 'text-slate-300'}`}>
            {isOver ? 'Release to schedule' : 'Drop a job here'}
          </div>
        ) : (
          <div className="space-y-1">
            {assignments.map(a => (
              <AssignedJobCard key={a.id} assignment={a} onUnassign={onUnassign} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function AssignedJobCard({ assignment, onUnassign }: { assignment: DispatchJobAssignment; onUnassign: (id: string) => void }) {
  const opp = assignment.opportunity
  const customerName = opp?.customer?.full_name ?? 'Unknown'
  const accentColor = '#ffad33'

  return (
    <div
      className="bg-white border border-slate-200 rounded-md px-2 py-1.5 flex items-center justify-between gap-2 shadow-sm"
      style={{ borderLeftWidth: 3, borderLeftColor: accentColor }}
    >
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium text-slate-900 truncate">{customerName}</div>
        <div className="text-[10px] text-slate-500 truncate">
          {opp?.move_size ? opp.move_size.replace(/_/g, ' ') : 'Move'} · ⏱ TBD
        </div>
      </div>
      <button
        onClick={() => onUnassign(assignment.id)}
        className="text-slate-400 hover:text-red-500 flex-shrink-0 transition-colors"
        title="Unassign"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

// ─── Jobs panel ───────────────────────────────────────────────────────────────

interface JobsPanelProps {
  events: DispatchCalendarEvent[]
  assignments: DispatchJobAssignment[]
}

function JobsPanel({ events, assignments }: JobsPanelProps) {
  const assignedIds = new Set(assignments.map(a => a.opportunity_id))
  const unassigned = events.filter(e => !assignedIds.has(e.id))

  return (
    <div className="bg-white rounded-lg border border-slate-200 flex flex-col">
      <div className="px-3 py-2.5 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
        <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Unscheduled</h3>
        <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
          {unassigned.length}
        </span>
      </div>

      {unassigned.length === 0 ? (
        <div className="p-5 text-center flex-1 flex flex-col items-center justify-center">
          {events.length === 0 ? (
            <>
              <Inbox className="w-8 h-8 text-slate-300 mb-2" />
              <p className="text-xs text-slate-500">No jobs for this day</p>
            </>
          ) : (
            <>
              <CheckCircle className="w-8 h-8 text-green-400 mb-2" />
              <p className="text-xs text-slate-600 font-medium">All jobs scheduled</p>
            </>
          )}
        </div>
      ) : (
        <div className="p-2 space-y-2 flex-1 overflow-y-auto max-h-[600px]">
          {unassigned.map(event => <DraggableJobCard key={event.id} event={event} />)}
        </div>
      )}
    </div>
  )
}

function DraggableJobCard({ event }: { event: DispatchCalendarEvent }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `job-${event.id}`,
    data: { type: 'job', opportunityId: event.id },
  })

  const accentColor = event.status === 'booked' ? '#ffad33' : '#22c55e'

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`bg-white rounded-md border border-slate-200 p-2.5 cursor-grab active:cursor-grabbing hover:border-slate-400 hover:shadow-sm transition-all select-none ${isDragging ? 'opacity-30' : ''}`}
      style={{
        borderLeftWidth: 3,
        borderLeftColor: accentColor,
        transform: transform ? `translate3d(${transform.x}px,${transform.y}px,0)` : undefined,
      }}
    >
      <JobCardContent event={event} />
    </div>
  )
}

function JobCardOverlay({ event }: { event: DispatchCalendarEvent }) {
  const accentColor = event.status === 'booked' ? '#ffad33' : '#22c55e'
  return (
    <div
      className="bg-white rounded-md border border-slate-400 p-2.5 shadow-xl w-[260px]"
      style={{ borderLeftWidth: 3, borderLeftColor: accentColor }}
    >
      <JobCardContent event={event} />
    </div>
  )
}

function JobCardContent({ event }: { event: DispatchCalendarEvent }) {
  return (
    <>
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <h4 className="text-sm font-medium text-slate-900 truncate flex-1 leading-tight">
          {event.customer_name}
        </h4>
        {event.total != null && event.total > 0 && (
          <span className="text-xs font-semibold text-slate-900 whitespace-nowrap">
            {formatCurrency(event.total)}
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-600 mb-1">
        {event.move_size && (
          <span className="flex items-center gap-1">
            <Package className="w-3 h-3" />
            {event.move_size.replace(/_/g, ' ')}
          </span>
        )}
        <span className="text-slate-400">⏱ TBD</span>
      </div>
      {event.origin_city && event.dest_city && (
        <p className="text-[11px] text-slate-500 flex items-center gap-1 truncate">
          <MapPin className="w-3 h-3 shrink-0" />
          <span className="truncate">{event.origin_city} → {event.dest_city}</span>
        </p>
      )}
    </>
  )
}
