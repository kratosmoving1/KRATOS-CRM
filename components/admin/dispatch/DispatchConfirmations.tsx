'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  CalendarDays, Users, CheckCircle2, Clock, XCircle, Loader2, Mail, Send, AlertCircle,
} from 'lucide-react'

// ─── Shared types (shape of /api/admin/dispatch/day-status) ─────────────────────

interface Person { id: string; name: string | null; profile_picture_url: string | null }
interface Customer { id: string; full_name: string; email: string | null; phone: string | null }
interface Crew {
  id: string; name: string | null
  driver: Person | Person[] | null
  dispatcher: Person | Person[] | null
  helpers: Array<{ person: Person | Person[] | null }>
}
interface Opp {
  id: string; opportunity_number: string; status: string
  arrival_window_start: string | null; arrival_window_end: string | null
  origin_city: string | null; origin_province: string | null
  dest_city: string | null; dest_province: string | null
  customer: Customer | Customer[] | null
}
interface Assignment {
  id: string; scheduled_date: string; start_time: string | null; crew_id: string | null
  published_at: string | null; customer_confirmed_at: string | null
  crew: Crew | Crew[] | null
  opportunity: Opp | Opp[] | null
}
interface Acceptance { assignment_id: string; person_id: string; role: string | null; status: string; responded_at: string | null }

function one<T>(v: T | T[] | null): T | null {
  if (!v) return null
  return Array.isArray(v) ? v[0] ?? null : v
}
function fmtArrival(s: string | null, e: string | null): string {
  const t = (x: string | null) => {
    if (!x) return null
    const [h, m] = x.split(':').map(Number)
    if (Number.isNaN(h)) return null
    return `${h % 12 === 0 ? 12 : h % 12}:${String(m ?? 0).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
  }
  const a = t(s), b = t(e)
  if (a && b) return `${a} – ${b}`
  return a ?? b ?? 'TBD'
}
function fmtWhen(iso: string): string {
  return new Date(iso).toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function useDayStatus(dateStr: string) {
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [acceptances, setAcceptances] = useState<Acceptance[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/dispatch/day-status?date=${dateStr}`, { cache: 'no-store' })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setError(j.error ?? 'Failed to load'); return }
      setAssignments(j.assignments ?? [])
      setAcceptances(j.acceptances ?? [])
      setError(null)
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }, [dateStr])

  useEffect(() => { load() }, [load])
  return { assignments, acceptances, loading, error, reload: load, setAssignments }
}

function EmptyState({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="text-slate-300 mb-3">{icon}</div>
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <p className="text-xs text-slate-400 mt-1">{sub}</p>
    </div>
  )
}

// ─── Sub-tab bar ────────────────────────────────────────────────────────────────

