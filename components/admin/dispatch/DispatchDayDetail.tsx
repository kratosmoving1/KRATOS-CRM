'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
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
  Truck, CalendarDays, Inbox, Package, MapPin, Plus, X, Users,
  CheckCircle, UserRound, ChevronDown, Trash2,
} from 'lucide-react'
import { Avatar } from '@/components/admin/workforce/Avatar'
import { formatCurrency } from '@/lib/format'
import type { DispatchCalendarEvent } from '@/lib/dispatch/calendar'
import type {
  DayDetailData, DispatchTruck, DispatchCrewMember,
  DispatchCrew, DispatchCrewAssignment, DispatchCrewPerson, DispatchCrewTruck,
} from '@/lib/dispatch/types'

// ─── Constants ────────────────────────────────────────────────────────────────

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

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

function formatDateForApi(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// ─── Fixed-position popover hook ─────────────────────────────────────────────

function useFixedPopover() {
  const [open, setOpen] = useState(false)
  const [popStyle, setPopStyle] = useState<React.CSSProperties>({})
  const popoverRef = useRef<HTMLDivElement>(null)

  function openAt(trigger: HTMLElement) {
    const rect = trigger.getBoundingClientRect()
    const left = Math.min(rect.left, window.innerWidth - 240)
    setPopStyle({ position: 'fixed', top: rect.bottom + 4, left, zIndex: 1000, width: 228 })
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (!popoverRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onScroll() { setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('scroll', onScroll, true)
    }
  }, [open])

  return { open, openAt, close: () => setOpen(false), popStyle, popoverRef }
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  date: Date
  initialData: DayDetailData
}

export function DispatchDayDetail({ date, initialData }: Props) {
  const router = useRouter()
  const [trucks, setTrucks] = useState<DispatchTruck[]>(initialData.trucks)
  const [crewPeople] = useState<DispatchCrewMember[]>(initialData.crew_people)
  const [events] = useState<DispatchCalendarEvent[]>(initialData.events)
  const [crews, setCrews] = useState<DispatchCrew[]>(initialData.crews)
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

  const refreshCrews = useCallback(async () => {
    const dateStr = formatDateForApi(date)
    const res = await fetch(`/api/admin/dispatch/crews?date=${dateStr}`)
    if (res.ok) setCrews(await res.json() as DispatchCrew[])
  }, [date])

  async function refreshTrucks() {
    const res = await fetch('/api/admin/dispatch/trucks')
    if (res.ok) setTrucks(await res.json() as DispatchTruck[])
  }

  // ─── Drag-drop ───────────────────────────────────────────────────────────────

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
    if (over.data.current?.type !== 'crew') return

    const opportunityId = active.data.current.opportunityId as string
    const crewId = over.data.current.crewId as string
    const dateStr = formatDateForApi(date)
    const event = events.find(ev => ev.id === opportunityId)

    // Prevent double-assign
    const alreadyAssigned = crews.some(c => c.assignments.some(a => a.opportunity_id === opportunityId))
    if (alreadyAssigned) return

    const tempId = `temp-${crypto.randomUUID()}`
    const optimistic: DispatchCrewAssignment = {
      id: tempId,
      opportunity_id: opportunityId,
      crew_id: crewId,
      scheduled_date: dateStr,
      start_time: '08:00',
      duration_hours: 3,
      position: 99,
      opportunity: {
        id: opportunityId,
        move_size: event?.move_size ?? null,
        origin_city: event?.origin_city ?? null,
        dest_city: event?.dest_city ?? null,
        total_amount: event?.total ?? null,
        customer: { id: '', full_name: event?.customer_name ?? 'Unknown' },
      },
    }

    setCrews(prev => prev.map(c =>
      c.id === crewId ? { ...c, assignments: [...c.assignments, optimistic] } : c
    ))

    try {
      const res = await fetch('/api/admin/dispatch/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opportunity_id: opportunityId, crew_id: crewId, scheduled_date: dateStr }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(j.error ?? 'Assignment failed')
      }
      const created = await res.json() as DispatchCrewAssignment
      setCrews(prev => prev.map(c =>
        c.id === crewId
          ? { ...c, assignments: c.assignments.map(a => a.id === tempId ? created : a) }
          : c
      ))
    } catch (err) {
      console.error('[dispatch] assign failed:', err)
      setCrews(prev => prev.map(c =>
        c.id === crewId ? { ...c, assignments: c.assignments.filter(a => a.id !== tempId) } : c
      ))
    }
  }

  // ─── Unassign ────────────────────────────────────────────────────────────────

  async function handleUnassign(crewId: string, assignmentId: string) {
    const prevCrews = crews
    setCrews(prev => prev.map(c =>
      c.id === crewId ? { ...c, assignments: c.assignments.filter(a => a.id !== assignmentId) } : c
    ))
    try {
      const res = await fetch(`/api/admin/dispatch/assignments/${assignmentId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Unassign failed')
    } catch (err) {
      console.error('[dispatch] unassign failed:', err)
      setCrews(prevCrews)
    }
  }

  // ─── Crew management ─────────────────────────────────────────────────────────

  async function handleAddCrew() {
    const dateStr = formatDateForApi(date)
    try {
      const res = await fetch('/api/admin/dispatch/crews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduled_date: dateStr }),
      })
      if (!res.ok) return
      const created = await res.json() as DispatchCrew
      setCrews(prev => [...prev, created])
    } catch (err) {
      console.error('[dispatch] add crew failed:', err)
    }
  }

  async function handleDeleteCrew(crewId: string) {
    const prevCrews = crews
    setCrews(prev => prev.filter(c => c.id !== crewId))
    try {
      const res = await fetch(`/api/admin/dispatch/crews/${crewId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete crew failed')
    } catch (err) {
      console.error('[dispatch] delete crew failed:', err)
      setCrews(prevCrews)
    }
  }

  async function handleUpdateCrew(crewId: string, patch: Partial<DispatchCrew>) {
    setCrews(prev => prev.map(c => {
      if (c.id !== crewId) return c
      const updated = { ...c, ...patch }
      if ('truck_id' in patch) {
        updated.truck = patch.truck_id
          ? (trucks.find(t => t.id === patch.truck_id) as unknown as DispatchCrewTruck ?? null)
          : null
      }
      if ('driver_id' in patch) {
        const p = crewPeople.find(p => p.id === patch.driver_id)
        updated.driver = p ? { id: p.id, name: p.name, profile_picture_url: p.profile_picture_url } : null
      }
      if ('dispatcher_id' in patch) {
        const p = crewPeople.find(p => p.id === patch.dispatcher_id)
        updated.dispatcher = p ? { id: p.id, name: p.name, profile_picture_url: p.profile_picture_url } : null
      }
      return updated
    }))
    try {
      const res = await fetch(`/api/admin/dispatch/crews/${crewId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) throw new Error('Update crew failed')
    } catch (err) {
      console.error('[dispatch] update crew failed:', err)
      await refreshCrews()
    }
  }

  async function handleAddHelper(crewId: string, personId: string) {
    const person = crewPeople.find(p => p.id === personId)
    if (!person) return
    setCrews(prev => prev.map(c => {
      if (c.id !== crewId) return c
      if (c.helpers.some(h => h.person.id === personId)) return c
      return { ...c, helpers: [...c.helpers, { person: { id: person.id, name: person.name, profile_picture_url: person.profile_picture_url } }] }
    }))
    try {
      const res = await fetch(`/api/admin/dispatch/crews/${crewId}/helpers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ person_id: personId }),
      })
      if (!res.ok) throw new Error('Add helper failed')
    } catch (err) {
      console.error('[dispatch] add helper failed:', err)
      await refreshCrews()
    }
  }

  async function handleRemoveHelper(crewId: string, personId: string) {
    setCrews(prev => prev.map(c =>
      c.id === crewId ? { ...c, helpers: c.helpers.filter(h => h.person.id !== personId) } : c
    ))
    try {
      const res = await fetch(`/api/admin/dispatch/crews/${crewId}/helpers`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ person_id: personId }),
      })
      if (!res.ok) throw new Error('Remove helper failed')
    } catch (err) {
      console.error('[dispatch] remove helper failed:', err)
      await refreshCrews()
    }
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
          <ResourcesPanel trucks={trucks} crew={crewPeople} onTrucksChanged={refreshTrucks} />
          <ScheduleGrid
            crews={crews}
            trucks={trucks}
            crewPeople={crewPeople}
            onAddCrew={handleAddCrew}
            onDeleteCrew={handleDeleteCrew}
            onUpdateCrew={handleUpdateCrew}
            onAddHelper={handleAddHelper}
            onRemoveHelper={handleRemoveHelper}
            onUnassign={handleUnassign}
          />
          <JobsPanel events={events} crews={crews} />
        </div>
      </div>

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
  crews: DispatchCrew[]
  trucks: DispatchTruck[]
  crewPeople: DispatchCrewMember[]
  onAddCrew: () => void
  onDeleteCrew: (crewId: string) => void
  onUpdateCrew: (crewId: string, patch: Partial<DispatchCrew>) => void
  onAddHelper: (crewId: string, personId: string) => void
  onRemoveHelper: (crewId: string, personId: string) => void
  onUnassign: (crewId: string, assignmentId: string) => void
}

