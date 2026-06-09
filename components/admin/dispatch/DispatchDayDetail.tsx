'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ChevronLeft, ChevronRight, MapPin, Package } from 'lucide-react'
import type { DispatchCalendarEvent } from '@/lib/dispatch/calendar'
import { formatCurrency } from '@/lib/format'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

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
          <h2 className="text-lg font-semibold text-slate-900 min-w-[300px] text-center">
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

      {/* Job list */}
      {events.length === 0 ? (
        <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
          <p className="text-slate-700 font-medium">No jobs scheduled for this day.</p>
          <p className="text-sm text-slate-500 mt-1">
            Booked moves will appear here automatically when they exist.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-slate-200">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Jobs</h3>
            <span className="text-xs text-slate-500">{events.length} total</span>
          </div>
          <div className="divide-y divide-slate-100">
            {events.map(event => (
              <Link
                key={event.id}
                href={`/admin/opportunities/${event.id}/quote`}
                className="block px-4 py-3 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="inline-block w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: event.status === 'booked' ? '#ffad33' : '#22c55e' }}
                      />
                      <span className="text-sm font-medium text-slate-900">{event.customer_name}</span>
                      <span className="text-xs uppercase text-slate-500 font-medium tracking-wide">
                        {event.status}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                      {event.move_size && (
                        <span className="flex items-center gap-1">
                          <Package className="w-3 h-3" />
                          {event.move_size.replace(/_/g, ' ')}
                        </span>
                      )}
                      {event.origin_city && event.dest_city && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {event.origin_city} → {event.dest_city}
                        </span>
                      )}
                    </div>
                  </div>
                  {event.total != null && event.total > 0 && (
                    <span className="text-sm font-semibold text-slate-900 whitespace-nowrap">
                      {formatCurrency(event.total)}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Resource panel placeholder */}
      <div className="bg-slate-50 rounded-lg border border-dashed border-slate-300 p-8 text-center">
        <p className="text-sm font-medium text-slate-700">Resource assignment coming soon.</p>
        <p className="text-xs text-slate-500 mt-1">
          Drag jobs onto trucks and crew rows to schedule. Publish notifies the crew.
        </p>
      </div>
    </div>
  )
}
