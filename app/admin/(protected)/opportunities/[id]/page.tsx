'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ChevronRight, Edit2, RefreshCw, Trash2, Check, X, Loader2,
  MapPin, Home, Phone, Mail, User, Calendar, Package, DollarSign,
  FileText, Clock,
} from 'lucide-react'
import { toast } from 'sonner'
import StatusPill from '@/components/ui/StatusPill'
import ChangeStatusModal from '@/components/admin/modals/ChangeStatusModal'
import CreateOpportunityModal from '@/components/admin/modals/CreateOpportunityModal'
import { OPP_STATUSES } from '@/lib/constants'
import type { OppStatus } from '@/lib/constants'
import { formatCurrency } from '@/lib/format'
import { cn } from '@/lib/utils'

const SERVICE_TYPE_LABELS: Record<string, string> = {
  local: 'Local', long_distance: 'Long Distance', commercial: 'Commercial',
  packing: 'Packing', storage: 'Storage', international: 'International',
}

function formatDate(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' })
}
function formatDatetime(d: string) {
  return new Date(d).toLocaleString('en-CA', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

interface AuditEntry {
  id: string; action: string; diff: Record<string, unknown> | null; created_at: string
  user: { full_name: string } | null
}

interface OppDetail {
  id: string; opportunity_number: string; status: OppStatus
  service_type: string; service_date: string | null; move_size: string | null
  total_amount: number; estimated_cost: number; notes: string | null
  origin_address_1: string | null; origin_address_2: string | null
  origin_city: string | null; origin_province: string | null
  origin_postal_code: string | null; origin_dwelling_type: string | null
  origin_floor: number | null; origin_has_elevator: boolean | null
  origin_stairs: number | null; origin_long_carry: boolean | null
  origin_parking_notes: string | null
  dest_address_1: string | null; dest_address_2: string | null
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

function AddressBlock({ prefix, data }: { prefix: 'origin' | 'dest'; data: OppDetail }) {
  const p = prefix
  const addr1    = data[`${p}_address_1`]
  const addr2    = data[`${p}_address_2`]
  const city     = data[`${p}_city`]
  const prov     = data[`${p}_province`]
  const postal   = data[`${p}_postal_code`]
  const dwelling = data[`${p}_dwelling_type`]
  const floor    = data[`${p}_floor`]
  const elevator = data[`${p}_has_elevator`]
  const stairs   = data[`${p}_stairs`]
  const longCarry= data[`${p}_long_carry`]
  const parking  = data[`${p}_parking_notes`]

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
      {parking && <p className="text-xs text-slate-500 italic mt-1">{parking}</p>}
    </div>
  )
}

export default function OpportunityDetailPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()

  const [opp, setOpp] = useState<OppDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [notesSaving, setNotesSaving] = useState(false)
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

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

  useEffect(() => { load() }, [load])

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

  if (loading) return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 w-64 rounded bg-slate-200" />
      <div className="h-48 rounded-xl bg-slate-200" />
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
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-slate-900">{opp.customer?.full_name ?? 'Unknown Customer'}</h1>
              <StatusPill status={opp.status} />
            </div>
            <p className="mt-0.5 font-mono text-sm text-slate-500">{opp.opportunity_number}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowEditModal(true)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              <Edit2 size={14} /> Edit
            </button>
            <button onClick={() => setShowStatusModal(true)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              <RefreshCw size={14} /> Change Status
            </button>
            <button onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50">
              <Trash2 size={14} /> Delete
            </button>
          </div>
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Left: details */}
          <div className="space-y-4 lg:col-span-2">
            {/* Move Details */}
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-slate-400">Move Details</h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Detail label="Service Type" value={SERVICE_TYPE_LABELS[opp.service_type] ?? opp.service_type} icon={Package} />
                <Detail label="Move Date"    value={formatDate(opp.service_date) === '—' ? 'TBD' : formatDate(opp.service_date)} icon={Calendar} />
                <Detail label="Move Size"    value={opp.move_size?.replace(/_/g,' ') ?? '—'} icon={Home} />
                <Detail label="Total Amount" value={opp.total_amount > 0 ? formatCurrency(opp.total_amount) : '—'} icon={DollarSign} />
                <Detail label="Estimated Cost" value={opp.estimated_cost > 0 ? formatCurrency(opp.estimated_cost) : '—'} icon={DollarSign} />
                <Detail
                  label="Profit"
                  value={opp.total_amount > 0 ? formatCurrency(profit) : '—'}
                  icon={DollarSign}
                  valueClass={profit < 0 ? 'text-red-600' : 'text-emerald-600'}
                />
                <Detail label="Source" value={opp.lead_source?.name ?? '—'} icon={User} />
              </div>
            </div>

            {/* Origin */}
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-slate-400">
                <MapPin size={14} /> Origin / Pickup
              </h2>
              <AddressBlock prefix="origin" data={opp} />
            </div>

            {/* Destination */}
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-slate-400">
                <MapPin size={14} /> Destination / Dropoff
              </h2>
              <AddressBlock prefix="dest" data={opp} />
            </div>

            {/* Notes */}
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-slate-400">Notes</h2>
              <textarea
                rows={4}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                onBlur={saveNotes}
                placeholder="Add internal notes…"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-kratos focus:bg-white focus:ring-2 focus:ring-kratos/20 resize-none"
              />
              {notesSaving && <p className="mt-1 text-xs text-slate-400">Saving…</p>}
            </div>

            {/* Status History */}
            {opp.audit_log.length > 0 && (
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-slate-400">Status History</h2>
                <div className="space-y-3">
                  {opp.audit_log.filter(e => e.action === 'status_change' || e.action === 'create').map(entry => (
                    <div key={entry.id} className="flex gap-3">
                      <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-kratos" />
                      <div>
                        <p className="text-sm text-slate-700">
                          {entry.action === 'create'
                            ? 'Opportunity created'
                            : `Status changed ${entry.diff?.from ? `from ${OPP_STATUSES.find(s => s.value === entry.diff?.from)?.label ?? entry.diff.from}` : ''} to ${OPP_STATUSES.find(s => s.value === entry.diff?.to)?.label ?? entry.diff?.to}`
                          }
                          {!!entry.diff?.reason && <span className="text-slate-500"> — {String(entry.diff.reason)}</span>}
                        </p>
                        <p className="text-xs text-slate-400">
                          {entry.user?.full_name ?? 'Unknown'} · {formatDatetime(entry.created_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right sidebar */}
          <div className="space-y-4">
            {/* Customer card */}
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-slate-400">Customer</h2>
              {opp.customer ? (
                <div className="space-y-2">
                  <Link href={`/admin/customers/${opp.customer.id}`}
                    className="block font-semibold text-slate-900 hover:text-kratos">
                    {opp.customer.full_name}
                  </Link>
                  {opp.customer.phone && (
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Phone size={13} className="text-slate-400" />
                      {opp.customer.phone}
                      {opp.customer.phone_type && <span className="capitalize text-xs text-slate-400">({opp.customer.phone_type})</span>}
                    </div>
                  )}
                  {opp.customer.secondary_phone && (
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Phone size={13} className="text-slate-400" />
                      {opp.customer.secondary_phone}
                    </div>
                  )}
                  {opp.customer.email && (
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Mail size={13} className="text-slate-400" />
                      {opp.customer.email}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-400">No customer linked</p>
              )}
            </div>

            {/* Agent card */}
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-slate-400">Sales Agent</h2>
              {opp.agent ? (
                <div className="space-y-1">
                  <p className="font-semibold text-slate-900">{opp.agent.full_name}</p>
                  <p className="text-sm text-slate-500 capitalize">{opp.agent.email}</p>
                </div>
              ) : (
                <p className="text-sm text-slate-400">Unassigned</p>
              )}
            </div>

            {/* Timeline */}
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-slate-400">Timeline</h2>
              <div className="space-y-1.5 text-sm text-slate-600">
                <p className="flex items-center gap-2">
                  <Clock size={13} className="text-slate-400" />
                  Created {formatDate(opp.created_at)}
                </p>
                <p className="flex items-center gap-2">
                  <Clock size={13} className="text-slate-400" />
                  Updated {formatDate(opp.updated_at)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showStatusModal && (
        <ChangeStatusModal
          opportunityId={opp.id}
          currentStatus={opp.status}
          onClose={() => setShowStatusModal(false)}
          onSuccess={newStatus => { setOpp(p => p ? { ...p, status: newStatus } : p); load() }}
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
              <button onClick={() => setShowDeleteConfirm(false)}
                className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">Cancel</button>
              <button onClick={handleDelete} disabled={deleting}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
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

function Detail({ label, value, icon: Icon, valueClass }: {
  label: string; value: string; icon: React.ElementType; valueClass?: string
}) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-widest text-slate-400">
        <Icon size={12} /> {label}
      </p>
      <p className={cn('mt-1 text-sm font-medium text-slate-800', valueClass)}>{value}</p>
    </div>
  )
}