function ScheduleGrid({
  crews, trucks, crewPeople,
  onAddCrew, onDeleteCrew, onUpdateCrew, onAddHelper, onRemoveHelper, onUnassign,
}: ScheduleGridProps) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 flex flex-col">
      <div className="px-3 py-2.5 border-b border-slate-200 flex-shrink-0 flex items-center justify-between">
        <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Schedule</h3>
        <button
          onClick={onAddCrew}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-orange-500 hover:bg-orange-600 text-white text-[11px] font-medium transition-colors"
        >
          <Plus className="w-3 h-3" />
          Add crew
        </button>
      </div>

      {crews.length === 0 ? (
        <div className="flex-1 min-h-[280px] flex flex-col items-center justify-center p-8">
          <CalendarDays className="w-10 h-10 text-slate-300 mb-3" />
          <p className="text-sm font-medium text-slate-700">No crews yet</p>
          <p className="text-xs text-slate-500 mt-1 text-center leading-relaxed max-w-xs">
            Add a crew row, then assign a truck, driver, and helpers. Drag jobs from the right onto a crew to schedule them.
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {crews.map(crew => (
            <CrewRow
              key={crew.id}
              crew={crew}
              trucks={trucks}
              crewPeople={crewPeople}
              onUpdate={patch => onUpdateCrew(crew.id, patch)}
              onDelete={() => onDeleteCrew(crew.id)}
              onAddHelper={personId => onAddHelper(crew.id, personId)}
              onRemoveHelper={personId => onRemoveHelper(crew.id, personId)}
              onUnassign={assignmentId => onUnassign(crew.id, assignmentId)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Crew row ─────────────────────────────────────────────────────────────────

interface CrewRowProps {
  crew: DispatchCrew
  trucks: DispatchTruck[]
  crewPeople: DispatchCrewMember[]
  onUpdate: (patch: Partial<DispatchCrew>) => void
  onDelete: () => void
  onAddHelper: (personId: string) => void
  onRemoveHelper: (personId: string) => void
  onUnassign: (assignmentId: string) => void
}

function CrewRow({ crew, trucks, crewPeople, onUpdate, onDelete, onAddHelper, onRemoveHelper, onUnassign }: CrewRowProps) {
  const [localName, setLocalName] = useState(crew.name)

  // Keep local name in sync when parent updates it
  useEffect(() => { setLocalName(crew.name) }, [crew.name])

  const { setNodeRef, isOver } = useDroppable({
    id: `crew-${crew.id}`,
    data: { type: 'crew', crewId: crew.id },
  })

  const blockedIds = new Set([
    crew.driver_id ?? '',
    crew.dispatcher_id ?? '',
    ...crew.helpers.map(h => h.person.id),
  ])

  return (
    <div className="flex min-h-[100px]">
      {/* Left panel — slots */}
      <div className="w-[220px] flex-shrink-0 border-r border-slate-200 p-2 space-y-1.5 bg-slate-50">
        {/* Crew name */}
        <div className="flex items-center gap-1 mb-1">
          <input
            className="flex-1 text-xs font-semibold text-slate-900 bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-orange-400 rounded px-1 py-0.5 min-w-0"
            value={localName}
            onChange={e => setLocalName(e.target.value)}
            onBlur={() => {
              const trimmed = localName.trim()
              if (trimmed && trimmed !== crew.name) onUpdate({ name: trimmed })
              else setLocalName(crew.name)
            }}
            onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
          />
          <button
            onClick={onDelete}
            className="text-slate-300 hover:text-red-500 flex-shrink-0 transition-colors p-0.5"
            title="Remove crew row"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>

        <TruckSlot
          current={crew.truck ?? null}
          trucks={trucks}
          onSelect={truckId => onUpdate({ truck_id: truckId ?? null })}
        />
        <PersonSlot
          label="Driver"
          emptyLabel="No Kratos Driver"
          person={crew.driver ?? null}
          people={crewPeople}
          blockedIds={new Set([crew.dispatcher_id ?? ''].filter(Boolean))}
          onSelect={personId => onUpdate({ driver_id: personId ?? null })}
        />
        <PersonSlot
          label="Dispatcher"
          emptyLabel="No Dispatcher"
          person={crew.dispatcher ?? null}
          people={crewPeople}
          blockedIds={new Set([crew.driver_id ?? ''].filter(Boolean))}
          onSelect={personId => onUpdate({ dispatcher_id: personId ?? null })}
        />
        <HelpersSlot
          helpers={crew.helpers}
          people={crewPeople}
          blockedIds={blockedIds}
          onAdd={onAddHelper}
          onRemove={onRemoveHelper}
        />
      </div>

      {/* Right panel — droppable assignment area */}
      <div
        ref={setNodeRef}
        className={`flex-1 p-2 min-h-[100px] transition-colors ${isOver ? 'bg-orange-50' : ''}`}
      >
        {crew.assignments.length === 0 ? (
          <div className={`h-full flex items-center justify-center text-[11px] ${isOver ? 'text-orange-400 font-medium' : 'text-slate-300'}`}>
            {isOver ? 'Release to assign' : 'Drop a job here'}
          </div>
        ) : (
          <div className="space-y-1.5">
            {crew.assignments.map(a => (
              <AssignedJobCard key={a.id} assignment={a} onUnassign={onUnassign} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Truck slot ───────────────────────────────────────────────────────────────

interface TruckSlotProps {
  current: DispatchCrewTruck | null
  trucks: DispatchTruck[]
  onSelect: (truckId: string | null) => void
}

function TruckSlot({ current, trucks, onSelect }: TruckSlotProps) {
  const { open, openAt, close, popStyle, popoverRef } = useFixedPopover()
  const btnRef = useRef<HTMLButtonElement>(null)

  const grouped: Record<string, DispatchTruck[]> = {}
  for (const t of trucks) {
    if (!grouped[t.category]) grouped[t.category] = []
    grouped[t.category].push(t)
  }

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => btnRef.current && openAt(btnRef.current)}
        className="w-full flex items-center gap-1.5 px-2 py-1 rounded-md bg-white border border-slate-200 hover:border-slate-400 text-xs text-left transition-colors"
      >
        <Truck className="w-3 h-3 text-slate-400 flex-shrink-0" />
        <span className={`flex-1 truncate ${current ? 'text-slate-900' : 'text-slate-400'}`}>
          {current ? current.name : 'No Trucks'}
        </span>
        <ChevronDown className="w-3 h-3 text-slate-400 flex-shrink-0" />
      </button>

      {open && (
        <div
          ref={popoverRef}
          style={popStyle}
          className="bg-white border border-slate-200 rounded-lg shadow-lg overflow-y-auto max-h-[260px]"
        >
          {current && (
            <button
              onClick={() => { onSelect(null); close() }}
              className="w-full px-3 py-2 text-left text-xs text-slate-500 hover:bg-slate-50 border-b border-slate-100"
            >
              Clear truck
            </button>
          )}
          {CATEGORY_ORDER.map(cat => {
            const list = grouped[cat]
            if (!list?.length) return null
            return (
              <div key={cat}>
                <div className="px-3 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wide bg-slate-50">
                  {CATEGORY_LABELS[cat]}
                </div>
                {list.map(t => (
                  <button
                    key={t.id}
                    onClick={() => { onSelect(t.id); close() }}
                    className={`w-full px-3 py-2 text-left text-xs hover:bg-orange-50 flex items-center justify-between gap-2 ${current?.id === t.id ? 'bg-orange-50 text-orange-700 font-medium' : 'text-slate-900'}`}
                  >
                    <span className="truncate">{t.name}</span>
                    <span className="text-[10px] text-slate-400 flex-shrink-0">{t.size.replace('_', ' ')}</span>
                  </button>
                ))}
              </div>
            )
          })}
          {trucks.length === 0 && (
            <p className="px-3 py-3 text-xs text-slate-400 text-center">No trucks in inventory</p>
          )}
        </div>
      )}
    </>
  )
}

// ─── Person slot ──────────────────────────────────────────────────────────────

interface PersonSlotProps {
  label: string
  emptyLabel: string
  person: DispatchCrewPerson | null
  people: DispatchCrewMember[]
  blockedIds: Set<string>
  onSelect: (personId: string | null) => void
}

function PersonSlot({ emptyLabel, person, people, blockedIds, onSelect }: PersonSlotProps) {
  const { open, openAt, close, popStyle, popoverRef } = useFixedPopover()
  const btnRef = useRef<HTMLButtonElement>(null)

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => btnRef.current && openAt(btnRef.current)}
        className="w-full flex items-center gap-1.5 px-2 py-1 rounded-md bg-white border border-slate-200 hover:border-slate-400 text-xs text-left transition-colors"
      >
        {person ? (
          <Avatar src={person.profile_picture_url} name={person.name} size="sm" />
        ) : (
          <UserRound className="w-3 h-3 text-slate-400 flex-shrink-0" />
        )}
        <span className={`flex-1 truncate ${person ? 'text-slate-900' : 'text-slate-400'}`}>
          {person ? person.name : emptyLabel}
        </span>
        <ChevronDown className="w-3 h-3 text-slate-400 flex-shrink-0" />
      </button>

      {open && (
        <div
          ref={popoverRef}
          style={popStyle}
          className="bg-white border border-slate-200 rounded-lg shadow-lg overflow-y-auto max-h-[260px]"
        >
          {person && (
            <button
              onClick={() => { onSelect(null); close() }}
              className="w-full px-3 py-2 text-left text-xs text-slate-500 hover:bg-slate-50 border-b border-slate-100"
            >
              Clear person
            </button>
          )}
          {people.length === 0 && (
            <p className="px-3 py-3 text-xs text-slate-400 text-center">No crew members</p>
          )}
          {people.map(p => {
            const isBlocked = blockedIds.has(p.id)
            const isSelected = person?.id === p.id
            return (
              <button
                key={p.id}
                disabled={isBlocked}
                onClick={() => { onSelect(p.id); close() }}
                className={`w-full px-3 py-2 text-left text-xs flex items-center gap-2 transition-colors
                  ${isBlocked ? 'opacity-40 cursor-not-allowed' : 'hover:bg-orange-50'}
                  ${isSelected ? 'bg-orange-50 text-orange-700 font-medium' : 'text-slate-900'}`}
              >
                <Avatar src={p.profile_picture_url} name={p.name} size="sm" />
                <span className="truncate">{p.name}</span>
                {p.role_data && (
                  <span className="text-[10px] text-slate-400 flex-shrink-0">{p.role_data.label}</span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </>
  )
}

// ─── Helpers slot ─────────────────────────────────────────────────────────────

interface HelpersSlotProps {
  helpers: Array<{ person: DispatchCrewPerson }>
  people: DispatchCrewMember[]
  blockedIds: Set<string>
  onAdd: (personId: string) => void
  onRemove: (personId: string) => void
}

function HelpersSlot({ helpers, people, blockedIds, onAdd, onRemove }: HelpersSlotProps) {
  const { open, openAt, close, popStyle, popoverRef } = useFixedPopover()
  const btnRef = useRef<HTMLButtonElement>(null)

  const helperIds = new Set(helpers.map(h => h.person.id))
  const available = people.filter(p => !blockedIds.has(p.id) && !helperIds.has(p.id))

  return (
    <div className="space-y-1">
      {/* Existing helper chips */}
      {helpers.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {helpers.map(h => (
            <span
              key={h.person.id}
              className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 rounded-full px-2 py-0.5 text-[10px] font-medium"
            >
              {h.person.name.split(' ')[0]}
              <button
                onClick={() => onRemove(h.person.id)}
                className="text-slate-400 hover:text-red-500 transition-colors"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Add helper button */}
      <button
        ref={btnRef}
        onClick={() => btnRef.current && openAt(btnRef.current)}
        className="w-full flex items-center gap-1.5 px-2 py-1 rounded-md bg-white border border-slate-200 hover:border-slate-400 text-xs text-left transition-colors"
      >
        <Users className="w-3 h-3 text-slate-400 flex-shrink-0" />
        <span className="flex-1 text-slate-400">
          {helpers.length === 0 ? 'No Kratos Crew' : 'Add helper'}
        </span>
        <Plus className="w-3 h-3 text-slate-400 flex-shrink-0" />
      </button>

      {open && (
        <div
          ref={popoverRef}
          style={popStyle}
          className="bg-white border border-slate-200 rounded-lg shadow-lg overflow-y-auto max-h-[260px]"
        >
          {available.length === 0 && (
            <p className="px-3 py-3 text-xs text-slate-400 text-center">
              {people.length === 0 ? 'No crew members' : 'All crew members assigned'}
            </p>
          )}
          {available.map(p => (
            <button
              key={p.id}
              onClick={() => { onAdd(p.id); close() }}
              className="w-full px-3 py-2 text-left text-xs flex items-center gap-2 hover:bg-orange-50 text-slate-900 transition-colors"
            >
              <Avatar src={p.profile_picture_url} name={p.name} size="sm" />
              <span className="truncate">{p.name}</span>
              {p.role_data && (
                <span className="text-[10px] text-slate-400 flex-shrink-0">{p.role_data.label}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Assigned job card ────────────────────────────────────────────────────────

function AssignedJobCard({ assignment, onUnassign }: { assignment: DispatchCrewAssignment; onUnassign: (id: string) => void }) {
  const opp = assignment.opportunity
  const customerName = opp?.customer?.full_name ?? 'Unknown'

  return (
    <div
      className="bg-white border border-slate-200 rounded-md px-2 py-1.5 flex items-center justify-between gap-2 shadow-sm"
      style={{ borderLeftWidth: 3, borderLeftColor: '#ffad33' }}
    >
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium text-slate-900 truncate">{customerName}</div>
        <div className="text-[10px] text-slate-500 truncate">
          {opp?.move_size ? opp.move_size.replace(/_/g, ' ') : 'Move'}
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
  crews: DispatchCrew[]
}

function JobsPanel({ events, crews }: JobsPanelProps) {
  const assignedIds = new Set(
    crews.flatMap(c => c.assignments.map(a => a.opportunity_id))
  )
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
