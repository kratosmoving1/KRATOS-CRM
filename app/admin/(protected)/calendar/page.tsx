'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Briefcase, CalendarDays, ChevronLeft, ChevronRight,
  Clock3, ListChecks, MapPin, Plus, Settings2,
} from 'lucide-react'
import { formatQuoteNumber } from '@/lib/opportunityDisplay'
import { cn } from '@/lib/utils'
import OfficeEventModal, {
  EVENT_TYPE_COLORS,
  type EventType,
  type OfficeEvent,
} from '@/components/admin/calendar/OfficeEventModal'

// ─── Types ────────────────────────────────────────────────────────────────────

type CalendarJob = {
  id: string
  opportunity_number: string
  service_date: string | null
  status: string
  service_type: string
  total_amount: number
  origin_city: string | null
  dest_city: string | null
  pickup_city: string | null
  dropoff_city: string | null
  customer: { id: string; full_name: string; phone: string | null; email: string | null } | null
  agent: { id: string; full_name: string } | null
}

type CalendarDay = { date: Date; key: string; inMonth: boolean }

type Tab = 'jobs' | 'office' | 'rate-overrides'

// ─── Utilities ────────────────────────────────────────────────────────────────

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const DAILY_CAPACITY = 10

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function monthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function buildCalendarDays(month: Date): CalendarDay[] {
  const first = monthStart(month)
  const gridStart = addDays(first, -first.getDay())
  return Array.from({ length: 42 }, (_, i) => {
    const date = addDays(gridStart, i)
    return { date, key: toDateKey(date), inMonth: date.getMonth() === month.getMonth() }
  })
}

