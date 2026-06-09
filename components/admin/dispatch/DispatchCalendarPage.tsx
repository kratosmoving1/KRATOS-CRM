'use client'

import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { MonthGrid } from './MonthGrid'
import type { DispatchCalendarEvent } from '@/lib/dispatch/calendar'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

interface Props {
  year: number
  month: number
  events: DispatchCalendarEvent[]
}

export function DispatchCalendarPage({ year, month, events }: Props) {
  const router = useRouter()

  function goToMonth(newYear: number, newMonth: number) {
    let y = newYear
    let m = newMonth
    if (m < 0) { m = 11; y -= 1 }
    if (m > 11) { m = 0; y += 1 }
    router.push(`/admin/dispatch/calendar?year=${y}&month=${m}`)
  }

  function goToToday() {
    const now = new Date()
    router.push(`/admin/dispatch/calendar?year=${now.getFullYear()}&month=${now.getMonth()}`)
  }

  const bookedCount = events.filter(e => e.status === 'booked').length
  const completedCount = events.filter(e => e.status === 'completed').length

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => goToMonth(year, month - 1)}
            className="p-1.5 rounded-md hover:bg-slate-100 text-slate-600"
            aria-label="Previous month"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <h2 className="text-lg font-semibold text-slate-900 min-w-[160px] text-center">
            {MONTH_NAMES[month]} {year}
          </h2>
          <button
            onClick={() => goToMonth(year, month + 1)}
            className="p-1.5 rounded-md hover:bg-slate-100 text-slate-600"
            aria-label="Next month"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={goToToday}
            className="ml-2 px-3 py-1.5 text-xs font-medium rounded-md border border-slate-200 hover:bg-slate-50 text-slate-700"
          >
            Today
          </button>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-xs text-slate-600">
          <span className="flex items-center gap-1.5">
            <span
              className="w-3 h-3 rounded-sm border-l-2 inline-block"
              style={{ backgroundColor: '#fff3e0', borderLeftColor: '#ffad33' }}
            />
            Booked
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="w-3 h-3 rounded-sm border-l-2 inline-block"
              style={{ backgroundColor: '#dcfce7', borderLeftColor: '#22c55e' }}
            />
            Completed
          </span>
        </div>
      </div>

      <MonthGrid year={year} month={month} events={events} />

      {/* Footer summary */}
      <p className="text-xs text-slate-500 px-1">
        {bookedCount} booked · {completedCount} completed in this window
      </p>
    </div>
  )
}
