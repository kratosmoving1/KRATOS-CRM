'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { MapPin, Clock, ChevronRight, Loader2, LogOut, Truck, Users } from 'lucide-react'
import Image from 'next/image'

interface CrewPerson { id: string; name: string; profile_picture_url: string | null }
interface Customer { id: string; full_name: string; phone: string | null }
interface Opportunity {
  id: string; opportunity_number: string; status: string; service_type: string
  service_date: string | null; move_size: string | null; total_amount: number
  origin_address_line1: string | null; origin_city: string | null; origin_province: string | null
  dest_address_line1: string | null; dest_city: string | null; dest_province: string | null
  customer: Customer | null
}
interface Crew {
  id: string; name: string; notes: string | null
  truck: { id: string; name: string; category: string } | null
  driver: CrewPerson | null; dispatcher: CrewPerson | null
  helpers: Array<{ person: CrewPerson }>
}
interface Assignment {
  id: string; scheduled_date: string; start_time: string; duration_hours: number; notes: string | null
  crew: Crew | null; opportunity: Opportunity | null
}

function formatDate(iso: string) {
  const d = new Date(iso + 'T12:00:00')
  const today = new Date(); today.setHours(12, 0, 0, 0)
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow'
  return d.toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' })
}

function formatTime(t: string) {
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`
}

function groupByDate(assignments: Assignment[]) {
  const groups: Record<string, Assignment[]> = {}
  for (const a of assignments) {
    if (!groups[a.scheduled_date]) groups[a.scheduled_date] = []
    groups[a.scheduled_date].push(a)
  }
  return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
}

export default function CrewJobsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [personName, setPersonName] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    fetch('/api/crew/jobs')
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); return }
        setAssignments(d.assignments ?? [])
        setPersonName(d.person?.name ?? '')
      })
      .catch(() => setError('Failed to load jobs'))
      .finally(() => setLoading(false))
  }, [])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/crew/login')
  }

  const grouped = groupByDate(assignments)

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Image src="/logo.png" alt="Kratos" width={32} height={32} className="rounded-lg" />
          <div>
            <p className="text-xs text-slate-400 leading-none">Kratos Crew</p>
            <p className="text-sm font-semibold text-white leading-tight">{personName || 'My Jobs'}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors px-2 py-1"
        >
          <LogOut size={14} />
          Sign out
        </button>
      </header>

      <main className="px-4 py-4 space-y-6 pb-8">
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

        {!loading && !error && grouped.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Truck size={40} className="text-slate-700 mb-3" />
            <p className="text-slate-400 font-medium">No upcoming jobs</p>
            <p className="text-slate-600 text-sm mt-1">Check back when you&apos;re scheduled</p>
          </div>
        )}

        {grouped.map(([date, jobs]) => (
          <div key={date}>
            <p className="text-xs font-bold uppercase tracking-widest text-[#ffad33] mb-3">
              {formatDate(date)}
            </p>
            <div className="space-y-3">
              {jobs.map(job => {
                const opp = job.opportunity
                const origin = [opp?.origin_address_line1, opp?.origin_city].filter(Boolean).join(', ')
                const dest = [opp?.dest_address_line1, opp?.dest_city].filter(Boolean).join(', ')
                const crewCount = [
                  job.crew?.driver, job.crew?.dispatcher,
                  ...(job.crew?.helpers?.map(h => h.person) ?? [])
                ].filter(Boolean).length

                return (
                  <button
                    key={job.id}
                    onClick={() => router.push(`/crew/jobs/${job.id}`)}
                    className="w-full text-left rounded-2xl bg-slate-900 border border-slate-800 p-4 space-y-3 active:bg-slate-800 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-white text-[15px]">
                          {opp?.customer?.full_name ?? 'Customer'}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {opp?.service_type?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) ?? 'Move'} · #{opp?.opportunity_number ?? '—'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <ChevronRight size={16} className="text-slate-600" />
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 text-sm text-slate-300">
                      <Clock size={13} className="text-slate-500 shrink-0" />
                      {formatTime(job.start_time)}
                      {job.crew?.truck && (
                        <span className="text-slate-600 ml-1">· {job.crew.truck.name}</span>
                      )}
                    </div>

                    {origin && (
                      <div className="space-y-1">
                        <div className="flex items-start gap-1.5 text-xs text-slate-400">
                          <MapPin size={11} className="text-green-500 shrink-0 mt-0.5" />
                          <span className="truncate">{origin}</span>
                        </div>
                        {dest && (
                          <div className="flex items-start gap-1.5 text-xs text-slate-400">
                            <MapPin size={11} className="text-red-400 shrink-0 mt-0.5" />
                            <span className="truncate">{dest}</span>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Users size={11} />
                      {crewCount} crew
                      {job.crew?.name && <span className="ml-1">· {job.crew.name}</span>}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </main>
    </div>
  )
}