function monthLabel(date: Date) {
  return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`
}

function serviceLabel(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

function routeLabel(job: CalendarJob) {
  const from = job.origin_city ?? job.pickup_city
  const to = job.dest_city ?? job.dropoff_city
  if (from && to) return `${from} to ${to}`
  return from ?? to ?? 'Route pending'
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function eventDateKey(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const router = useRouter()

  const [tab, setTab]                     = useState<Tab>('jobs')
  const [month, setMonth]                 = useState(() => monthStart(new Date()))
  const [selectedDate, setSelectedDate]   = useState(() => toDateKey(new Date()))

  // Job calendar state
  const [jobs, setJobs]                   = useState<CalendarJob[]>([])
  const [jobsLoading, setJobsLoading]     = useState(false)
  const [jobsError, setJobsError]         = useState<string | null>(null)

  // Office calendar state
  const [officeEvents, setOfficeEvents]   = useState<OfficeEvent[]>([])
  const [officeLoading, setOfficeLoading] = useState(false)
  const [officeError, setOfficeError]     = useState<string | null>(null)
  const [showEventModal, setShowEventModal] = useState(false)
  const [editingEvent, setEditingEvent]   = useState<OfficeEvent | null>(null)

  const days = useMemo(() => buildCalendarDays(month), [month])
  const firstKey = days[0]?.key
  const lastKey  = days[days.length - 1]?.key

  // ── Job calendar fetch ──────────────────────────────────────────────────────
  const loadJobs = useCallback(async () => {
    if (!firstKey || !lastKey) return
    setJobsLoading(true)
    setJobsError(null)
    try {
      const res  = await fetch(`/api/admin/calendar/jobs?start=${firstKey}&end=${lastKey}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Unable to load jobs')
      setJobs(json.data ?? [])
    } catch (err) {
      setJobsError(err instanceof Error ? err.message : 'Unable to load jobs')
      setJobs([])
    } finally {
      setJobsLoading(false)
    }
  }, [firstKey, lastKey])

  // ── Office calendar fetch ───────────────────────────────────────────────────
  const loadOfficeEvents = useCallback(async () => {
    if (!firstKey || !lastKey) return
    setOfficeLoading(true)
    setOfficeError(null)
    try {
      const res  = await fetch(`/api/admin/calendar/office-events?start=${firstKey}&end=${lastKey}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Unable to load events')
      setOfficeEvents(json.data ?? [])
    } catch (err) {
      setOfficeError(err instanceof Error ? err.message : 'Unable to load events')
      setOfficeEvents([])
    } finally {
      setOfficeLoading(false)
    }
  }, [firstKey, lastKey])

  useEffect(() => {
    if (tab === 'jobs') loadJobs()
    if (tab === 'office') loadOfficeEvents()
  }, [tab, loadJobs, loadOfficeEvents])

  // ── Derived ─────────────────────────────────────────────────────────────────
  const jobsByDate = useMemo(() => {
    const map = new Map<string, CalendarJob[]>()
    for (const j of jobs) {
      if (!j.service_date) continue
      const list = map.get(j.service_date) ?? []
      list.push(j)
      map.set(j.service_date, list)
    }
    return map
  }, [jobs])

  const officeByDate = useMemo(() => {
    const map = new Map<string, OfficeEvent[]>()
    for (const e of officeEvents) {
      const key = eventDateKey(e.start_at)
      const list = map.get(key) ?? []
      list.push(e)
      map.set(key, list)
    }
    return map
  }, [officeEvents])

  const selectedJobs   = jobsByDate.get(selectedDate) ?? []
  const selectedEvents = officeByDate.get(selectedDate) ?? []

  const monthJobs = jobs.filter(j => {
    if (!j.service_date) return false
    const d = new Date(`${j.service_date}T00:00:00`)
    return d.getMonth() === month.getMonth() && d.getFullYear() === month.getFullYear()
  })
  const monthEvents = officeEvents.filter(e => {
    const d = new Date(e.start_at)
    return d.getMonth() === month.getMonth() && d.getFullYear() === month.getFullYear()
  })

  function changeMonth(offset: number) {
    const next = new Date(month)
    next.setMonth(next.getMonth() + offset)
    const ms = monthStart(next)
    setMonth(ms)
    setSelectedDate(toDateKey(ms))
  }

  function goToday() {
    const today = new Date()
    setMonth(monthStart(today))
    setSelectedDate(toDateKey(today))
  }

  function openAddEvent() {
    setEditingEvent(null)
    setShowEventModal(true)
  }
  function openEditEvent(ev: OfficeEvent) {
    setEditingEvent(ev)
    setShowEventModal(true)
  }
  function closeModal() {
    setShowEventModal(false)
    setEditingEvent(null)
  }
  function afterSave() {
    closeModal()
    loadOfficeEvents()
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Header */}
      <header className="border-b border-slate-200 pb-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
              {tab === 'jobs' ? 'Job Calendar' : tab === 'office' ? 'Office Calendar' : 'Rate Overrides'}
            </p>
            <div className="mt-1 flex items-center gap-3">
              <button onClick={() => changeMonth(-1)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Previous month">
                <ChevronLeft size={18} />
              </button>
              <h1 className="min-w-[220px] text-2xl font-normal tracking-tight text-slate-900">{monthLabel(month)}</h1>
              <button onClick={() => changeMonth(1)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Next month">
                <ChevronRight size={18} />
              </button>
              <button onClick={goToday} className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
                Today
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {tab === 'jobs' && (
              <>
                <select className="rounded-md border-0 bg-transparent px-2 py-2 text-sm text-blue-600 outline-none">
                  <option>Main Office</option>
                </select>
                <select className="rounded-md border-0 bg-transparent px-2 py-2 text-sm text-blue-600 outline-none">
                  <option>All Job Types</option>
                </select>
                <select className="rounded-md border-0 bg-transparent px-2 py-2 text-sm text-blue-600 outline-none">
                  <option>All Distances</option>
                </select>
              </>
            )}
            {tab === 'office' && (
              <button
                onClick={openAddEvent}
                className="flex items-center gap-1.5 rounded-xl bg-kratos px-3.5 py-2 text-sm font-semibold text-slate-950 hover:opacity-90"
              >
                <Plus size={15} /> Add Event
              </button>
            )}
          </div>
        </div>

        {/* Tabs + summary */}
        <div className="mt-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-1 border-b border-slate-200 text-sm">
            <TabButton active={tab === 'jobs'} onClick={() => setTab('jobs')}>Job Calendar</TabButton>
            <TabButton active={tab === 'office'} onClick={() => setTab('office')}>Office Calendar</TabButton>
            <TabButton active={tab === 'rate-overrides'} onClick={() => setTab('rate-overrides')}>Rate Overrides</TabButton>
          </div>
          <p className="text-sm text-slate-700">
            {tab === 'jobs' && <>Total Booked Moves for {MONTHS[month.getMonth()]}: <span className="font-semibold">{monthJobs.length}</span></>}
            {tab === 'office' && <>Office Events in {MONTHS[month.getMonth()]}: <span className="font-semibold">{monthEvents.length}</span></>}
          </p>
        </div>
      </header>

      {/* Rate Overrides stub */}
      {tab === 'rate-overrides' && (
        <div className="flex min-h-[400px] items-center justify-center rounded-xl border border-slate-200 bg-white">
          <div className="flex flex-col items-center gap-3 text-center">
            <Settings2 size={32} className="text-slate-300" />
            <p className="font-medium text-slate-600">Rate Overrides</p>
            <p className="text-sm text-slate-400">Configure seasonal and custom pricing overrides here.</p>
          </div>
        </div>
      )}

      {/* Job Calendar */}
      {tab === 'jobs' && (
        <>
          {jobsError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{jobsError}</div>
          )}
          <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <CalendarGridHeader />
              <div className="grid grid-cols-7">
                {days.map(day => {
                  const dayJobs = jobsByDate.get(day.key) ?? []
                  const percent = Math.min(100, Math.round((dayJobs.length / DAILY_CAPACITY) * 100))
                  const isSelected = day.key === selectedDate
                  const isToday = day.key === toDateKey(new Date())
                  return (
                    <button
                      key={day.key}
                      onClick={() => setSelectedDate(day.key)}
                      className={cn(
                        'min-h-[132px] border-b border-r border-slate-200 p-3 text-left transition-colors hover:bg-blue-50/40',
                        !day.inMonth && 'bg-slate-50/70',
                        isSelected && 'bg-blue-50',
                      )}
                    >
                      <DayNumber date={day.date} inMonth={day.inMonth} isToday={isToday} />
                      <div className="mt-4 space-y-1.5 text-xs text-slate-500">
                        <p className="flex items-center gap-1.5"><CalendarDays size={12} className="text-blue-400" /> {dayJobs.length} job{dayJobs.length !== 1 ? 's' : ''}</p>
                        <p className="flex items-center gap-1.5"><Clock3 size={12} /> {dayJobs.length} AM · 0 PM</p>
                      </div>
                      <CapacityBar percent={percent} />
                    </button>
                  )
                })}
              </div>
            </section>

            <aside className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <SelectedDayHeader selectedDate={selectedDate} />
              <div className="grid grid-cols-3 border-b border-slate-200">
                <StatCell label="Jobs" value={selectedJobs.length} />
                <StatCell label="Morning" value={selectedJobs.length} />
                <StatCell label="Capacity" value={`${Math.min(100, Math.round((selectedJobs.length / DAILY_CAPACITY) * 100))}%`} />
              </div>
              <div className="max-h-[620px] overflow-y-auto p-3">
                {jobsLoading ? (
                  <SkeletonList />
                ) : selectedJobs.length === 0 ? (
                  <EmptyState icon={ListChecks} label="No jobs scheduled" />
                ) : (
                  <div className="space-y-2">
                    {selectedJobs.map(job => (
                      <button
                        key={job.id}
                        onClick={() => router.push(`/admin/opportunities/${job.id}/quote`)}
                        className="w-full rounded-xl border border-slate-200 bg-white p-3 text-left hover:border-blue-200 hover:bg-blue-50/40 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-mono text-xs font-semibold text-blue-600">{formatQuoteNumber(job.opportunity_number)}</p>
                            <p className="mt-0.5 text-sm font-semibold text-slate-900">{job.customer?.full_name ?? 'Unnamed customer'}</p>
                          </div>
                          <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold capitalize text-green-700">{job.status}</span>
                        </div>
                        <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500"><Briefcase size={12} /> {serviceLabel(job.service_type)}</p>
                        <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500"><MapPin size={12} /> {routeLabel(job)}</p>
                        <p className="mt-1.5 text-xs text-slate-400">{job.agent?.full_name ?? 'Unassigned'}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </aside>
          </div>
        </>
      )}

      {/* Office Calendar */}
      {tab === 'office' && (
        <>
          {officeError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{officeError}</div>
          )}
          <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <CalendarGridHeader />
              <div className="grid grid-cols-7">
                {days.map(day => {
                  const dayEvents = officeByDate.get(day.key) ?? []
                  const isSelected = day.key === selectedDate
                  const isToday = day.key === toDateKey(new Date())
                  return (
                    <button
                      key={day.key}
                      onClick={() => setSelectedDate(day.key)}
                      className={cn(
                        'min-h-[132px] border-b border-r border-slate-200 p-2 text-left transition-colors hover:bg-kratos/5',
                        !day.inMonth && 'bg-slate-50/70',
                        isSelected && 'bg-kratos/8',
                      )}
                    >
                      <DayNumber date={day.date} inMonth={day.inMonth} isToday={isToday} />
                      <div className="mt-2 space-y-1">
                        {dayEvents.slice(0, 3).map(ev => (
                          <div
                            key={ev.id}
                            className={cn(
                              'truncate rounded px-1.5 py-0.5 text-[10px] font-semibold',
                              EVENT_TYPE_COLORS[ev.event_type as EventType] ?? 'bg-slate-100 text-slate-700',
                            )}
                          >
                            {formatTime(ev.start_at)} {ev.title}
                          </div>
                        ))}
                        {dayEvents.length > 3 && (
                          <p className="text-[10px] font-semibold text-slate-400">+{dayEvents.length - 3} more</p>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </section>

            <aside className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <SelectedDayHeader selectedDate={selectedDate} />
              <div className="grid grid-cols-2 border-b border-slate-200">
                <StatCell label="Events" value={selectedEvents.length} />
                <div className="flex items-center border-l border-slate-200 px-4 py-3">
                  <button
                    onClick={openAddEvent}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-kratos/10 px-3 py-1.5 text-xs font-semibold text-slate-900 hover:bg-kratos/20 transition-colors"
                  >
                    <Plus size={12} /> Add Event
                  </button>
                </div>
              </div>
              <div className="max-h-[620px] overflow-y-auto p-3">
                {officeLoading ? (
                  <SkeletonList />
                ) : selectedEvents.length === 0 ? (
                  <EmptyState icon={CalendarDays} label="No events scheduled" />
                ) : (
                  <div className="space-y-2">
                    {selectedEvents.map(ev => (
                      <button
                        key={ev.id}
                        onClick={() => openEditEvent(ev)}
                        className="w-full rounded-xl border border-slate-200 bg-white p-3 text-left hover:border-kratos/40 hover:bg-kratos/5 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className={cn(
                            'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold',
                            EVENT_TYPE_COLORS[ev.event_type as EventType] ?? 'bg-slate-100 text-slate-700',
                          )}>
                            {ev.event_type}
                          </span>
                          <span className={cn(
                            'text-[10px] font-semibold capitalize',
                            ev.status === 'completed' && 'text-green-600',
                            ev.status === 'cancelled' && 'text-red-500',
                            ev.status === 'no-show' && 'text-amber-600',
                            ev.status === 'scheduled' && 'text-slate-400',
                          )}>
                            {ev.status}
                          </span>
                        </div>
                        <p className="mt-1.5 text-sm font-semibold text-slate-900">{ev.title}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {formatTime(ev.start_at)}{ev.end_at ? ` – ${formatTime(ev.end_at)}` : ''}
                        </p>
                        {ev.assignee && (
                          <p className="mt-1 text-xs text-slate-400">{ev.assignee.full_name}</p>
                        )}
                        {ev.customer && (
                          <p className="mt-0.5 text-xs text-slate-400">{ev.customer.full_name}</p>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </aside>
          </div>
        </>
      )}

      {/* Office Event Modal */}
      {showEventModal && (
        <OfficeEventModal
          event={editingEvent}
          defaultDate={selectedDate}
          onClose={closeModal}
          onSaved={afterSave}
        />
      )}
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-4 py-2.5 text-sm font-medium transition-colors',
        active
          ? 'border-b-2 border-kratos text-slate-900'
          : 'text-slate-400 hover:text-slate-700',
      )}
    >
      {children}
    </button>
  )
}

function CalendarGridHeader() {
  return (
    <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
      {WEEKDAYS.map(day => (
        <div key={day} className="px-3 py-2 text-[11px] font-semibold uppercase tracking-widest text-slate-500">{day}</div>
      ))}
    </div>
  )
}

function DayNumber({ date, inMonth, isToday }: { date: Date; inMonth: boolean; isToday: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn(
        'flex h-6 w-6 items-center justify-center rounded-full text-sm font-semibold',
        isToday ? 'bg-kratos text-slate-950' : inMonth ? 'text-slate-900' : 'text-slate-400',
      )}>
        {date.getDate()}
      </span>
      {date.getDate() === 1 && (
        <span className="text-[11px] font-semibold uppercase text-slate-500">{MONTHS[date.getMonth()].slice(0, 3)}</span>
      )}
    </div>
  )
}

function CapacityBar({ percent }: { percent: number }) {
  return (
    <div className="mt-4 flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div
          className={cn('h-full rounded-full', percent >= 80 ? 'bg-red-400' : percent >= 50 ? 'bg-amber-400' : 'bg-blue-500')}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="w-8 text-right text-[11px] text-slate-400">{percent}%</span>
    </div>
  )
}

function SelectedDayHeader({ selectedDate }: { selectedDate: string }) {
  return (
    <div className="border-b border-slate-200 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Selected Day</p>
      <h2 className="mt-0.5 text-base font-semibold text-slate-900">
        {new Date(`${selectedDate}T00:00:00`).toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' })}
      </h2>
    </div>
  )
}

function StatCell({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-0.5 text-xl font-semibold text-slate-900">{value}</p>
    </div>
  )
}

function SkeletonList() {
  return (
    <div className="space-y-2">
      {[0, 1, 2, 3].map(i => <div key={i} className="h-20 animate-pulse rounded-xl bg-slate-100" />)}
    </div>
  )
}

function EmptyState({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="py-14 text-center">
      <Icon size={30} className="mx-auto mb-3 text-slate-200" />
      <p className="text-sm font-medium text-slate-400">{label}</p>
    </div>
  )
}
