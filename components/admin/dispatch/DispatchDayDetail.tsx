'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, ChevronLeft, ChevronRight,
  Truck, CalendarDays, Inbox, Package, MapPin,
} from 'lucide-react'
import type { DispatchCalendarEvent } from '@/lib/dispatch/calendar'
import { formatCurrency } from '@/lib/format'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]

function formatHour(h: number) {
  if (h === 12) return '12p'
  if (h > 12) return `${h - 12}p`
  return `${h}a`
}

interface Props {
  date: Date
  events: DispatchCalendarEvent[]
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-3">
      <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">{label}</p>
      <p className="text-xl font-semibold text-slate-900 mt-1">{value}</p>
    </div>
  )
}

function ResourcesPanel() {
  return (
    <div className="bg-white rounded-lg border border-slate-200 flex flex-col">
      <div className="px-3 py-2.5 border-b border-slate-200">
        <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Resources</h3>
      </div>

      {/* Tabs — visual only, wired in Phase B1 */}
      <div className="flex border-b border-slate-200">
        <button
          type="button"
          disabled
          className="flex-1 px-3 py-2 text-xs font-medium text-slate-700 border-b-2 border-orange-500 cursor-default"
        >
          Trucks (0)
        </button>
        <button
          type="button"
          disabled
          className="flex-1 px-3 py-2 text-xs font-medium text-slate-400 border-b-2 border-transparent cursor-not-allowed"
        >
          Crew (0)
        </button>
      </div>

      <div className="p-5 text-center flex-1 flex flex-col items-center justify-center">
        <Truck className="w-8 h-8 text-slate-300 mb-2" />
        <p className="text-sm font-medium text-slate-700">No trucks yet</p>
        <p className="text-xs text-slate-500 mt-1 mb-4 max-w-[180px]">
          Add trucks to start scheduling jobs onto the calendar.
        </p>
        <button
          type="button"
          disabled
          className="px-3 py-1.5 rounded-md bg-slate-100 text-slate-400 text-xs font-medium cursor-not-allowed"
          title="Trucks data model arrives in Phase B1"
        >
          + Add truck (coming soon)
        </button>
      </div>
    </div>
  )
}

function ScheduleGrid() {
  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden flex flex-col">
      <div className="px-3 py-2.5 border-b border-slate-200">
        <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Schedule</h3>
      </div>

      {/* Hours axis */}
      <div
        className="grid border-b border-slate-200 bg-slate-50"
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

      {/* Empty state with implied vertical gridlines */}
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

function JobCard({ event }: { event: DispatchCalendarEvent }) {
  const accentColor = event.status === 'booked' ? '#ffad33' : '#22c55e'

  return (
    <Link
      href={`/admin/opportunities/${event.id}/quote`}
      className="block bg-white rounded-md border border-slate-200 p-2.5 hover:border-slate-400 hover:shadow-sm transition-all"
      style={{ borderLeftWidth: 3, borderLeftColor: accentColor }}
    >
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
    </Link>
  )
}

function JobsPanel({ events }: { events: DispatchCalendarEvent[] }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 flex flex-col">
      <div className="px-3 py-2.5 border-b border-slate-200 flex items-center justify-between">
        <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Jobs</h3>
        {events.length > 0 && (
          <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
            {events.length}
          </span>
        )}
      </div>

      {events.length === 0 ? (
        <div className="p-5 text-center flex-1 flex flex-col items-center justify-center">
          <Inbox className="w-8 h-8 text-slate-300 mb-2" />
          <p className="text-xs text-slate-500">No jobs scheduled<br />for this day</p>
        </div>
      ) : (
        <div className="p-2 space-y-2 flex-1 overflow-y-auto max-h-[600px]">
          {events.map(event => (
            <JobCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  )
}

export function DispatchDayDetail({ date, events }: Props) {
  const router = useRouter()

  function navigateByDays(delta: number) {
    const newDate = new Date(date)
    newDate.setDate(date.getDate() + delta)
    const y = newDate.getFullYear()
    const m = String(newDate.getMonth() + 1).padStart(2, '0')
    const d = String(newDate.getDate()).padStart(2, '0')
    router.push(`/admin/dispatch/calendar/${y}-${m}-${d}`)
  }

  const totalRevenue = events.reduce((sum, e) => sum + (e.total ?? 0), 0)
  const bookedCount = events.filter(e => e.status === 'booked').length
  const completedCount = events.filter(e => e.status === 'completed').length

  return (
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
        <StatCard
          label="Revenue (day)"
          value={totalRevenue > 0 ? formatCurrency(totalRevenue) : '—'}
        />
      </div>

      {/* Three-column scheduling layout */}
      <div className="grid grid-cols-1 md:grid-cols-[240px_1fr_300px] gap-3 min-h-[400px]">
        <ResourcesPanel />
        <ScheduleGrid />
        <JobsPanel events={events} />
      </div>
    </div>
  )
}
