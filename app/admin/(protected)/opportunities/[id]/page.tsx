'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronDown, Edit2, ExternalLink, Loader2, Mail, Phone, PlusCircle } from 'lucide-react'
import StatusPill from '@/components/ui/StatusPill'
import { MOVE_SIZE_LABELS } from '@/lib/constants'
import type { OppStatus } from '@/lib/constants'
import { formatCurrency } from '@/lib/format'
import { formatQuoteNumber } from '@/lib/opportunityDisplay'

const SERVICE_TYPE_LABELS: Record<string, string> = {
  local: 'Moving',
  long_distance: 'Moving',
  commercial: 'Moving',
  packing: 'Packing',
  storage: 'Storage',
  international: 'Moving',
}

interface AuditEntry {
  id: string
  action: string
  created_at: string
  user: { full_name: string } | null
}

interface OppProfile {
  id: string
  opportunity_number: string
  status: OppStatus
  service_type: string
  service_date: string | null
  move_size: string | null
  total_amount: number
  estimated_cost: number
  origin_address_line1: string | null
  origin_address_line2: string | null
  origin_city: string | null
  origin_province: string | null
  origin_postal_code: string | null
  dest_address_line1: string | null
  dest_address_line2: string | null
  dest_city: string | null
  dest_province: string | null
  dest_postal_code: string | null
  created_at: string
  customer: {
    id: string
    full_name: string
    email: string | null
    phone: string | null
    phone_type: string | null
    secondary_phone: string | null
  } | null
  agent: { id: string; full_name: string; email: string } | null
  lead_source: { id: string; name: string } | null
  audit_log: AuditEntry[]
}

function formatDate(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-CA', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatShortDate(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-CA', { month: 'numeric', day: 'numeric', year: 'numeric' })
}

