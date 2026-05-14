'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ChevronRight, Edit2, RefreshCw, Trash2, Loader2,
  MapPin, Phone, Mail, FileText, PhoneCall, MessageSquare, AtSign,
  Clock, CheckCircle2,
} from 'lucide-react'
import { toast } from 'sonner'
import StatusPill from '@/components/ui/StatusPill'
import ChangeStatusModal from '@/components/admin/modals/ChangeStatusModal'
import CreateOpportunityModal from '@/components/admin/modals/CreateOpportunityModal'
import { OPP_STATUSES, MOVE_SIZE_LABELS } from '@/lib/constants'
import type { OppStatus } from '@/lib/constants'
import { formatCurrency } from '@/lib/format'
import { cn } from '@/lib/utils'

const SERVICE_TYPE_LABELS: Record<string, string> = {
  local: 'Local', long_distance: 'Long Distance', commercial: 'Commercial',
  packing: 'Packing', storage: 'Storage', international: 'International',
}

const CALL_OUTCOMES: Record<string, string> = {
  connected: 'Connected', voicemail: 'Voicemail', no_answer: 'No Answer',
  wrong_number: 'Wrong Number', busy: 'Busy',
}

function formatDate(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' })
}
function formatDateShort(d: string) {
  return new Date(d).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })
}
function formatDatetime(d: string) {
  return new Date(d).toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

interface AuditEntry {
  id: string; action: string; diff: Record<string, unknown> | null; created_at: string
  user: { full_name: string } | null
}

interface OppDetail {
  id: string; opportunity_number: string; status: OppStatus
  service_type: string; service_date: string | null; move_size: string | null
  total_amount: number; estimated_cost: number; notes: string | null
  origin_address_line1: string | null; origin_address_line2: string | null
  origin_city: string | null; origin_province: string | null
  origin_postal_code: string | null; origin_dwelling_type: string | null
  origin_floor: number | null; origin_has_elevator: boolean | null
  origin_stairs: number | null; origin_long_carry: boolean | null
  origin_parking_notes: string | null
  dest_address_line1: string | null; dest_address_line2: string | null
  dest_city: string | null; dest_province: string | null
  dest_postal_code: string | null; dest_dwelling_type: string | null
  dest_floor: number | null; dest_has_elevator: boolean | null
  dest_stairs: number | null; dest_long_carry: boolean | null
  dest_parking_notes: string | null
  created_at: string; updated_at: string
  customer: {
    id: string; full_name: string; email: string | null; phone: string | null
    phone_type: string | null; secondary_phone: string | null
  } | null
  agent: { id: string; full_name: string; email: string } | null
  lead_source: { id: string; name: string } | null
  audit_log: AuditEntry[]
}

interface TimelineItem {
  id: string
  _kind: 'communication' | 'audit'
  type?: string
  direction?: string
  subject?: string
  body?: string
  call_outcome?: string
  call_duration_seconds?: number
  action?: string
  diff?: Record<string, unknown> | null
  created_at: string
  actor: string | null
}

function AddressBlock({ prefix, data }: { prefix: 'origin' | 'dest'; data: OppDetail }) {
  const isOrigin = prefix === 'origin'
  const addr1    = isOrigin ? data.origin_address_line1 : data.dest_address_line1
  const addr2    = isOrigin ? data.origin_address_line2 : data.dest_address_line2
  const city     = isOrigin ? data.origin_city          : data.dest_city
  const prov     = isOrigin ? data.origin_province      : data.dest_province
  const postal   = isOrigin ? data.origin_postal_code   : data.dest_postal_code
  const dwelling = isOrigin ? data.origin_dwelling_type : data.dest_dwelling_type
  const floor    = isOrigin ? data.origin_floor         : data.dest_floor
  const elevator = isOrigin ? data.origin_has_elevator  : data.dest_has_elevator
  const stairs   = isOrigin ? data.origin_stairs        : data.dest_stairs
  const longCarry= isOrigin ? data.origin_long_carry    : data.dest_long_carry
  const parking  = isOrigin ? data.origin_parking_notes : data.dest_parking_notes
  const hasAddress = addr1 || city
  if (!hasAddress) return <p className="text-sm text-slate-400">Not set</p>
  return (
    <div className="space-y-1 text-sm text-slate-700">
      {addr1 && <p>{addr1}</p>}
      {addr2 && <p>{addr2}</p>}
      {(city || prov || postal) && (
        <p>{[city, prov, postal].filter(Boolean).join(', ')}</p>
      )}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
        {dwelling && <span className="capitalize">{dwelling.replace(/_/g,' ')}</span>}
        {floor != null && <span>Floor {floor}</span>}
        {elevator && <span>Elevator ✓</span>}
        {(stairs ?? 0) > 0 && <span>{stairs} stairs</span>}
        {longCarry && <span>Long carry ✓</span>}
      </div>
      {parking && <p className="mt-1 text-xs italic text-slate-500">{parking}</p>}
    </div>
  )
}

const COMM_TYPES = [
  { value: 'note',  label: 'Note',  icon: FileText },
  { value: 'call',  label: 'Call',  icon: PhoneCall },
  { value: 'sms',   label: 'Text',  icon: MessageSquare },
  { value: 'email', label: 'Email', icon: AtSign },
] as const

type CommType = typeof COMM_TYPES[number]['value']

const CALL_OUTCOME_OPTIONS = [
  { value: 'connected',    label: 'Connected' },
  { value: 'voicemail',    label: 'Voicemail' },
  { value: 'no_answer',    label: 'No Answer' },
  { value: 'wrong_number', label: 'Wrong Number' },
  { value: 'busy',         label: 'Busy' },
]

function CommTypeIcon({ type }: { type: string }) {
  const icons: Record<string, React.ElementType> = {
    note: FileText, call: PhoneCall, sms: MessageSquare, email: AtSign,
  }
  const Icon = icons[type] ?? FileText
  return <Icon size={14} className="shrink-0 text-slate-400" />
}

export default function OpportunityDetailPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()

  const [opp, setOpp] = useState<OppDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'sales' | 'estimate'>('sales')

  const [showStatusModal, setShowStatusModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Communication composer
  const [commType, setCommType] = useState<CommType>('note')
  const [commBody, setCommBody] = useState('')
  const [commCallOutcome, setCommCallOutcome] = useState('')
  const [commSubject, setCommSubject] = useState('')
  const [commEmailTo, setCommEmailTo] = useState('')
  const [commSubmitting, setCommSubmitting] = useState(false)

  // Timeline
  const [timeline, setTimeline] = useState<TimelineItem[]>([])
  const [timelineLoading, setTimelineLoading] = useState(false)

  // Notes (estimate tab)
  const [notes, setNotes] = useState('')
  const [notesSaving, setNotesSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/opportunities/${id}`)
      if (!res.ok) { setError('Opportunity not found'); return }
      const data: OppDetail = await res.json()
      setOpp(data)
      setNotes(data.notes ?? '')
    } catch { setError('Failed to load') }
    finally { setLoading(false) }
  }, [id])

  const loadTimeline = useCallback(async () => {
    setTimelineLoading(true)
    try {
      const res = await fetch(`/api/admin/opportunities/${id}/timeline`)
      if (res.ok) setTimeline(await res.json())
    } catch {}
    finally { setTimelineLoading(false) }
  }, [id])

  useEffect(() => { load() }, [load])
  useEffect(() => { if (tab === 'sales') loadTimeline() }, [tab, loadTimeline])

  async function saveNotes() {
    if (!opp || notes === opp.notes) return
    setNotesSaving(true)
    try {
      await fetch(`/api/admin/opportunities/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      })
      setOpp(p => p ? { ...p, notes } : p)
    } finally { setNotesSaving(false) }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/opportunities/${id}`, { method: 'DELETE' })
      if (!res.ok) { toast.error('Delete failed'); return }
      toast.success('Opportunity deleted')
      router.push('/admin/opportunities')
    } finally { setDeleting(false) }
  }

  async function submitComm() {
    if (!commBody.trim()) return
    setCommSubmitting(true)
    try {
      const payload: Record<string, unknown> = {
        opportunity_id: id,
        type: commType,
        body: commBody,
      }
      if (commType === 'call') {
        payload.call_outcome = commCallOutcome || null
        payload.direction = 'outbound'
      }
      if (commType === 'email') {
        payload.subject  = commSubject || null
        payload.email_to = commEmailTo || null
        payload.direction = 'outbound'
      }
      if (commType === 'note') payload.direction = 'internal'
      if (commType === 'sms')  payload.direction = 'outbound'

      const res = await fetch('/api/admin/communications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) { toast.error('Failed to save'); return }
      toast.success(commType === 'note' ? 'Note saved' : `${commType.toUpperCase()} logged`)
      setCommBody('')
      setCommCallOutcome('')
      setCommSubject('')
      setCommEmailTo('')
      loadTimeline()
    } catch { toast.error('Network error') }
    finally { setCommSubmitting(false) }
  }

  if (loading) return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 w-64 rounded bg-slate-200" />
      <div className="h-16 rounded-xl bg-slate-200" />
      <div className="h-64 rounded-xl bg-slate-200" />
    </div>
  )

  if (error || !opp) return (
    <div className="flex flex-col items-center justify-center py-32 text-center">
      <p className="text-sm font-medium text-slate-500">{error ?? 'Not found'}</p>
      <Link href="/admin/opportunities" className="mt-4 text-sm text-kratos hover:underline">← Back to Opportunities</Link>
    </div>
  )

  const profit = opp.total_amount - opp.estimated_cost

  // Timeline stats
  const callCount  = timeline.filter(t => t._kind === 'communication' && t.type === 'call').length
  const noteCount  = timeline.filter(t => t._kind === 'communication' && t.type === 'note').length
  const emailCount = timeline.filter(t => t._kind === 'communication' && t.type === 'email').length
  const smsCount   = timeline.filter(t => t._kind === 'communication' && t.type === 'sms').length

  return (
    <>
      <div className="space-y-4">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm text-slate-500">
          <Link href="/admin/opportunities" className="hover:text-slate-800">Opportunities</Link>
          <ChevronRight size={14} />
          <span className="font-mono font-medium text-slate-700">{opp.opportunity_number}</span>
        </nav>

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold tracking-tight text-slate-900">
                {opp.customer?.full_name ?? 'Unknown Customer'}
              </h1>
              <StatusPill status={opp.status} />
              <span className="font-mono text-sm text-slate-400">{opp.opportunity_number}</span>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {SERVICE_TYPE_LABELS[opp.service_type] ?? opp.service_type}
              {opp.service_date ? ` · ${formatDateShort(opp.service_date)}` : ' · TBD'}
              {opp.move_size ? ` · ${MOVE_SIZE_LABELS[opp.move_size] ?? opp.move_size.replace(/_/g,' ')}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowEditModal(true)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Edit2 size={14} /> Edit
            </button>
            <button
              onClick={() => setShowStatusModal(true)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw size={14} /> Status
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-slate-200">
          {(['sales', 'estimate'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'px-5 py-2.5 text-sm font-medium capitalize transition-colors',
                tab === t
                  ? 'border-b-2 border-kratos text-slate-900'
                  : 'text-slate-500 hover:text-slate-700',
              )}
            >
              {t === 'sales' ? 'Sales' : 'Estimate'}
            </button>
          ))}
        </div>

        {/* ── SALES TAB ── */}
        {tab === 'sales' && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* Left: composer + timeline */}
            <div className="space-y-4 lg:col-span-2">
              {/* Stats strip */}
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: 'Calls',  value: callCount },
                  { label: 'Texts',  value: smsCount },
                  { label: 'Emails', value: emailCount },
                  { label: 'Notes',  value: noteCount },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-center">
                    <p className="text-xl font-bold text-slate-900">{value}</p>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{label}</p>
                  </div>
                ))}
              </div>

              {/* Communication composer */}
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                {/* Type tabs */}
                <div className="mb-4 flex gap-1 rounded-lg bg-slate-100 p-1">
                  {COMM_TYPES.map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      onClick={() => setCommType(value)}
                      className={cn(
                        'flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-semibold transition-colors',
                        commType === value
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700',
                      )}
                    >
                      <Icon size={13} /> {label}
                    </button>
                  ))}
                </div>

                {/* Email fields */}
                {commType === 'email' && (
                  <div className="mb-3 space-y-2">
                    <input
                      value={commEmailTo}
                      onChange={e => setCommEmailTo(e.target.value)}
                      placeholder="To: customer@example.com"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-kratos focus:ring-2 focus:ring-kratos/20"
                    />
                    <input
                      value={commSubject}
                      onChange={e => setCommSubject(e.target.value)}
                      placeholder="Subject"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-kratos focus:ring-2 focus:ring-kratos/20"
                    />
                  </div>
                )}

                {/* Call outcome */}
                {commType === 'call' && (
                  <div className="mb-3">
                    <select
                      value={commCallOutcome}
                      onChange={e => setCommCallOutcome(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-kratos"
                    >
                      <option value="">Select call outcome…</option>
                      {CALL_OUTCOME_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                )}

                <textarea
                  rows={commType === 'note' ? 4 : 3}
                  value={commBody}
                  onChange={e => setCommBody(e.target.value)}
                  placeholder={
                    commType === 'note'  ? 'Write a note…' :
                    commType === 'call'  ? 'Call summary…' :
                    commType === 'sms'   ? 'Message content…' :
                    'Email body…'
                  }
                  className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-kratos focus:bg-white focus:ring-2 focus:ring-kratos/20"
                />
                <div className="mt-3 flex justify-end">
                  <button
                    onClick={submitComm}
                    disabled={commSubmitting || !commBody.trim()}
                    className="flex items-center gap-2 rounded-lg bg-kratos px-5 py-2 text-sm font-semibold text-slate-900 hover:opacity-90 disabled:opacity-50"
                  >
                    {commSubmitting && <Loader2 size={14} className="animate-spin" />}
                    {commType === 'note' ? 'Save Note' : `Log ${commType.charAt(0).toUpperCase() + commType.slice(1)}`}
                  </button>
                </div>
              </div>

              {/* Activity timeline */}
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-slate-400">Activity</h2>
                {timelineLoading ? (
                  <div className="space-y-4 animate-pulse">
                    {[0,1,2].map(i => (
                      <div key={i} className="flex gap-3">
                        <div className="h-6 w-6 rounded-full bg-slate-100 shrink-0" />
                        <div className="flex-1 space-y-1">
                          <div className="h-3 w-1/3 rounded bg-slate-100" />
                          <div className="h-3 w-2/3 rounded bg-slate-100" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : timeline.length === 0 ? (
                  <p className="text-sm text-slate-400">No activity yet — log a call, note, or email above.</p>
                ) : (
                  <div className="space-y-4">
                    {timeline.map(item => (
                      <div key={item.id} className="flex gap-3">
                        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50">
                          {item._kind === 'communication' ? (
                            <CommTypeIcon type={item.type ?? 'note'} />
                          ) : (
                            <CheckCircle2 size={12} className="text-kratos" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          {item._kind === 'communication' ? (
                            <>
                              <div className="flex items-baseline gap-2 flex-wrap">
                                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 capitalize">{item.type}</span>
                                {item.call_outcome && (
                                  <span className="text-xs text-slate-400">— {CALL_OUTCOMES[item.call_outcome] ?? item.call_outcome}</span>
                                )}
                                {item.subject && (
                                  <span className="text-xs font-medium text-slate-600 truncate">&ldquo;{item.subject}&rdquo;</span>
                                )}
                              </div>
                              <p className="mt-0.5 text-sm text-slate-700 whitespace-pre-wrap break-words">{item.body}</p>
                              <p className="mt-1 text-xs text-slate-400">
                                {item.actor ?? 'Unknown'} · {formatDatetime(item.created_at)}
                              </p>
                            </>
                          ) : (
                            <>
                              <p className="text-sm text-slate-700">
                                {item.action === 'create'
                                  ? 'Opportunity created'
                                  : item.action === 'status_change'
                                  ? `Status → ${OPP_STATUSES.find(s => s.value === item.diff?.to)?.label ?? item.diff?.to}`
                                  : item.action === 'update'
                                  ? 'Details updated'
                                  : item.action}
                                {!!item.diff?.reason && (
                                  <span className="text-slate-500"> — {String(item.diff.reason)}</span>
                                )}
                              </p>
                              <p className="mt-0.5 text-xs text-slate-400">
                                {item.actor ?? 'Unknown'} · {formatDatetime(item.created_at)}
                              </p>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right sidebar */}
            <div className="space-y-4">
              {/* Customer card */}
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-slate-400">Customer</h2>
                {opp.customer ? (
                  <div className="space-y-2">
                    <Link
                      href={`/admin/customers/${opp.customer.id}`}
                      className="block font-semibold text-slate-900 hover:text-kratos"
                    >
                      {opp.customer.full_name}
                    </Link>
                    {opp.customer.phone && (
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Phone size={13} className="text-slate-400 shrink-0" />
                        <a href={`tel:${opp.customer.phone}`} className="hover:text-kratos">
                          {opp.customer.phone}
                        </a>
                        {opp.customer.phone_type && (
                          <span className="capitalize text-xs text-slate-400">({opp.customer.phone_type})</span>
                        )}
                      </div>
                    )}
                    {opp.customer.secondary_phone && (
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Phone size={13} className="text-slate-400 shrink-0" />
                        {opp.customer.secondary_phone}
                      </div>
                    )}
                    {opp.customer.email && (
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Mail size={13} className="text-slate-400 shrink-0" />
                        <a href={`mailto:${opp.customer.email}`} className="hover:text-kratos break-all">
                          {opp.customer.email}
                        </a>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">No customer linked</p>
                )}
              </div>

              {/* Information card */}
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-slate-400">Information</h2>
                <div className="space-y-2.5 text-sm">
                  <InfoRow label="Agent"   value={opp.agent?.full_name ?? 'Unassigned'} />
                  <InfoRow label="Source"  value={opp.lead_source?.name ?? '—'} />
                  <InfoRow label="Service" value={SERVICE_TYPE_LABELS[opp.service_type] ?? opp.service_type} />
                  <InfoRow label="Date"    value={opp.service_date ? formatDateShort(opp.service_date) : 'TBD'} />
                  <InfoRow label="Size"    value={opp.move_size ? (MOVE_SIZE_LABELS[opp.move_size] ?? opp.move_size.replace(/_/g,' ')) : '—'} />
                </div>
              </div>

              {/* Opportunity Total card */}
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-slate-400">Opportunity Total</h2>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Total Amount</span>
                    <span className="font-semibold text-slate-900">
                      {opp.total_amount > 0 ? formatCurrency(opp.total_amount) : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Est. Cost</span>
                    <span className="font-semibold text-slate-900">
                      {opp.estimated_cost > 0 ? formatCurrency(opp.estimated_cost) : '—'}
                    </span>
                  </div>
                  {opp.total_amount > 0 && (
                    <div className="flex justify-between border-t border-slate-100 pt-2">
                      <span className="font-medium text-slate-600">Profit</span>
                      <span className={`font-bold ${profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {formatCurrency(profit)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Timeline card */}
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-slate-400">Timeline</h2>
                <div className="space-y-1.5 text-sm text-slate-600">
                  <p className="flex items-center gap-2">
                    <Clock size={13} className="text-slate-400 shrink-0" />
                    Created {formatDate(opp.created_at)}
                  </p>
                  <p className="flex items-center gap-2">
                    <Clock size={13} className="text-slate-400 shrink-0" />
                    Updated {formatDate(opp.updated_at)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── ESTIMATE TAB ── */}
        {tab === 'estimate' && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* Left: move details + addresses + notes */}
            <div className="space-y-4 lg:col-span-2">
              {/* 4 stat cards */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Total</p>
                  <p className="mt-1 text-lg font-bold text-slate-900">
                    {opp.total_amount > 0 ? formatCurrency(opp.total_amount) : '—'}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Est. Cost</p>
                  <p className="mt-1 text-lg font-bold text-slate-900">
                    {opp.estimated_cost > 0 ? formatCurrency(opp.estimated_cost) : '—'}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Profit</p>
                  <p className={`mt-1 text-lg font-bold ${profit < 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                    {opp.total_amount > 0 ? formatCurrency(profit) : '—'}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Move Size</p>
                  <p className="mt-1 text-lg font-bold text-slate-900 capitalize">
                    {opp.move_size ? (MOVE_SIZE_LABELS[opp.move_size] ?? opp.move_size.replace(/_/g,' ')) : '—'}
                  </p>
                </div>
              </div>

              {/* Trip info: origin + dest */}
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-slate-400">Trip Info</h2>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div>
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-slate-400">
                      <MapPin size={12} /> Origin
                    </p>
                    <AddressBlock prefix="origin" data={opp} />
                  </div>
                  <div>
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-slate-400">
                      <MapPin size={12} /> Destination
                    </p>
                    <AddressBlock prefix="dest" data={opp} />
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-slate-400">Internal Notes</h2>
                <textarea
                  rows={5}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  onBlur={saveNotes}
                  placeholder="Add internal notes…"
                  className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-kratos focus:bg-white focus:ring-2 focus:ring-kratos/20"
                />
                {notesSaving && <p className="mt-1 text-xs text-slate-400">Saving…</p>}
              </div>
            </div>

            {/* Right sidebar */}
            <div className="space-y-4">
              {/* Information */}
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-slate-400">Information</h2>
                <div className="space-y-2.5 text-sm">
                  <InfoRow label="Status"  value={OPP_STATUSES.find(s => s.value === opp.status)?.label ?? opp.status} />
                  <InfoRow label="Agent"   value={opp.agent?.full_name ?? 'Unassigned'} />
                  <InfoRow label="Source"  value={opp.lead_source?.name ?? '—'} />
                  <InfoRow label="Service" value={SERVICE_TYPE_LABELS[opp.service_type] ?? opp.service_type} />
                  <InfoRow label="Date"    value={opp.service_date ? formatDate(opp.service_date) : 'TBD'} />
                </div>
              </div>

              {/* Customer */}
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-slate-400">Customer</h2>
                {opp.customer ? (
                  <div className="space-y-2">
                    <Link href={`/admin/customers/${opp.customer.id}`}
                      className="block font-semibold text-slate-900 hover:text-kratos">
                      {opp.customer.full_name}
                    </Link>
                    {opp.customer.phone && (
                      <p className="flex items-center gap-2 text-sm text-slate-600">
                        <Phone size={13} className="text-slate-400" /> {opp.customer.phone}
                      </p>
                    )}
                    {opp.customer.email && (
                      <p className="flex items-center gap-2 text-sm text-slate-600">
                        <Mail size={13} className="text-slate-400" />
                        <span className="break-all">{opp.customer.email}</span>
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">No customer linked</p>
                )}
              </div>

              {/* Opportunity Total */}
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-slate-400">Opportunity Total</h2>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Total Amount</span>
                    <span className="font-semibold text-slate-900">
                      {opp.total_amount > 0 ? formatCurrency(opp.total_amount) : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Est. Cost</span>
                    <span className="font-semibold text-slate-900">
                      {opp.estimated_cost > 0 ? formatCurrency(opp.estimated_cost) : '—'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showStatusModal && (
        <ChangeStatusModal
          opportunityId={opp.id}
          currentStatus={opp.status}
          onClose={() => setShowStatusModal(false)}
          onSuccess={newStatus => {
            setOpp(p => p ? { ...p, status: newStatus } : p)
            load()
            loadTimeline()
          }}
        />
      )}

      {showEditModal && (
        <CreateOpportunityModal
          onClose={() => { setShowEditModal(false); load() }}
          editId={opp.id}
        />
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowDeleteConfirm(false)} />
          <div className="relative w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl">
            <h3 className="font-semibold text-slate-900">Delete Opportunity?</h3>
            <p className="mt-2 text-sm text-slate-600">
              Delete <span className="font-mono font-medium">{opp.opportunity_number}</span>? This can be recovered by an admin.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleting && <Loader2 size={14} className="animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="shrink-0 text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-800 truncate">{value}</span>
    </div>
  )
}
