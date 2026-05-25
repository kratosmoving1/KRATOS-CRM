'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Briefcase, CalendarDays, ChevronLeft, ChevronRight, Clock3, ListChecks, MapPin } from 'lucide-react'
import { formatQuoteNumber } from '@/lib/opportunityDisplay'
import { cn } from '@/lib/utils'

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

type CalendarDay = {
  date: Date
  key: string
  inMonth: boolean
}

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const DAILY_CAPACITY = 10

function toDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
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
  return Array.from({ length: 42 }, (_, index) => {
    const date = addDays(gridStart, index)
    return {
      date,
      key: toDateKey(date),
      inMonth: date.getMonth() === month.getMonth(),
    }
  })
}

function monthLabel(date: Date) {
  return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`
}

function serviceLabel(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase())
}

function routeLabel(job: CalendarJob) {
  const from = job.origin_city ?? job.pickup_city
  const to = job.dest_city ?? job.dropoff_city
  if (from && to) return `${from} to ${to}`
  return from ?? to ?? 'Route pending'
}

export default function CalendarPage() {
  const router = useRouter()
  const [month, setMonth] = useState(() => monthStart(new Date()))
  const [selectedDate, setSelectedDate] = useState(() => toDateKey(new Date()))
  const [jobs, setJobs] = useState<CalendarJob[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const days = useMemo(() => buildCalendarDays(month), [month])
  const firstKey = days[0]?.key
  const lastKey = days[days.length - 1]?.key

  const load = useCallback(async () => {
    if (!firstKey || !lastKey) return
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ start: firstKey, end: lastKey })
      const res = await fetch(`/api/admin/calendar/jobs?${params}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Unable to load calendar')
      setJobs(json.data ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load calendar')
      setJobs([])
    } finally {
      setLoading(false)
    }
  }, [firstKey, lastKey])

  useEffect(() => { load() }, [load])

  const jobsByDate = useMemo(() => {
    const grouped = new Map<string, CalendarJob[]>()
    for (const job of jobs) {
      if (!job.service_date) continue
      const list = grouped.get(job.service_date) ?? []
      list.push(job)
      grouped.set(job.service_date, list)
    }
    return grouped
  }, [jobs])

  const selectedJobs = jobsByDate.get(selectedDate) ?? []
  const monthJobs = jobs.filter(job => {
    if (!job.service_date) return false
    const date = new Date(`${job.service_date}T00:00:00`)
    return date.getMonth() === month.getMonth() && date.getFullYear() === month.getFullYear()
  })

  function changeMonth(offset: number) {
    const next = new Date(month)
    next.setMonth(next.getMonth() + offset)
    setMonth(monthStart(next))
    setSelectedDate(toDateKey(monthStart(next)))
  }

  return (
    <div className="space-y-4">
      <header className="border-b border-slate-200 pb-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Job Calendar</p>
            <div className="mt-1 flex items-center gap-3">
              <button
                onClick={() => changeMonth(-1)}
                className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Previous month"
              >
                <ChevronLeft size={18} />
              </button>
              <h1 className="min-w-[220px] text-2xl font-normal tracking-tight text-slate-900">{monthLabel(month)}</h1>
              <button
                onClick={() => changeMonth(1)}
                className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Next month"
              >
                <ChevronRight size={18} />
              </button>
              <button
                onClick={() => {
                  const today = new Date()
                  setMonth(monthStart(today))
                  setSelectedDate(toDateKey(today))
                }}
                className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Today
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <select className="rounded-md border-0 bg-transparent px-2 py-2 text-blue-600 outline-none">
              <option>Main Office</option>
            </select>
            <select className="rounded-md border-0 bg-transparent px-2 py-2 text-blue-600 outline-none">
              <option>All Job Types</option>
            </select>
            <select className="rounded-md border-0 bg-transparent px-2 py-2 text-blue-600 outline-none">
              <option>All Distances</option>
            </select>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-1 border-b border-slate-200 text-sm">
            <button className="border-b-2 border-blue-600 px-3 py-2 font-medium text-slate-900">Job Calendar</button>
            <button className="px-3 py-2 text-slate-400">Office Calendar</button>
            <button className="px-3 py-2 text-slate-400">Rate Overrides</button>
          </div>
          <p className="text-sm text-slate-700">
            Total Booked Moves for {MONTHS[month.getMonth()]}: <span className="font-semibold">{monthJobs.length}</span>
          </p>
        </div>
      </header>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <section className="overflow-hidden border border-slate-200 bg-white">
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
            {WEEKDAYS.map(day => (
              <div key={day} className="px-3 py-2 text-[11px] font-semibold uppercase tracking-widest text-slate-500">{day}</div>
            ))}
          </div>
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
                    !day.inMonth && 'bg-slate-50/70 text-slate-400',
                    isSelected && 'bg-blue-50',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'flex h-6 w-6 items-center justify-center rounded-full text-base font-semibold',
                      isToday ? 'bg-blue-600 text-white' : day.inMonth ? 'text-slate-900' : 'text-slate-400',
                    )}>
                      {day.date.getDate()}
                    </span>
                    {day.date.getDate() === 1 && (
                      <span className="text-[11px] font-semibold uppercase text-blue-600">{MONTHS[day.date.getMonth()].slice(0, 3)}</span>
                    )}
                  </div>

                  <div className="mt-4 space-y-1.5 text-xs text-slate-600">
                    <p className="flex items-center gap-1.5"><CalendarDays size={12} /> {dayJobs.length} jobs</p>
                    <p className="flex items-center gap-1.5"><Clock3 size={12} /> {dayJobs.length} morning</p>
                    <p className="flex items-center gap-1.5"><Clock3 size={12} /> 0 afternoon</p>
                  </div>

                  <div className="mt-5 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-blue-600" style={{ width: `${percent}%` }} />
                    </div>
                    <span className="w-8 text-right text-xs text-slate-500">{percent}%</span>
                  </div>
                </button>
              )
            })}
          </div>
        </section>

        <aside className="border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Selected Day</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-900">
              {new Date(`${selectedDate}T00:00:00`).toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' })}
            </h2>
          </div>

          <div className="grid grid-cols-3 border-b border-slate-200">
            <div className="px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Jobs</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">{selectedJobs.length}</p>
            </div>
            <div className="px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Morning</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">{selectedJobs.length}</p>
            </div>
            <div className="px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Capacity</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">{Math.min(100, Math.round((selectedJobs.length / DAILY_CAPACITY) * 100))}%</p>
            </div>
          </div>

          <div className="max-h-[660px] overflow-y-auto p-3">
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="h-20 animate-pulse rounded bg-slate-100" />
                ))}
              </div>
            ) : selectedJobs.length === 0 ? (
              <div className="py-16 text-center">
                <ListChecks size={32} className="mx-auto mb-3 text-slate-200" />
                <p className="text-sm font-medium text-slate-500">No jobs scheduled</p>
              </div>
            ) : (
              <div className="space-y-2">
                {selectedJobs.map(job => (
                  <button
                    key={job.id}
                    onClick={() => router.push(`/admin/opportunities/${job.id}/quote`)}
                    className="w-full rounded border border-slate-200 bg-white p-3 text-left hover:border-blue-200 hover:bg-blue-50/40"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-mono text-xs font-semibold text-blue-600">{formatQuoteNumber(job.opportunity_number)}</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">{job.customer?.full_name ?? 'Unnamed customer'}</p>
                      </div>
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold capitalize text-green-700">{job.status}</span>
                    </div>
                    <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
                      <Briefcase size={12} /> {serviceLabel(job.service_type)}
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                      <MapPin size={12} /> {routeLabel(job)}
                    </p>
                    <p className="mt-2 text-xs text-slate-400">{job.agent?.full_name ?? 'Unassigned'}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
