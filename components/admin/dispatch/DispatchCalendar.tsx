'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Calendar, dateFnsLocalizer, Views, type View } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay } from 'date-fns'
import { enUS } from 'date-fns/locale'
import type { DispatchCalendarEvent } from '@/lib/dispatch/calendar'

const locales = { 'en-US': enUS }
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales })

const STATUS_COLORS: Record<string, string> = {
  booked: '#ffad33',
  completed: '#22c55e',
}

export function DispatchCalendar({ initialEvents }: { initialEvents: DispatchCalendarEvent[] }) {
  const router = useRouter()
  const [view, setView] = useState<View>(Views.MONTH)
  const [date, setDate] = useState(new Date())

  if (initialEvents.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
        <p className="text-slate-700 font-medium">No booked moves on the calendar yet.</p>
        <p className="text-sm text-slate-500 mt-2">
          When a sales agent marks an opportunity as Booked, it will appear here automatically.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <div className="mb-3 flex items-center gap-4 text-xs text-slate-600">
        <span className="flex items-center gap-1.5 font-medium">
          <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: STATUS_COLORS.booked }} />
          Booked
        </span>
        <span className="flex items-center gap-1.5 font-medium">
          <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: STATUS_COLORS.completed }} />
          Completed
        </span>
      </div>

      <div style={{ height: 700 }}>
        <Calendar
          localizer={localizer}
          events={initialEvents}
          startAccessor="start"
          endAccessor="end"
          view={view}
          onView={v => setView(v)}
          date={date}
          onNavigate={d => setDate(d)}
          views={[Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA]}
          eventPropGetter={event => ({
            style: {
              backgroundColor: STATUS_COLORS[event.status] ?? '#64748b',
              border: 'none',
              borderRadius: 4,
              fontSize: 12,
              padding: '2px 6px',
              color: event.status === 'booked' ? '#1e293b' : '#ffffff',
            },
          })}
          onSelectEvent={event => router.push(`/admin/opportunities/${event.id}/quote`)}
          popup
        />
      </div>
    </div>
  )
}