export function DispatchSubTabs({
  view, onChange,
}: { view: 'schedule' | 'customer' | 'crew'; onChange: (v: 'schedule' | 'customer' | 'crew') => void }) {
  const tabs: Array<{ id: 'schedule' | 'customer' | 'crew'; label: string }> = [
    { id: 'schedule', label: 'Schedule' },
    { id: 'customer', label: 'Customer Confirmation' },
    { id: 'crew', label: 'Crew Confirmation' },
  ]
  return (
    <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1 w-fit">
      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`text-xs font-medium px-3 py-1.5 rounded-md transition-colors ${
            view === t.id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

// ─── Customer Confirmation ──────────────────────────────────────────────────────

export function CustomerConfirmationTab({
  dateStr, onToast,
}: { dateStr: string; onToast: (msg: string, isError: boolean) => void }) {
  const { assignments, loading, error, setAssignments } = useDayStatus(dateStr)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  async function confirm(assignmentId: string) {
    setConfirmingId(assignmentId)
    try {
      const res = await fetch('/api/admin/dispatch/confirm-customer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignmentId }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { onToast(j.error ?? 'Failed to confirm', true); return }
      setAssignments(prev => prev.map(a => a.id === assignmentId ? { ...a, customer_confirmed_at: j.customer_confirmed_at } : a))
      onToast('Customer confirmation email sent.', false)
    } catch {
      onToast('Network error — please try again', true)
    } finally {
      setConfirmingId(null)
    }
  }

  if (loading) return <PanelLoading />
  if (error) return <PanelError msg={error} />
  if (assignments.length === 0) {
    return <div className="bg-white border border-slate-200 rounded-lg"><EmptyState icon={<CalendarDays size={36} />} title="No scheduled jobs for this day" sub="Drag a job onto a crew on the Schedule tab first." /></div>
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100">
        <p className="text-sm font-semibold text-slate-900">Customer Confirmation</p>
        <p className="text-xs text-slate-400 mt-0.5">Confirm each move with the customer. This is the dispatcher confirmation — separate from the sales booking.</p>
      </div>
      <div className="divide-y divide-slate-100">
        {assignments.map(a => {
          const opp = one(a.opportunity)
          const customer = one(opp?.customer ?? null)
          const confirmed = Boolean(a.customer_confirmed_at)
          const hasEmail = Boolean(customer?.email)
          const route = [opp?.origin_city, opp?.dest_city].filter(Boolean).join(' → ')
          return (
            <div key={a.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-slate-900 truncate">{customer?.full_name ?? 'Customer'}</p>
                  <span className="text-xs text-slate-400">#{opp?.opportunity_number}</span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5 truncate">
                  {route || '—'} · Arrival {fmtArrival(opp?.arrival_window_start ?? null, opp?.arrival_window_end ?? null)}
                </p>
                {!hasEmail && (
                  <p className="text-[11px] text-amber-600 flex items-center gap-1 mt-1"><AlertCircle size={11} /> No email on file</p>
                )}
              </div>
              <div className="shrink-0">
                {confirmed ? (
                  <div className="text-right">
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">
                      <CheckCircle2 size={12} /> Confirmed
                    </span>
                    <p className="text-[10px] text-slate-400 mt-1">{fmtWhen(a.customer_confirmed_at!)}</p>
                    <button
                      onClick={() => confirm(a.id)}
                      disabled={confirmingId === a.id || !hasEmail}
                      className="text-[11px] text-slate-400 hover:text-slate-600 mt-0.5 disabled:opacity-40"
                    >
                      Resend
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => confirm(a.id)}
                    disabled={confirmingId === a.id || !hasEmail}
                    className="flex items-center gap-1.5 rounded-lg bg-kratos px-3 py-1.5 text-xs font-semibold text-slate-950 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {confirmingId === a.id ? <Loader2 size={12} className="animate-spin" /> : <Mail size={12} />}
                    Confirm &amp; email
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Crew Confirmation ──────────────────────────────────────────────────────────

export function CrewConfirmationTab({ dateStr }: { dateStr: string }) {
  const { assignments, acceptances, loading, error } = useDayStatus(dateStr)

  if (loading) return <PanelLoading />
  if (error) return <PanelError msg={error} />
  if (assignments.length === 0) {
    return <div className="bg-white border border-slate-200 rounded-lg"><EmptyState icon={<Users size={36} />} title="No scheduled jobs for this day" sub="Drag a job onto a crew on the Schedule tab first." /></div>
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100">
        <p className="text-sm font-semibold text-slate-900">Crew Confirmation</p>
        <p className="text-xs text-slate-400 mt-0.5">Who has accepted their assignment. Crew members respond from the crew app after you publish.</p>
      </div>
      <div className="divide-y divide-slate-100">
        {assignments.map(a => {
          const opp = one(a.opportunity)
          const customer = one(opp?.customer ?? null)
          const crew = one(a.crew)
          const published = Boolean(a.published_at)

          const members: Array<{ person: Person; role: string }> = []
          const driver = one(crew?.driver ?? null)
          const dispatcher = one(crew?.dispatcher ?? null)
          if (driver) members.push({ person: driver, role: 'Driver' })
          if (dispatcher) members.push({ person: dispatcher, role: 'Dispatcher' })
          for (const h of crew?.helpers ?? []) {
            const p = one(h.person)
            if (p) members.push({ person: p, role: 'Helper' })
          }

          const accByPerson: Record<string, Acceptance> = {}
          for (const acc of acceptances.filter(x => x.assignment_id === a.id)) accByPerson[acc.person_id] = acc

          const acceptedCount = members.filter(m => accByPerson[m.person.id]?.status === 'accepted').length

          return (
            <div key={a.id} className="px-4 py-3">
              <div className="flex items-center justify-between gap-2 mb-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{customer?.full_name ?? 'Customer'}</p>
                  <span className="text-xs text-slate-400">#{opp?.opportunity_number}</span>
                  {crew?.name && <span className="text-xs text-slate-400">· {crew.name}</span>}
                </div>
                {published ? (
                  <span className="shrink-0 text-[11px] text-slate-500">{acceptedCount}/{members.length} accepted</span>
                ) : (
                  <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                    Not published
                  </span>
                )}
              </div>

              {members.length === 0 ? (
                <p className="text-xs text-slate-400">No crew assigned.</p>
              ) : (
                <div className="space-y-1.5">
                  {members.map(m => {
                    const acc = accByPerson[m.person.id]
                    const status = published ? (acc?.status ?? 'pending') : 'unpublished'
                    return (
                      <div key={m.person.id} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600 shrink-0 overflow-hidden">
                            {m.person.profile_picture_url
                              // eslint-disable-next-line @next/next/no-img-element
                              ? <img src={m.person.profile_picture_url} alt={m.person.name ?? ''} className="w-full h-full object-cover" />
                              : (m.person.name ?? '?').charAt(0).toUpperCase()}
                          </div>
                          <span className="text-sm text-slate-700 truncate">{m.person.name}</span>
                          <span className="text-[10px] text-slate-400 uppercase tracking-wide shrink-0">{m.role}</span>
                        </div>
                        <CrewStatusBadge status={status} />
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CrewStatusBadge({ status }: { status: string }) {
  if (status === 'accepted') {
    return <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-700"><CheckCircle2 size={11} /> Accepted</span>
  }
  if (status === 'declined') {
    return <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-600"><XCircle size={11} /> Declined</span>
  }
  if (status === 'pending') {
    return <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700"><Clock size={11} /> Pending</span>
  }
  return <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-400"><Send size={11} /> Not sent</span>
}

function PanelLoading() {
  return (
    <div className="bg-white border border-slate-200 rounded-lg flex items-center justify-center py-16">
      <Loader2 size={22} className="animate-spin text-slate-400" />
    </div>
  )
}
function PanelError({ msg }: { msg: string }) {
  return (
    <div className="bg-white border border-red-200 rounded-lg px-4 py-6 text-center text-sm text-red-600">{msg}</div>
  )
}
