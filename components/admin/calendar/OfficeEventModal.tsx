'use client'

import { useEffect, useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export const EVENT_TYPES = [
  'IPC',
  'On-site Estimate',
  'Survey',
  'Follow-up',
  'Call-back',
  'Internal Task',
  'Meeting',
  'Admin',
  'Dispatch',
  'Other',
] as const
export type EventType = typeof EVENT_TYPES[number]

export const EVENT_TYPE_COLORS: Record<EventType, string> = {
  'IPC':             'bg-blue-100 text-blue-700',
  'On-site Estimate':'bg-purple-100 text-purple-700',
  'Survey':          'bg-teal-100 text-teal-700',
  'Follow-up':       'bg-amber-100 text-amber-700',
  'Call-back':       'bg-orange-100 text-orange-700',
  'Internal Task':   'bg-slate-100 text-slate-700',
  'Meeting':         'bg-indigo-100 text-indigo-700',
  'Admin':           'bg-zinc-100 text-zinc-700',
  'Dispatch':        'bg-green-100 text-green-700',
  'Other':           'bg-stone-100 text-stone-600',
}

export const EVENT_STATUSES = ['scheduled', 'completed', 'cancelled', 'no-show'] as const

export type OfficeEvent = {
  id: string
  title: string
  description: string | null
  event_type: EventType
  start_at: string
  end_at: string | null
  assigned_to: string | null
  customer_id: string | null
  opportunity_id: string | null
  location: string | null
  status: string
  assignee?: { id: string; full_name: string } | null
  customer?: { id: string; full_name: string } | null
  opportunity?: { id: string; opportunity_number: string } | null
}

type Profile = { id: string; full_name: string }

interface Props {
  event?: OfficeEvent | null
  defaultDate?: string
  onClose: () => void
  onSaved: () => void
}

function toLocalDatetime(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function localDatetimeToIso(local: string) {
  return new Date(local).toISOString()
}

export default function OfficeEventModal({ event, defaultDate, onClose, onSaved }: Props) {
  const isEdit = Boolean(event?.id)

  const defaultStart = defaultDate
    ? `${defaultDate}T09:00`
    : toLocalDatetime(new Date().toISOString())
  const defaultEnd = defaultDate
    ? `${defaultDate}T10:00`
    : toLocalDatetime(new Date(Date.now() + 3_600_000).toISOString())

  const [title, setTitle]             = useState(event?.title ?? '')
  const [eventType, setEventType]     = useState<EventType>((event?.event_type as EventType) ?? 'IPC')
  const [startAt, setStartAt]         = useState(event?.start_at ? toLocalDatetime(event.start_at) : defaultStart)
  const [endAt, setEndAt]             = useState(event?.end_at ? toLocalDatetime(event.end_at) : defaultEnd)
  const [assignedTo, setAssignedTo]   = useState(event?.assigned_to ?? '')
  const [customerId, setCustomerId]   = useState(event?.customer_id ?? '')
  const [opportunityId, setOppId]     = useState(event?.opportunity_id ?? '')
  const [location, setLocation]       = useState(event?.location ?? '')
  const [description, setDescription] = useState(event?.description ?? '')
  const [status, setStatus]           = useState(event?.status ?? 'scheduled')
  const [profiles, setProfiles]       = useState<Profile[]>([])
  const [submitting, setSubmitting]   = useState(false)
  const [error, setError]             = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/profiles')
      .then(r => r.ok ? r.json() : [])
      .then((data: Profile[]) => setProfiles(data))
      .catch(() => setProfiles([]))
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) { setError('Title is required'); return }
    setError(null)
    setSubmitting(true)

    const payload = {
      title: title.trim(),
      event_type: eventType,
      start_at: localDatetimeToIso(startAt),
      end_at: endAt ? localDatetimeToIso(endAt) : null,
      assigned_to: assignedTo || null,
      customer_id: customerId || null,
      opportunity_id: opportunityId || null,
      location: location.trim() || null,
      description: description.trim() || null,
      status,
    }

    try {
      const url = isEdit
        ? `/api/admin/calendar/office-events/${event!.id}`
        : '/api/admin/calendar/office-events'
      const method = isEdit ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? `Error ${res.status}`)
      }

      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save event')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!event?.id || !confirm('Delete this event?')) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/calendar/office-events/${event.id}`, { method: 'DELETE' })
      if (!res.ok && res.status !== 204) throw new Error('Delete failed')
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">{isEdit ? 'Edit Event' : 'Add Office Event'}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} className="max-h-[80vh] overflow-y-auto">
          <div className="space-y-4 px-5 py-4">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
            )}

            <Field label="Title *">
              <input
                value={title} onChange={e => setTitle(e.target.value)}
                placeholder="e.g. On-site estimate — Kim L."
                className={inputCls}
                required
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Event Type *">
                <select value={eventType} onChange={e => setEventType(e.target.value as EventType)} className={inputCls}>
                  {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Status">
                <select value={status} onChange={e => setStatus(e.target.value)} className={inputCls}>
                  <option value="scheduled">Scheduled</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="no-show">No-show</option>
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Start time *">
                <input type="datetime-local" value={startAt} onChange={e => setStartAt(e.target.value)} className={inputCls} required />
              </Field>
              <Field label="End time">
                <input type="datetime-local" value={endAt} onChange={e => setEndAt(e.target.value)} className={inputCls} />
              </Field>
            </div>

            <Field label="Assigned to">
              <select value={assignedTo} onChange={e => setAssignedTo(e.target.value)} className={inputCls}>
                <option value="">— Unassigned —</option>
                {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
              </select>
            </Field>

            <Field label="Location (optional)">
              <input value={location} onChange={e => setLocation(e.target.value)} placeholder="Address or room" className={inputCls} />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Related customer ID (optional)">
                <input value={customerId} onChange={e => setCustomerId(e.target.value)} placeholder="UUID" className={inputCls} />
              </Field>
              <Field label="Related quote ID (optional)">
                <input value={opportunityId} onChange={e => setOppId(e.target.value)} placeholder="UUID" className={inputCls} />
              </Field>
            </div>

            <Field label="Notes (optional)">
              <textarea
                value={description} onChange={e => setDescription(e.target.value)}
                rows={3} placeholder="Additional details…"
                className={cn(inputCls, 'resize-none')}
              />
            </Field>
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 px-5 py-4">
            <div>
              {isEdit && (
                <button type="button" onClick={handleDelete} disabled={submitting}
                  className="text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50">
                  Delete event
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={onClose}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                Cancel
              </button>
              <button type="submit" disabled={submitting}
                className={cn('flex items-center gap-1.5 rounded-lg bg-kratos px-4 py-2 text-sm font-semibold text-slate-950',
                  'hover:opacity-90 disabled:opacity-60')}>
                {submitting && <Loader2 size={14} className="animate-spin" />}
                {isEdit ? 'Save changes' : 'Add event'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-slate-500">{label}</label>
      {children}
    </div>
  )
}

const inputCls = 'w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-kratos focus:bg-white focus:ring-2 focus:ring-kratos/20'
