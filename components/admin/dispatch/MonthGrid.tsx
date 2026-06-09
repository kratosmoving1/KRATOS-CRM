'use client'

import { useRouter } from 'next/navigation'
import type { DispatchCalendarEvent } from '@/lib/dispatch/calendar'

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const STATUS_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  booked:    { bg: '#fff3e0', text: '#c2410c', border: '#ffad33' },
  completed: { bg: '#dcfce7', text: '#166534', border: '#22c55e' },
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate()
}

function formatDateForUrl(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

interface MonthGridProps {
  year: number
  month: number  // 0-indexed
  events: DispatchCalendarEvent[]
}

export function MonthGrid({ year, month, events }: MonthGridProps) {
  const router = useRouter()
  const today = new Date()

  const firstDayOfMonth = new Date(year, month, 1)
  const startWeekday = firstDayOfMonth.getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrevMonth = new Date(year, month, 0).getDate()

  const cells: { date: Date; inMonth: boolean }[] = []
  for (let i = startWeekday - 1; i >= 0; i--) {
    cells.push({ date: new Date(year, month - 1, daysInPrevMonth - i), inMonth: false })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: new Date(year, month, d), inMonth: true })
  }
  let nextDay = 1
  while (cells.length < 42) {
    cells.push({ date: new Date(year, month + 1, nextDay++), inMonth: false })
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      {/* Weekday header */}
      <div className="grid grid-cols-7 border-b border-slate-200">
        {WEEKDAY_LABELS.map(day => (
          <div
            key={day}
            className="px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide bg-slate-50 text-center"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7">
        {cells.map((cell, i) => {
          const eventsForDay = events.filter(e => sameDay(new Date(e.start), cell.date))
          const isToday = sameDay(cell.date, today)
          const isLastRow = i >= 35
          const isLastCol = (i + 1) % 7 === 0

          return (
            <button
              key={i}
              type="button"
              onClick={() => router.push(`/admin/dispatch/calendar/${formatDateForUrl(cell.date)}`)}
              className={[
                'relative min-h-[112px] p-2 text-left transition-colors',
                cell.inMonth ? 'bg-white hover:bg-orange-50/50' : 'bg-slate-50/50 hover:bg-slate-100/50',
                !isLastRow ? 'border-b border-slate-200' : '',
                !isLastCol ? 'border-r border-slate-200' : '',
              ].join(' ')}
            >
              {/* Date number */}
              <div className="flex items-center justify-between mb-1.5">
                {isToday ? (
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-orange-500 text-white text-xs font-semibold">
                    {cell.date.getDate()}
                  </span>
                ) : (
                  <span className={`text-xs font-semibold ${cell.inMonth ? 'text-slate-700' : 'text-slate-300'}`}>
                    {cell.date.getDate()}
                  </span>
                )}
                {eventsForDay.length > 0 && (
                  <span className="text-[10px] font-medium text-slate-500">
                    {eventsForDay.length} {eventsForDay.length === 1 ? 'job' : 'jobs'}
                  </span>
                )}
              </div>

              {/* Event bars */}
              <div className="space-y-1">
                {eventsForDay.slice(0, 3).map(event => {
                  const s = STATUS_STYLES[event.status] ?? STATUS_STYLES.booked
                  return (
                    <div
                      key={event.id}
                      className="text-[11px] px-1.5 py-0.5 rounded truncate font-medium border-l-2"
                      style={{ backgroundColor: s.bg, color: s.text, borderLeftColor: s.border }}
                      title={event.title}
                    >
                      {event.title}
                    </div>
                  )
                })}
                {eventsForDay.length > 3 && (
                  <div className="text-[10px] text-slate-500 px-1.5 font-medium">
                    +{eventsForDay.length - 3} more
                  </div>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