function formatPhone(value: string | null | undefined) {
  if (!value) return null
  const digits = value.replace(/\D/g, '')
  if (digits.length !== 10) return value
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

function compactAddress(parts: Array<string | null | undefined>) {
  return parts.filter(Boolean).join(', ') || '—'
}

function ActivityText({ entry }: { entry: AuditEntry }) {
  const actor = entry.user?.full_name ?? 'System'
  const date = new Date(entry.created_at).toLocaleString('en-CA', {
    month: 'numeric',
    day: 'numeric',
    year: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
  })

  return (
    <div className="space-y-0.5">
      <p className="text-sm text-slate-700">
        {entry.action === 'create' ? 'Opportunity created.' : `Opportunity ${entry.action.replace(/_/g, ' ')}.`}
      </p>
      <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">{actor}</p>
      <p className="text-xs text-slate-500">{date}</p>
    </div>
  )
}

export default function OpportunityProfilePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [opp, setOpp] = useState<OppProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/opportunities/${id}`)
      if (!res.ok) {
        setError('Opportunity profile not found')
        return
      }
      setOpp(await res.json())
    } catch {
      setError('Failed to load opportunity profile')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-kratos" />
      </div>
    )
  }

  if (error || !opp) {
    return (
      <div className="py-12">
        <p className="text-sm text-red-500">{error ?? 'Opportunity profile not found'}</p>
        <Link href="/admin/opportunities" className="mt-4 inline-block text-sm text-kratos hover:underline">
          Back to opportunity profiles
        </Link>
      </div>
    )
  }

  const customerName = opp.customer?.full_name ?? 'Unnamed customer'
  const phone = formatPhone(opp.customer?.phone)
  const originAddress = compactAddress([
    opp.origin_address_line1,
    opp.origin_address_line2,
    opp.origin_city,
    opp.origin_province,
    opp.origin_postal_code,
  ])
  const destinationAddress = compactAddress([
    opp.dest_address_line1,
    opp.dest_address_line2,
    opp.dest_city,
    opp.dest_province,
    opp.dest_postal_code,
  ])
  const moveSize = opp.move_size ? (MOVE_SIZE_LABELS[opp.move_size] ?? opp.move_size.replace(/_/g, ' ')) : '—'
  const serviceLabel = SERVICE_TYPE_LABELS[opp.service_type] ?? opp.service_type
  const balance = opp.total_amount ?? 0

  return (
    <div className="space-y-6">
      <header className="border-b border-slate-200 pb-7">
        <button
          onClick={() => router.push('/admin/opportunities')}
          className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-blue-600 hover:underline"
        >
          ‹ Back to Opportunity Profiles
        </button>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-normal tracking-tight text-slate-900">{customerName}</h1>
              <button className="rounded p-1 text-blue-600 hover:bg-blue-50" aria-label="Edit profile">
                <Edit2 size={17} />
              </button>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600">
              {phone && (
                <span className="inline-flex items-center gap-1.5">
                  <Phone size={14} className="text-slate-400" />
                  {opp.customer?.phone_type ? `${opp.customer.phone_type[0].toUpperCase()}${opp.customer.phone_type.slice(1)}` : 'Phone'}
                  <a href={`tel:${opp.customer?.phone}`} className="text-blue-600 hover:underline">{phone}</a>
                </span>
              )}
              {opp.customer?.email && (
                <a href={`mailto:${opp.customer.email}`} className="inline-flex items-center gap-1.5 text-blue-600 hover:underline">
                  <Mail size={14} />
                  {opp.customer.email}
                </a>
              )}
            </div>
          </div>
          <button className="inline-flex items-center gap-2 rounded-md bg-kratos px-4 py-2 text-sm font-semibold text-slate-900 hover:opacity-90">
            <PlusCircle size={16} />
            Add Quote
          </button>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Outstanding Balance</p>
          <p className="mt-3 text-lg font-semibold text-green-600">{formatCurrency(balance)}</p>
        </div>
        <div className="border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Origin Address</p>
          <p className="mt-3 text-sm font-semibold text-slate-900">{originAddress}</p>
        </div>
        <div className="border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Upcoming Move</p>
          <p className="mt-3 text-sm font-semibold text-slate-900">{formatDate(opp.service_date)}</p>
        </div>
        <div className="border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Lead Source</p>
          <p className="mt-3 text-sm font-semibold text-slate-900">{opp.lead_source?.name ?? 'Unknown'}</p>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
        <aside className="space-y-4">
          <section className="border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-normal text-slate-900">Contacts</h2>
            <div className="mt-6 space-y-2 text-sm text-slate-600">
              {phone ? <p>{phone}</p> : <p>No customer contacts.</p>}
              {opp.customer?.email && <p>{opp.customer.email}</p>}
            </div>
            <h2 className="mt-8 text-lg font-normal text-slate-900">Opportunity Contacts</h2>
            <p className="mt-6 text-sm text-slate-600">No opportunity contacts.</p>
          </section>

          <section className="border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-normal text-slate-900">Recent Activity</h2>
            <div className="mt-6 space-y-5">
              {opp.audit_log.length > 0 ? (
                opp.audit_log.slice(0, 5).map(entry => <ActivityText key={entry.id} entry={entry} />)
              ) : (
                <p className="text-sm text-slate-600">No recent activity.</p>
              )}
            </div>
          </section>
        </aside>

        <main className="space-y-4">
          <section className="border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-normal text-slate-900">Opportunities</h2>
              <ChevronDown size={18} className="text-slate-600" />
            </div>
            <div className="overflow-x-auto p-5">
              <table className="w-full min-w-[880px] border border-slate-200">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left">
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-600">Quote Number</th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-600">Status</th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-600">Service Date</th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-600">Type</th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-600">Move Size</th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-600">Estimate Amount</th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-600">Invoice Amount</th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-600">Total Payments</th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-600">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="text-sm">
                    <td className="px-4 py-4">
                      <Link href={`/admin/opportunities/${opp.id}/quote`} className="inline-flex items-center gap-1 text-blue-600 hover:underline">
                        {formatQuoteNumber(opp.opportunity_number)}
                        <ExternalLink size={13} />
                      </Link>
                    </td>
                    <td className="px-4 py-4"><StatusPill status={opp.status} /></td>
                    <td className="px-4 py-4 text-slate-700">{formatShortDate(opp.service_date)}</td>
                    <td className="px-4 py-4 text-slate-700">{serviceLabel}</td>
                    <td className="px-4 py-4 text-slate-700">{moveSize}</td>
                    <td className="px-4 py-4 text-slate-700">{formatCurrency(opp.estimated_cost ?? 0)}</td>
                    <td className="px-4 py-4 text-slate-700">$0.00</td>
                    <td className="px-4 py-4 text-slate-700">$0.00</td>
                    <td className="px-4 py-4 text-slate-700">{formatCurrency(balance)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-normal text-slate-900">Storage Accounts</h2>
              <ChevronDown size={18} className="text-slate-600" />
            </div>
            <div className="m-5 flex min-h-28 items-center justify-center bg-slate-50 text-center text-sm text-slate-500">
              There are no storage accounts<br />for this customer
            </div>
          </section>

          <section className="border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-normal text-slate-900">Customer Support</h2>
              <ChevronDown size={18} className="text-slate-600" />
            </div>
            <div className="m-5 flex min-h-28 items-center justify-center bg-slate-50 text-center text-sm text-slate-500">
              There are no customer<br />support requests
            </div>
          </section>

          <section className="border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Destination</p>
            <p className="mt-3 text-sm font-semibold text-slate-900">{destinationAddress}</p>
          </section>
        </main>
      </div>
    </div>
  )
}
