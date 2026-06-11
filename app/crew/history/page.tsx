'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MapPin, Clock, ChevronRight, Loader2, CheckCircle } from 'lucide-react'

interface Opportunity {
  id: string; opportunity_number: string; status: string; service_type: string
  origin_address_line1: string | null; origin_city: string | null
  dest_address_line1: string | null; dest_city: string | null
  customer: { id: string; full_name: string } | null
}
interface Assignment {
  id: string; scheduled_date: string; start_time: string; duration_hours: number
  opportunity: Opportunity | null
  crew: { truck: { name: string } | null } | null
}

function formatDate(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

function formatTime(t: string) {
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`
}

function statusColor(s: string) {
  if (s === 'completed' || s === 'closed') return 'text-green-400'
  if (s === 'cancelled') return 'text-red-400'
  return 'text-slate-400'
}

export default function CrewHistoryPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    fetch('/api/crew/jobs?type=history')
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); return }
        setAssignments(d.assignments ?? [])
      })
      .catch(() => setError('Failed to load history'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="sticky top-0 z-10 bg-slate-900 border-b border-slate-800 px-4 py-4">
        <h1 className="text-base font-bold text-white">Job History</h1>
        <p className="text-xs text-slate-500 mt-0.5">All your past assignments</p>
      </header>

      <main className="px-4 py-4 space-y-3">
        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-[#ffad33]" />
          </div>
        )}

        {error && (
          <div className="rounded-xl bg-red-950 border border-red-800 px-4 py-4 text-sm text-red-300 text-center">
            {error}
          </div>
        )}

        {!loading && !error && assignments.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <CheckCircle size={40} className="text-slate-700 mb-3" />
            <p className="text-slate-400 font-medium">No completed jobs yet</p>
            <p className="text-slate-600 text-sm mt-1">Your past jobs will appear here</p>
          </div>
        )}

        {assignments.map(job => {
          const opp = job.opportunity
          const origin = [opp?.origin_address_line1, opp?.origin_city].filter(Boolean).join(', ')
          const dest = [opp?.dest_address_line1, opp?.dest_city].filter(Boolean).join(', ')

          return (
            <button
              key={job.id}
              onClick={() => router.push(`/crew/jobs/${job.id}`)}
              className="w-full text-left rounded-2xl bg-slate-900 border border-slate-800 p-4 space-y-2.5 active:bg-slate-800 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-white text-sm">
                    {opp?.customer?.full_name ?? 'Customer'}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {opp?.service_type?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) ?? 'Move'} · #{opp?.opportunity_number ?? '—'}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {opp?.status && (
                    <span className={`text-[10px] font-semibold uppercase ${statusColor(opp.status)}`}>
                      {opp.status}
                    </span>
                  )}
                  <ChevronRight size={14} className="text-slate-600" />
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span>{formatDate(job.scheduled_date)}</span>
                <span>·</span>
                <Clock size={11} className="shrink-0" />
                <span>{formatTime(job.start_time)}</span>
                {job.duration_hours > 0 && <span>· {job.duration_hours}h</span>}
              </div>

              {(origin || dest) && (
                <div className="space-y-1">
                  {origin && (
                    <div className="flex items-start gap-1.5 text-xs text-slate-500">
                      <MapPin size={10} className="text-green-600 shrink-0 mt-0.5" />
                      <span className="truncate">{origin}</span>
                    </div>
                  )}
                  {dest && (
                    <div className="flex items-start gap-1.5 text-xs text-slate-500">
                      <MapPin size={10} className="text-red-600 shrink-0 mt-0.5" />
                      <span className="truncate">{dest}</span>
                    </div>
                  )}
                </div>
              )}
            </button>
          )
        })}
      </main>
    </div>
  )
}
