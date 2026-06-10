'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
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
  ArrowLeft, ChevronDown, ChevronLeft, ChevronRight,
  Truck, CalendarDays, Inbox, Package, MapPin, Plus, X, Users,
  CheckCircle, UserRound, Trash2, Hash, Send, GripVertical,
  Printer, BarChart2, AlertCircle,
} from 'lucide-react'
import { Avatar } from '@/components/admin/workforce/Avatar'
import { formatCurrency } from '@/lib/format'
import type { DispatchCalendarEvent } from '@/lib/dispatch/calendar'
import type {
  DayDetailData, DispatchTruck, DispatchCrewMember,
  DispatchCrew, DispatchCrewAssignment, DispatchCrewPerson, DispatchCrewTruck,
} from '@/lib/dispatch/types'

// ─── Timeline constants ───────────────────────────────────────────────────────

const TL_START = 7    // 7 AM
const TL_END   = 19   // 7 PM
const TL_HOURS = TL_END - TL_START  // 12

function parseTimeToHours(t: string): number {
  const parts = t.split(':').map(Number)
  return (parts[0] ?? 0) + (parts[1] ?? 0) / 60
}

function pixelToStartTime(pointerX: number, rect: { left: number; width: number }): string {
  const fraction = Math.max(0, Math.min(0.99, (pointerX - rect.left) / rect.width))
  const rawHour = TL_START + fraction * TL_HOURS
  const rounded = Math.round(rawHour * 4) / 4  // snap to 15-min
  const clamped = Math.max(TL_START, Math.min(TL_END - 0.25, rounded))
  const h = Math.floor(clamped)
  const m = Math.round((clamped - h) * 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`
}

function hourLabel(h: number): string {
  if (h === 0 || h === 24) return '12 AM'
  if (h === 12) return '12 PM'
  return h < 12 ? `${h} AM` : `${h - 12} PM`
}

// ─── Other constants ──────────────────────────────────────────────────────────

const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
const CATEGORY_LABELS: Record<string, string> = { owned: 'Owned', rental: 'Rentals', contractor: 'Contractor' }
const CATEGORY_ORDER = ['owned', 'rental', 'contractor']

function fmtDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// ─── Draggable resource items (left panel) ───────────────────────────────────

function DraggableTruckItem({ truck }: { truck: DispatchTruck }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `resource-truck-${truck.id}`,
    data: { type: 'resource_truck', truckId: truck.id },
  })
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{ transform: transform ? `translate3d(${transform.x}px,${transform.y}px,0)` : undefined }}
      className={`px-2 py-1.5 rounded flex items-center gap-2 text-xs cursor-grab active:cursor-grabbing select-none
        hover:bg-slate-100 transition-colors ${isDragging ? 'opacity-40' : ''}`}
    >
      <Truck className="w-3 h-3 text-slate-400 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="font-medium text-slate-900 truncate">{truck.name}</div>
        <div className="text-[10px] text-slate-500">
          {truck.size.replace('_', ' ')}{truck.provider ? ` · ${truck.provider}` : ''}
          {truck.liftgate ? ' · LG' : ''}{truck.ramp ? ' · Ramp' : ''}
        </div>
      </div>
      <GripVertical className="w-3 h-3 text-slate-300 flex-shrink-0" />
    </div>
  )
}

function DraggablePersonItem({ person }: { person: DispatchCrewMember }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `resource-person-${person.id}`,
    data: { type: 'resource_person', personId: person.id },
  })
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{ transform: transform ? `translate3d(${transform.x}px,${transform.y}px,0)` : undefined }}
      className={`px-2 py-1.5 rounded flex items-center gap-2 text-xs cursor-grab active:cursor-grabbing select-none
        hover:bg-slate-100 transition-colors ${isDragging ? 'opacity-40' : ''}`}
    >
      <Avatar src={person.profile_picture_url} name={person.name} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="font-medium text-slate-900 truncate">{person.name}</div>
        <div className="text-[10px] text-slate-500 truncate">
          {person.role_data?.label ?? person.role ?? 'No role'}
          {person.tier ? ` · ${person.tier.label}` : ''}
        </div>
      </div>
      <GripVertical className="w-3 h-3 text-slate-300 flex-shrink-0" />
    </div>
  )
}

// ─── Drag overlay cards for resource drags ───────────────────────────────────

function TruckDragOverlay({ truck }: { truck: DispatchTruck }) {
  return (
    <div className="bg-white rounded-lg border border-slate-300 px-3 py-2 shadow-xl flex items-center gap-2 text-xs w-[180px] pointer-events-none">
      <Truck className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-slate-900 truncate">{truck.name}</p>
        <p className="text-slate-500">{truck.size.replace('_', ' ')}</p>
      </div>
    </div>
  )
}

function PersonDragOverlay({ person }: { person: DispatchCrewMember }) {
  return (
    <div className="bg-white rounded-lg border border-slate-300 px-3 py-2 shadow-xl flex items-center gap-2 text-xs w-[180px] pointer-events-none">
      <Avatar src={person.profile_picture_url} name={person.name} size="sm" />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-slate-900 truncate">{person.name}</p>
        <p className="text-slate-500">{person.role_data?.label ?? 'Crew'}</p>
      </div>
    </div>
  )
}

// ─── Droppable crew slot components ──────────────────────────────────────────

function DroppableTruckSlot({
  crewId, current, onClear,
}: {
  crewId: string
  current: DispatchCrewTruck | null
  onClear: () => void
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `truck-slot-${crewId}`,
    data: { type: 'truck_slot', crewId },
  })
  return (
    <div
      ref={setNodeRef}
      className={`flex items-center gap-1.5 px-1.5 py-1 rounded border text-xs min-h-[26px] transition-colors select-none
        ${isOver ? 'border-kratos bg-kratos/10' : current ? 'border-slate-200 bg-white' : 'border-dashed border-slate-300'}`}
    >
      <Truck className="w-3 h-3 flex-shrink-0 text-slate-400" />
      {current ? (
        <>
          <span className="flex-1 truncate text-slate-800">{current.name} ({current.size.replace('_',' ')})</span>
          <button
            onPointerDown={e => e.stopPropagation()}
            onClick={onClear}
            className="flex-shrink-0 text-slate-300 hover:text-red-400 transition-colors"
          >
            <X className="w-2.5 h-2.5" />
          </button>
        </>
      ) : (
        <span className={`flex-1 text-xs ${isOver ? 'text-kratos font-medium' : 'text-slate-400'}`}>
          {isOver ? 'Drop to assign' : 'Drag truck here'}
        </span>
      )}
    </div>
  )
}

function DroppablePersonSlot({
  crewId, slotType, emptyLabel, person, onClear,
}: {
  crewId: string
  slotType: 'driver_slot' | 'dispatcher_slot'
  emptyLabel: string
  person: DispatchCrewPerson | null
  onClear: () => void
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `${slotType}-${crewId}`,
    data: { type: slotType, crewId },
  })
  return (
    <div
      ref={setNodeRef}
      className={`flex items-center gap-1.5 px-1.5 py-1 rounded border text-xs min-h-[26px] transition-colors select-none
        ${isOver ? 'border-kratos bg-kratos/10' : person ? 'border-slate-200 bg-white' : 'border-dashed border-slate-300'}`}
    >
      {person
        ? <Avatar src={person.profile_picture_url} name={person.name} size="sm" />
        : <UserRound className="w-3 h-3 flex-shrink-0 text-slate-400" />}
      {person ? (
        <>
          <span className="flex-1 truncate text-slate-800">{person.name}</span>
          <button
            onPointerDown={e => e.stopPropagation()}
            onClick={onClear}
            className="flex-shrink-0 text-slate-300 hover:text-red-400 transition-colors"
          >
            <X className="w-2.5 h-2.5" />
          </button>
        </>
      ) : (
        <span className={`flex-1 text-xs ${isOver ? 'text-kratos font-medium' : 'text-slate-400'}`}>
          {isOver ? 'Drop to assign' : emptyLabel}
        </span>
      )}
    </div>
  )
}

function DroppableHelpersSlot({
  crewId, helpers, onRemove,
}: {
  crewId: string
  helpers: Array<{ person: DispatchCrewPerson }>
  onRemove: (personId: string) => void
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `helper-slot-${crewId}`,
    data: { type: 'helper_slot', crewId },
  })
  return (
    <div
      ref={setNodeRef}
      className={`px-1.5 py-1 rounded border text-xs min-h-[28px] transition-colors select-none
        ${isOver ? 'border-kratos bg-kratos/10' : helpers.length ? 'border-slate-200 bg-white' : 'border-dashed border-slate-300'}`}
    >
      {helpers.length === 0 ? (
        <div className={`flex items-center gap-1.5 ${isOver ? 'text-kratos font-medium' : 'text-slate-400'}`}>
          <Users className="w-3 h-3 flex-shrink-0" />
          <span>{isOver ? 'Drop to add helper' : 'Drag crew here'}</span>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-1">
          {/* Stacked avatar group */}
          <div className="flex items-center -space-x-1.5 mr-0.5">
            {helpers.slice(0, 5).map((h, i) => (
              <div
                key={h.person.id}
                className="relative group/hav"
                style={{ zIndex: helpers.length - i }}
              >
                <div className="ring-2 ring-white rounded-full">
                  <Avatar src={h.person.profile_picture_url} name={h.person.name} size="xs" />
                </div>
                {/* Name tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-1.5 py-0.5 bg-slate-900 text-white text-[9px] rounded whitespace-nowrap opacity-0 group-hover/hav:opacity-100 pointer-events-none transition-opacity z-50">
                  {h.person.name.split(' ')[0]}
                </div>
                {/* Remove button */}
                <button
                  onPointerDown={e => e.stopPropagation()}
                  onClick={() => onRemove(h.person.id)}
                  className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-red-500 rounded-full items-center justify-center hidden group-hover/hav:flex transition-all z-20 border border-white"
                >
                  <X className="w-1.5 h-1.5 text-white" />
                </button>
              </div>
            ))}
            {helpers.length > 5 && (
              <div className="w-5 h-5 rounded-full bg-slate-200 text-slate-600 text-[8px] font-bold flex items-center justify-center ring-2 ring-white">
                +{helpers.length - 5}
              </div>
            )}
          </div>
          {/* Names summary */}
          <span className="text-[10px] text-slate-500 truncate max-w-[80px]">
            {helpers.length === 1
              ? helpers[0].person.name.split(' ')[0]
              : `${helpers.length} helpers`}
          </span>
          {isOver && (
            <span className="inline-flex items-center bg-kratos/10 text-kratos border border-dashed border-kratos/40 rounded-full px-1.5 py-0.5 text-[10px] font-medium ml-auto">
              + Add
            </span>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  dateStr: string  // YYYY-MM-DD — passed as string to avoid UTC timezone shift across server/client boundary
  initialData: DayDetailData
}

export function DispatchDayDetail({ dateStr, initialData }: Props) {
  const router = useRouter()

  // Parse date locally so 2026-06-12 stays June 12 regardless of server timezone
  // Memoized to keep useCallback deps stable across renders
  const date = useMemo(() => {
    const [y, m, d] = dateStr.split('-').map(Number)
    return new Date(y, m - 1, d)
  }, [dateStr])

  const [trucks, setTrucks] = useState<DispatchTruck[]>(initialData.trucks)
  const [crewPeople] = useState<DispatchCrewMember[]>(initialData.crew_people)
  const [events] = useState<DispatchCalendarEvent[]>(initialData.events)
  const [cancelledEvents] = useState<DispatchCalendarEvent[]>(initialData.cancelled_events ?? [])
  const [crews, setCrews] = useState<DispatchCrew[]>(initialData.crews)
  const [activeJobId, setActiveJobId]     = useState<string | null>(null)
  const [activeTruckId, setActiveTruckId] = useState<string | null>(null)
  const [activePersonId, setActivePersonId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; isError: boolean } | null>(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4_000)
    return () => clearTimeout(t)
  }, [toast])

  // Track the pointer X at drag-start so we can compute drop time via delta.
  // dnd-kit captures the pointer during drag, which prevents mousemove from
  // firing reliably — so we use activatorEvent.clientX + e.delta.x instead.
  const activatorX = useRef(0)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const activeEvent  = events.find(e => e.id === activeJobId) ?? null
  const activeTruck  = trucks.find(t => t.id === activeTruckId) ?? null
  const activePerson = crewPeople.find(p => p.id === activePersonId) ?? null

  const bookedCount    = events.filter(e => e.status === 'booked').length
  const completedCount = events.filter(e => e.status === 'completed').length
  const totalRevenue   = events.reduce((s, e) => s + (e.total ?? 0), 0)

  function navigateByDays(delta: number) {
    const d = new Date(date)
    d.setDate(date.getDate() + delta)
    router.push(`/admin/dispatch/calendar/${fmtDate(d)}`)
  }

  const refreshCrews = useCallback(async () => {
    const res = await fetch(`/api/admin/dispatch/crews?date=${fmtDate(date)}`)
    if (res.ok) setCrews(await res.json() as DispatchCrew[])
  }, [date])

  async function refreshTrucks() {
    const res = await fetch('/api/admin/dispatch/trucks?all=false')
    if (res.ok) setTrucks(await res.json() as DispatchTruck[])
  }

  // ─── Drag-drop ───────────────────────────────────────────────────────────────

  function handleDragStart(e: DragStartEvent) {
    const pointerEvent = e.activatorEvent as PointerEvent
    activatorX.current = pointerEvent.clientX ?? 0
    const d = e.active.data.current
    if (d?.type === 'job')             setActiveJobId(d.opportunityId as string)
    else if (d?.type === 'resource_truck')  setActiveTruckId(d.truckId as string)
    else if (d?.type === 'resource_person') setActivePersonId(d.personId as string)
  }

  async function handleDragEnd(e: DragEndEvent) {
    setActiveJobId(null)
    setActiveTruckId(null)
    setActivePersonId(null)
    const { active, over } = e
    if (!over) return

    // ── Resource: truck dropped on a crew truck slot ──────────────────────────
    if (active.data.current?.type === 'resource_truck' && over.data.current?.type === 'truck_slot') {
      await handleUpdateCrew(over.data.current.crewId as string, { truck_id: active.data.current.truckId as string })
      return
    }

    // ── Resource: person dropped on driver / dispatcher / helper slot ─────────
    if (active.data.current?.type === 'resource_person' && over.data.current) {
      const personId = active.data.current.personId as string
      const slotType = over.data.current.type as string
      const crewId   = over.data.current.crewId as string
      if (slotType === 'driver_slot')     { await handleUpdateCrew(crewId, { driver_id: personId }); return }
      if (slotType === 'dispatcher_slot') { await handleUpdateCrew(crewId, { dispatcher_id: personId }); return }
      if (slotType === 'helper_slot')     { await handleAddHelper(crewId, personId); return }
    }

    // ── Drop on empty grid → auto-create crew row + assign ───────────────────
    if (over.data.current?.type === 'empty_grid' && active.data.current?.type === 'job') {
      const opportunityId = active.data.current.opportunityId as string
      const currentDateStr = fmtDate(date)
      try {
        const crewRes = await fetch('/api/admin/dispatch/crews', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scheduled_date: currentDateStr }),
        })
        if (!crewRes.ok) {
          const j = await crewRes.json() as { error?: string }
          setToast({ msg: j.error ?? 'Failed to create schedule row', isError: true })
          return
        }
        const newCrew = await crewRes.json() as DispatchCrew
        const assignRes = await fetch('/api/admin/dispatch/assignments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ opportunity_id: opportunityId, crew_id: newCrew.id, scheduled_date: currentDateStr, start_time: '08:00' }),
        })
        if (!assignRes.ok) {
          const j = await assignRes.json() as { error?: string }
          setToast({ msg: j.error ?? 'Failed to assign job', isError: true })
          setCrews(prev => [...prev, newCrew])
          return
        }
        const created = await assignRes.json() as DispatchCrewAssignment
        setCrews(prev => [...prev, { ...newCrew, assignments: [created] }])
      } catch {
        setToast({ msg: 'Network error — please try again', isError: true })
      }
      return
    }

    if (over.data.current?.type !== 'crew') return

    const crewId         = over.data.current.crewId as string
    const currentDateStr = fmtDate(date)
    // activatorX + delta gives us the absolute pointer X at time of drop
    const dropX          = activatorX.current + e.delta.x
    const startTime      = pixelToStartTime(dropX, over.rect)

    // ── Unscheduled job dropped on crew timeline ──────────────────────────────
    if (active.data.current?.type === 'job') {
      const opportunityId = active.data.current.opportunityId as string

      // Prevent double-assign
      if (crews.some(c => c.assignments.some(a => a.opportunity_id === opportunityId))) return

      const event = events.find(ev => ev.id === opportunityId)
      const tempId = `temp-${crypto.randomUUID()}`
      const optimistic: DispatchCrewAssignment = {
        id: tempId,
        opportunity_id: opportunityId,
        crew_id: crewId,
        scheduled_date: currentDateStr,
        start_time: startTime,
        duration_hours: 3,
        position: 99,
        opportunity: {
          id: opportunityId,
          opportunity_number: event?.opportunity_number ?? null,
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
          body: JSON.stringify({ opportunity_id: opportunityId, crew_id: crewId, scheduled_date: currentDateStr, start_time: startTime }),
        })
        if (!res.ok) {
          const j = await res.json() as { error?: string }
          throw new Error(j.error ?? 'Assignment failed')
        }
        const created = await res.json() as DispatchCrewAssignment
        setCrews(prev => prev.map(c =>
          c.id === crewId
            ? { ...c, assignments: c.assignments.map(a => a.id === tempId ? created : a) }
            : c
        ))
      } catch (err) {
        setCrews(prev => prev.map(c =>
          c.id === crewId ? { ...c, assignments: c.assignments.filter(a => a.id !== tempId) } : c
        ))
        setToast({ msg: err instanceof Error ? err.message : 'Failed to assign job', isError: true })
      }
      return
    }

    // ── Scheduled job block moved to new crew / time ──────────────────────────
    if (active.data.current?.type === 'scheduled_job') {
      const assignmentId = active.data.current.assignmentId as string
      const fromCrewId   = active.data.current.crewId as string

      const fromCrew   = crews.find(c => c.id === fromCrewId)
      const assignment = fromCrew?.assignments.find(a => a.id === assignmentId)
      if (!assignment) return

      // No-op: same crew + same start_time
      if (fromCrewId === crewId && assignment.start_time.startsWith(startTime.slice(0, 5))) return

      const updated = { ...assignment, start_time: startTime, crew_id: crewId }

      setCrews(prev => prev.map(c => {
        if (c.id === fromCrewId && fromCrewId !== crewId) {
          return { ...c, assignments: c.assignments.filter(a => a.id !== assignmentId) }
        }
        if (c.id === crewId) {
          return fromCrewId === crewId
            ? { ...c, assignments: c.assignments.map(a => a.id === assignmentId ? updated : a) }
            : { ...c, assignments: [...c.assignments, updated] }
        }
        return c
      }))

      try {
        const res = await fetch(`/api/admin/dispatch/assignments/${assignmentId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ start_time: startTime, crew_id: crewId }),
        })
        if (!res.ok) {
          const j = await res.json() as { error?: string }
          throw new Error(j.error ?? 'Move failed')
        }
      } catch (err) {
        await refreshCrews()
        setToast({ msg: err instanceof Error ? err.message : 'Failed to move job', isError: true })
      }
    }
  }

  // ─── Unassign ─────────────────────────────────────────────────────────────

  async function handleUnassign(crewId: string, assignmentId: string) {
    const prev = crews
    setCrews(c => c.map(cr =>
      cr.id === crewId ? { ...cr, assignments: cr.assignments.filter(a => a.id !== assignmentId) } : cr
    ))
    try {
      const res = await fetch(`/api/admin/dispatch/assignments/${assignmentId}`, { method: 'DELETE' })
      if (!res.ok) {
        const j = await res.json() as { error?: string }
        throw new Error(j.error ?? 'Unassign failed')
      }
    } catch (err) {
      setCrews(prev)
      setToast({ msg: err instanceof Error ? err.message : 'Failed to unassign job', isError: true })
    }
  }

  // ─── Crew management ─────────────────────────────────────────────────────

  async function handleAddCrew() {
    try {
      const res = await fetch('/api/admin/dispatch/crews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduled_date: fmtDate(date) }),
      })
      if (!res.ok) return
      const created = await res.json() as DispatchCrew
      setCrews(prev => [...prev, created])
    } catch { /* noop */ }
  }

  async function handleDeleteCrew(crewId: string) {
    const prev = crews
    setCrews(c => c.filter(cr => cr.id !== crewId))
    try {
      const res = await fetch(`/api/admin/dispatch/crews/${crewId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
    } catch {
      setCrews(prev)
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
      if (!res.ok) throw new Error()
    } catch {
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
      if (!res.ok) throw new Error()
    } catch {
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
      if (!res.ok) throw new Error()
    } catch {
      await refreshCrews()
    }
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex flex-col gap-3">
        {/* ── Top bar ── */}
        <DayTopBar date={date} onNavigate={navigateByDays} />

        {/* ── Stats strip ── */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Booked moves"   value={bookedCount} />
          <StatCard label="Completed"      value={completedCount} />
          <StatCard label="Revenue (day)"  value={totalRevenue > 0 ? formatCurrency(totalRevenue) : '—'} />
        </div>

        {/* ── Main board ── */}
        <div
          className="flex border border-slate-200 rounded-lg overflow-hidden bg-white"
          style={{ minHeight: 520 }}
        >
          {/* Left: resources */}
          <ResourcesPanel trucks={trucks} crew={crewPeople} />

          {/* Center: schedule timeline */}
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

          {/* Right: jobs */}
          <JobsPanel events={events} cancelledEvents={cancelledEvents} crews={crews} />
        </div>
      </div>

      <DragOverlay>
        {activeEvent  ? <JobCardOverlay event={activeEvent} /> : null}
        {activeTruck  ? <TruckDragOverlay truck={activeTruck} /> : null}
        {activePerson ? <PersonDragOverlay person={activePerson} /> : null}
      </DragOverlay>

      {toast && (
        <div className={`fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium shadow-xl max-w-sm
          ${toast.isError ? 'bg-red-600 text-white' : 'bg-slate-800 text-white'}`}>
          <span className="flex-1">{toast.msg}</span>
          <button onClick={() => setToast(null)} className="text-white/70 hover:text-white flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </DndContext>
  )
}

// ─── Day top bar ──────────────────────────────────────────────────────────────

function DayTopBar({ date, onNavigate }: { date: Date; onNavigate: (delta: number) => void }) {
  const today = new Date()
  const isToday =
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()

  const dateLabel = `${DAY_NAMES[date.getDay()]}, ${MONTH_NAMES[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`

  return (
    <div className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-4 py-2.5 gap-3">
      {/* Back + date nav */}
      <div className="flex items-center gap-2">
        <Link
          href={`/admin/dispatch/calendar?year=${date.getFullYear()}&month=${date.getMonth()}`}
          className="p-1 rounded hover:bg-slate-100 text-slate-500"
          title="Back to calendar"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <button onClick={() => onNavigate(-1)} className="p-1.5 rounded hover:bg-slate-100 text-slate-500">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <h2 className="text-sm font-semibold text-slate-900 whitespace-nowrap">{dateLabel}</h2>
        <button onClick={() => onNavigate(1)} className="p-1.5 rounded hover:bg-slate-100 text-slate-500">
          <ChevronRight className="w-4 h-4" />
        </button>
        {!isToday && (
          <button
            onClick={() => {
              const now = new Date()
              const y = now.getFullYear()
              const m = String(now.getMonth() + 1).padStart(2, '0')
              const d = String(now.getDate()).padStart(2, '0')
              window.location.href = `/admin/dispatch/calendar/${y}-${m}-${d}`
            }}
            className="text-xs px-2 py-1 border border-slate-200 rounded text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Today
          </button>
        )}
      </div>

      {/* Action controls */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-slate-400 border border-slate-200 rounded px-2 py-1 bg-slate-50">
          Branch: All
        </span>
        <button className="text-[11px] px-2.5 py-1 border border-slate-200 rounded text-slate-600 hover:bg-slate-50 flex items-center gap-1.5 transition-colors">
          <Printer className="w-3.5 h-3.5" /> Print
        </button>
        <button className="text-[11px] px-2.5 py-1 border border-slate-200 rounded text-slate-600 hover:bg-slate-50 flex items-center gap-1.5 transition-colors">
          <BarChart2 className="w-3.5 h-3.5" /> Report
        </button>
        <button className="text-[11px] px-2.5 py-1 bg-kratos hover:bg-kratos/90 rounded text-white font-medium flex items-center gap-1.5 transition-colors">
          <Send className="w-3.5 h-3.5" /> Publish
        </button>
      </div>
    </div>
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────

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
}

function ResourcesPanel({ trucks, crew }: ResourcesPanelProps) {
  const [tab, setTab] = useState<'trucks' | 'crew'>('trucks')

  return (
    <div className="w-[240px] flex-shrink-0 border-r border-slate-200 flex flex-col">
      <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex-shrink-0">
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Resources</p>
      </div>
      <div className="flex border-b border-slate-200 flex-shrink-0">
        <button
          onClick={() => setTab('trucks')}
          className={`flex-1 py-2 text-xs font-medium border-b-2 transition-colors ${tab === 'trucks' ? 'border-kratos text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          Trucks ({trucks.length})
        </button>
        <button
          onClick={() => setTab('crew')}
          className={`flex-1 py-2 text-xs font-medium border-b-2 transition-colors ${tab === 'crew' ? 'border-kratos text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          Crew ({crew.length})
        </button>
      </div>
      {tab === 'trucks'
        ? <TrucksTab trucks={trucks} />
        : <CrewTab crew={crew} />}
    </div>
  )
}

// ─── Trucks tab ───────────────────────────────────────────────────────────────

function TrucksTab({ trucks }: { trucks: DispatchTruck[] }) {
  const grouped: Record<string, DispatchTruck[]> = {}
  for (const t of trucks) {
    if (!grouped[t.category]) grouped[t.category] = []
    grouped[t.category].push(t)
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {trucks.length === 0 && (
          <div className="p-4 text-center space-y-2">
            <Truck className="w-6 h-6 text-slate-300 mx-auto" />
            <p className="text-xs text-slate-500">No active trucks configured.</p>
            <Link href="/admin/settings/dispatch" className="text-xs text-kratos hover:opacity-80 font-medium">
              Add trucks in Settings → Dispatch
            </Link>
          </div>
        )}
        {CATEGORY_ORDER.map(cat => {
          const list = grouped[cat]
          if (!list?.length) return null
          return (
            <div key={cat}>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide px-1 mb-1">
                {CATEGORY_LABELS[cat]} ({list.length})
              </p>
              <div className="space-y-0.5">
                {list.map(t => <DraggableTruckItem key={t.id} truck={t} />)}
              </div>
            </div>
          )
        })}
      </div>
      <div className="p-2 border-t border-slate-200 flex-shrink-0">
        <Link
          href="/admin/settings/dispatch"
          className="w-full px-3 py-1.5 rounded border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
        >
          Manage trucks in Settings
        </Link>
      </div>
    </div>
  )
}

// ─── Crew tab ─────────────────────────────────────────────────────────────────

function CrewTab({ crew }: { crew: DispatchCrewMember[] }) {
  const [tierFilter, setTierFilter] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const tiers = useMemo(() => {
    const seen = new Map<string, { key: string; label: string }>()
    for (const p of crew) {
      if (p.tier && !seen.has(p.tier.key)) seen.set(p.tier.key, p.tier)
    }
    return Array.from(seen.values()).sort((a, b) => a.label.localeCompare(b.label))
  }, [crew])

  const filtered = tierFilter ? crew.filter(p => p.tier?.key === tierFilter) : crew

  const grouped = useMemo(() => {
    const map = new Map<string, { label: string; people: DispatchCrewMember[] }>()
    for (const p of filtered) {
      const key = p.role_data?.key ?? 'other'
      const label = p.role_data?.label ?? 'Other'
      if (!map.has(key)) map.set(key, { label, people: [] })
      map.get(key)!.people.push(p)
    }
    return Array.from(map.entries())
  }, [filtered])

  if (!crew.length) {
    return (
      <div className="p-5 text-center flex-1 flex flex-col items-center justify-center">
        <Users className="w-7 h-7 text-slate-300 mb-2" />
        <p className="text-xs text-slate-500 mb-1">No crew members yet.</p>
        <Link href="/admin/dispatch/workforce" className="text-xs text-kratos hover:opacity-80 font-medium">
          Add people in Workforce
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Tier filter chips */}
      {tiers.length > 0 && (
        <div className="px-2 py-1.5 flex flex-wrap gap-1 border-b border-slate-100 flex-shrink-0 bg-white">
          <button
            onClick={() => setTierFilter(null)}
            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold transition-colors ${
              !tierFilter
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
          >
            All
          </button>
          {tiers.map(t => (
            <button
              key={t.key}
              onClick={() => setTierFilter(tierFilter === t.key ? null : t.key)}
              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold transition-colors ${
                tierFilter === t.key
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Role subsections */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filtered.length === 0 && (
          <p className="text-xs text-slate-400 text-center py-6">No crew matching filter</p>
        )}
        {grouped.map(([key, { label, people }]) => {
          const isOpen = !(collapsed[key] ?? false)
          return (
            <div key={key}>
              <button
                onClick={() => setCollapsed(c => ({ ...c, [key]: isOpen }))}
                className="w-full flex items-center justify-between px-1 py-1 rounded hover:bg-slate-100 transition-colors text-left"
              >
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                  {label} ({people.length})
                </span>
                {isOpen
                  ? <ChevronDown className="w-3 h-3 text-slate-300" />
                  : <ChevronRight className="w-3 h-3 text-slate-300" />}
              </button>
              {isOpen && (
                <div className="space-y-0.5 mt-0.5">
                  {people.map(person => <DraggablePersonItem key={person.id} person={person} />)}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Schedule grid ────────────────────────────────────────────────────────────

interface ScheduleGridProps {
  crews: DispatchCrew[]
  trucks: DispatchTruck[]
  crewPeople: DispatchCrewMember[]
  onAddCrew: () => void
  onDeleteCrew: (id: string) => void
  onUpdateCrew: (id: string, patch: Partial<DispatchCrew>) => void
  onAddHelper: (crewId: string, personId: string) => void
  onRemoveHelper: (crewId: string, personId: string) => void
  onUnassign: (crewId: string, assignmentId: string) => void
}

const CREW_PANEL_W = 220  // px — left info panel in each crew row
const HOURS_ARR = Array.from({ length: TL_HOURS + 1 }, (_, i) => i)  // 0..12

function ScheduleGrid({
  crews, trucks, crewPeople,
  onAddCrew, onDeleteCrew, onUpdateCrew, onAddHelper, onRemoveHelper, onUnassign,
}: ScheduleGridProps) {
  const { setNodeRef: emptyRef, isOver: emptyIsOver } = useDroppable({
    id: 'empty-schedule',
    data: { type: 'empty_grid' },
  })

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      {/* Grid header row */}
      <div className="flex flex-shrink-0 border-b border-slate-200 bg-slate-50">
        {/* Info panel header */}
        <div
          style={{ width: CREW_PANEL_W, minWidth: CREW_PANEL_W }}
          className="border-r border-slate-200 px-3 py-2 flex items-center"
        >
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Schedule</span>
        </div>

        {/* Timeline hour marks */}
        <div className="flex-1 relative h-8 overflow-hidden">
          {HOURS_ARR.map(i => {
            const hour = TL_START + i
            return (
              <div
                key={i}
                style={{ left: `${(i / TL_HOURS) * 100}%` }}
                className="absolute top-0 bottom-0 flex flex-col items-start"
              >
                <div className="h-full border-l border-slate-200" />
                <span className="absolute top-1 left-1 text-[9px] text-slate-400 font-medium whitespace-nowrap">
                  {hourLabel(hour)}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Crew rows */}
      {crews.length === 0 ? (
        <div
          ref={emptyRef}
          className={`flex-1 flex flex-col items-center justify-center p-8 gap-3 transition-colors
            ${emptyIsOver ? 'bg-kratos/5' : ''}`}
        >
          <CalendarDays className={`w-10 h-10 transition-colors ${emptyIsOver ? 'text-kratos/50' : 'text-slate-300'}`} />
          <p className={`text-sm font-medium transition-colors ${emptyIsOver ? 'text-kratos' : 'text-slate-700'}`}>
            {emptyIsOver ? 'Release to schedule' : 'No schedule rows for this date'}
          </p>
          {emptyIsOver ? (
            <div className="border-2 border-dashed border-kratos/40 rounded-lg px-8 py-4 text-xs text-kratos/60 font-medium">
              A new crew row will be created
            </div>
          ) : (
            <>
              <p className="text-xs text-slate-500 text-center max-w-xs leading-relaxed">
                Drag a job from the right panel to auto-create a crew row, or add one manually.
              </p>
              <button
                onClick={onAddCrew}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-kratos hover:bg-kratos/90 text-white text-xs font-medium transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add schedule row
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {crews.map(crew => (
            <CrewRow
              key={crew.id}
              crew={crew}
              trucks={trucks}
              crewPeople={crewPeople}
              onUpdate={p => onUpdateCrew(crew.id, p)}
              onDelete={() => onDeleteCrew(crew.id)}
              onAddHelper={pid => onAddHelper(crew.id, pid)}
              onRemoveHelper={pid => onRemoveHelper(crew.id, pid)}
              onUnassign={aid => onUnassign(crew.id, aid)}
            />
          ))}
          <div className="p-2 bg-slate-50">
            <button
              onClick={onAddCrew}
              className="w-full py-1 text-xs text-slate-500 hover:text-kratos hover:bg-white rounded border border-dashed border-slate-200 flex items-center justify-center gap-1 transition-colors"
            >
              <Plus className="w-3 h-3" /> Add schedule row
            </button>
          </div>
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
  useEffect(() => { setLocalName(crew.name) }, [crew.name])

  const { setNodeRef, isOver } = useDroppable({
    id: `crew-timeline-${crew.id}`,
    data: { type: 'crew', crewId: crew.id },
  })

  return (
    <div className="flex" style={{ minHeight: 88 }}>
      {/* Left: crew slots */}
      <div
        style={{ width: CREW_PANEL_W, minWidth: CREW_PANEL_W }}
        className="border-r border-slate-200 p-2 space-y-1 bg-slate-50/60 flex-shrink-0"
      >
        {/* Name + delete */}
        <div className="flex items-center gap-1 mb-0.5">
          <input
            className="flex-1 text-xs font-semibold text-slate-900 bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-kratos/50 rounded px-1 py-0.5 min-w-0"
            value={localName}
            onChange={e => setLocalName(e.target.value)}
            onBlur={() => {
              const t = localName.trim()
              if (t && t !== crew.name) onUpdate({ name: t })
              else setLocalName(crew.name)
            }}
            onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
          />
          <button onClick={onDelete} className="text-slate-300 hover:text-red-500 transition-colors flex-shrink-0 p-0.5">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>

        <DroppableTruckSlot
          crewId={crew.id}
          current={crew.truck ?? null}
          onClear={() => onUpdate({ truck_id: null })}
        />
        <DroppablePersonSlot
          crewId={crew.id}
          slotType="driver_slot"
          emptyLabel="Drag driver here"
          person={crew.driver ?? null}
          onClear={() => onUpdate({ driver_id: null })}
        />
        <DroppablePersonSlot
          crewId={crew.id}
          slotType="dispatcher_slot"
          emptyLabel="Drag dispatcher here"
          person={crew.dispatcher ?? null}
          onClear={() => onUpdate({ dispatcher_id: null })}
        />
        <DroppableHelpersSlot
          crewId={crew.id}
          helpers={crew.helpers}
          onRemove={onRemoveHelper}
        />
      </div>

      {/* Right: timeline track (droppable) */}
      <div
        ref={setNodeRef}
        className={`relative flex-1 overflow-hidden transition-colors ${isOver ? 'bg-kratos/5' : 'bg-white'}`}
      >
        {/* Hour grid lines */}
        {HOURS_ARR.map(i => (
          <div
            key={i}
            style={{ left: `${(i / TL_HOURS) * 100}%` }}
            className="absolute top-0 bottom-0 border-l border-slate-100 pointer-events-none"
          />
        ))}

        {/* Job blocks */}
        {crew.assignments.map(a => (
          <TimelineJobBlock
            key={a.id}
            assignment={a}
            crewId={crew.id}
            onUnassign={onUnassign}
          />
        ))}

        {/* Empty / hover hints */}
        {crew.assignments.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className={`text-xs ${isOver ? 'text-kratos font-medium' : 'text-slate-300'}`}>
              {isOver ? 'Release to schedule' : 'Drag a job here'}
            </span>
          </div>
        )}
        {isOver && crew.assignments.length > 0 && (
          <div className="absolute inset-0 border-2 border-dashed border-kratos/40 rounded-sm pointer-events-none" />
        )}
      </div>
    </div>
  )
}

// ─── Timeline job block ───────────────────────────────────────────────────────

function TimelineJobBlock({
  assignment, crewId, onUnassign,
}: {
  assignment: DispatchCrewAssignment
  crewId: string
  onUnassign: (id: string) => void
}) {
  const { setNodeRef, listeners, attributes, transform, isDragging } = useDraggable({
    id: `scheduled-${assignment.id}`,
    data: { type: 'scheduled_job', assignmentId: assignment.id, crewId, opportunityId: assignment.opportunity_id },
  })

  const startH  = parseTimeToHours(assignment.start_time)
  const duration = Math.max(0.25, assignment.duration_hours)
  const leftPct  = Math.max(0, (startH - TL_START) / TL_HOURS * 100)
  const widthPct = Math.min(100 - leftPct, duration / TL_HOURS * 100)

  const opp          = assignment.opportunity
  const customerName = opp?.customer?.full_name ?? 'Unknown'
  const quoteNum     = opp?.opportunity_number

  const endH   = startH + duration
  const endStr = `${String(Math.floor(endH)).padStart(2, '0')}:${String(Math.round((endH % 1) * 60)).padStart(2, '0')}`

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{
        position: 'absolute',
        left: `${leftPct}%`,
        width: `${Math.max(widthPct, 3)}%`,
        top: 6,
        bottom: 6,
        transform: transform ? `translate3d(${transform.x}px,${transform.y}px,0)` : undefined,
        zIndex: isDragging ? 20 : 2,
        minWidth: 48,
      }}
      className={`rounded overflow-hidden group cursor-grab active:cursor-grabbing select-none transition-shadow
        ${isDragging ? 'shadow-xl opacity-80' : 'shadow-sm hover:shadow-md'}
        bg-blue-50 border border-blue-200 hover:border-blue-400`}
    >
      <div className="absolute inset-0 flex items-center px-1.5 gap-1 overflow-hidden">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold text-blue-900 leading-tight truncate">{customerName}</p>
          <p className="text-[9px] text-blue-500 leading-tight truncate">
            {quoteNum ? `${quoteNum} · ` : ''}{String(Math.floor(startH)).padStart(2,'0')}:{String(Math.round((startH%1)*60)).padStart(2,'0')}–{endStr}
          </p>
        </div>
        <button
          onPointerDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); onUnassign(assignment.id) }}
          className="opacity-0 group-hover:opacity-100 flex-shrink-0 text-blue-300 hover:text-red-500 transition-opacity"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  )
}


// ─── Jobs panel ───────────────────────────────────────────────────────────────

interface JobsPanelProps {
  events: DispatchCalendarEvent[]
  cancelledEvents: DispatchCalendarEvent[]
  crews: DispatchCrew[]
}

function JobsPanel({ events, cancelledEvents, crews }: JobsPanelProps) {
  const [tab, setTab] = useState<'unscheduled' | 'cancelled'>('unscheduled')

  const assignedIds = new Set(crews.flatMap(c => c.assignments.map(a => a.opportunity_id)))
  const unassigned  = events.filter(e => !assignedIds.has(e.id))

  return (
    <div className="w-[280px] flex-shrink-0 border-l border-slate-200 flex flex-col">
      {/* Tabs */}
      <div className="flex border-b border-slate-200 flex-shrink-0">
        <button
          onClick={() => setTab('unscheduled')}
          className={`flex-1 py-2 text-xs font-medium border-b-2 transition-colors flex items-center justify-center gap-1.5 ${tab === 'unscheduled' ? 'border-kratos text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          Unscheduled
          {unassigned.length > 0 && (
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${tab === 'unscheduled' ? 'bg-kratos/10 text-kratos' : 'bg-slate-100 text-slate-600'}`}>
              {unassigned.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('cancelled')}
          className={`flex-1 py-2 text-xs font-medium border-b-2 transition-colors flex items-center justify-center gap-1.5 ${tab === 'cancelled' ? 'border-red-400 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          Cancelled
          {cancelledEvents.length > 0 && (
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${tab === 'cancelled' ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-600'}`}>
              {cancelledEvents.length}
            </span>
          )}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {tab === 'unscheduled' && (
          unassigned.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-6 text-center">
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
            unassigned.map(ev => <DraggableJobCard key={ev.id} event={ev} />)
          )
        )}

        {tab === 'cancelled' && (
          cancelledEvents.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-6 text-center">
              <AlertCircle className="w-8 h-8 text-slate-300 mb-2" />
              <p className="text-xs text-slate-500">No cancelled jobs for this date</p>
            </div>
          ) : (
            cancelledEvents.map(ev => (
              <div
                key={ev.id}
                className="bg-white rounded-md border border-slate-200 p-2.5 opacity-70"
                style={{ borderLeftWidth: 3, borderLeftColor: '#ef4444' }}
              >
                <JobCardContent event={ev} />
              </div>
            ))
          )
        )}
      </div>
    </div>
  )
}

// ─── Draggable job card ───────────────────────────────────────────────────────

function DraggableJobCard({ event }: { event: DispatchCalendarEvent }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `job-${event.id}`,
    data: { type: 'job', opportunityId: event.id },
  })
  const accentColor = event.status === 'completed' ? '#22c55e' : '#ffad33'

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
  const accentColor = event.status === 'completed' ? '#22c55e' : '#ffad33'
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
      {/* Quote # + value */}
      <div className="flex items-center justify-between gap-2 mb-1">
        {event.opportunity_number && (
          <span className="text-[10px] font-mono text-slate-500 flex items-center gap-0.5">
            <Hash className="w-2.5 h-2.5" />{event.opportunity_number}
          </span>
        )}
        {event.total != null && event.total > 0 && (
          <span className="text-xs font-bold text-slate-900 whitespace-nowrap ml-auto">
            {formatCurrency(event.total)}
          </span>
        )}
      </div>

      {/* Customer */}
      <h4 className="text-sm font-semibold text-slate-900 leading-tight mb-1 truncate">{event.customer_name}</h4>

      {/* Move size */}
      {event.move_size && (
        <div className="flex items-center gap-1 text-[11px] text-slate-600 mb-1">
          <Package className="w-3 h-3 flex-shrink-0" />
          {event.move_size.replace(/_/g, ' ')}
        </div>
      )}

      {/* Route */}
      {event.origin_city && event.dest_city && (
        <div className="text-[11px] text-slate-500 flex items-center gap-1 truncate">
          <MapPin className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">{event.origin_city} → {event.dest_city}</span>
        </div>
      )}
    </>
  )
}
