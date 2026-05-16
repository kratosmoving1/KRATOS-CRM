'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ChevronRight, Phone, Mail, Calendar, Plus,
  TrendingUp, Package, CheckCircle, XCircle,
} from 'lucide-react'
import StatusPill from '@/components/ui/StatusPill'
import RingCentralCallButton from '@/components/ui/RingCentralCallButton'
import { formatCurrency } from '@/lib/format'
import { COMPANY_DIVISION_LABELS } from '@/lib/constants'
import { formatQuoteNumber } from '@/lib/opportunityDisplay'

interface Opp {
  id: string; opportunity_number: string; status: string
  service_type: string; service_date: string | null; total_amount: number; company_division: string | null
  created_at: string
  agent: { full_name: string } | null
  lead_source: { name: string } | null
}

interface Customer {
  id: string; full_name: string; email: string | null
  phone: string | null; phone_type: string | null
  secondary_phone: string | null; secondary_phone_type: string | null
  created_at: string; opportunities: Opp[]
}

const SERVICE_LABELS: Record<string, string> = {
  local: 'Local', long_distance: 'Long Distance', commercial: 'Commercial',
  packing: 'Packing', storage: 'Storage', international: 'International',
}

function formatDate(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })
}

function StatCard({
  label, value, sub, accent, alert,
}: {
  label: string; value: string | number; sub?: string; accent?: boolean; alert?: boolean
}) {
  const valueClass = accent
    ? 'text-emerald-600'
    : alert
    ? 'text-red-500'
    : 'text-slate-900'
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-5 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">{label}</p>
      <p className={`mt-1.5 text-2xl font-bold ${valueClass}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
    </div>
  )
}

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/customers/${id}`)
      if (!res.ok) { setError('Customer not found'); return }
      setCustomer(await res.json())
    } catch { setError('Failed to load') }
    finally { setLoading(false) }
  }, [id])

  useEffect(() => { load() }, [load])

  if (loading) return (
    <div className="space-y-4 animate-pulse">
      <div className="h-6 w-40 rounded bg-slate-200" />
      <div className="h-20 rounded-xl bg-slate-200" />
      <div className="grid grid-cols-4 gap-3">
        {[0,1,2,3].map(i => <div key={i} className="h-20 rounded-xl bg-slate-200" />)}
      </div>
      <div className="h-64 rounded-xl bg-slate-200" />
    </div>
  )

  if (error || !customer) return (
    <div className="py-32 text-center">
      <p className="text-sm text-slate-500">{error ?? 'Not found'}</p>
      <Link href="/admin/customers" className="mt-4 block text-sm text-kratos hover:underline">← Back</Link>
    </div>
  )

  const opps = customer.opportunities ?? []
  const completedOpps = opps.filter(o => o.status === 'completed')
  const bookedOpps    = opps.filter(o => o.status === 'booked')
  const cancelledCount = opps.filter(o => o.status === 'cancelled').length
  const totalRevenue  = opps
    .filter(o => ['booked', 'completed'].includes(o.status))
    .reduce((s, o) => s + o.total_amount, 0)
  const mostRecentOpp = opps[0] ?? null

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-slate-500">
        <Link href="/admin/customers" className="hover:text-slate-800">Customers</Link>
        <ChevronRight size={14} />
        <span className="font-medium text-slate-700">{customer.full_name}</span>
      </nav>

      {/* Header strip */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{customer.full_name}</h1>
            {mostRecentOpp && <StatusPill status={mostRecentOpp.status} />}
          </div>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
            <Calendar size={13} />
            Customer since {formatDate(customer.created_at)}
          </p>
        </div>
        <button className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          <Plus size={14} /> Add Follow-up
        </button>
      </div>

      {/* 4 stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total Quotes" value={opps.length} />
        <StatCard
          label="Revenue"
          value={totalRevenue > 0 ? formatCurrency(totalRevenue) : '$0'}
          accent
        />
        <StatCard
          label="Completed"
          value={completedOpps.length}
          sub={bookedOpps.length > 0 ? `${bookedOpps.length} booked` : undefined}
        />
        <StatCard
          label="Cancelled"
          value={cancelledCount}
          alert={cancelledCount > 0}
        />
      </div>

      {/* Two-column body */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* LEFT: contact info */}
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-slate-400">Contact Info</h2>
            <div className="space-y-3 text-sm">
              {customer.phone ? (
                <div className="flex items-center gap-3">
                  <Phone size={15} className="shrink-0 text-slate-400" />
                  <div>
                    <RingCentralCallButton
                      phoneNumber={customer.phone}
                      label={customer.phone}
                      customerId={customer.id}
                      opportunityId={mostRecentOpp?.id ?? null}
                      className="font-medium text-slate-800 hover:text-kratos"
                    />
                    {customer.phone_type && (
                      <span className="ml-2 capitalize rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                        {customer.phone_type}
                      </span>
                    )}
                  </div>
                </div>
              ) : null}
              {customer.secondary_phone ? (
                <div className="flex items-center gap-3">
                  <Phone size={15} className="shrink-0 text-slate-400" />
                  <div>
                    <RingCentralCallButton
                      phoneNumber={customer.secondary_phone}
                      label={customer.secondary_phone}
                      customerId={customer.id}
                      opportunityId={mostRecentOpp?.id ?? null}
                      className="font-medium text-slate-800 hover:text-kratos"
                    />
                    {customer.secondary_phone_type && (
                      <span className="ml-2 capitalize rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                        {customer.secondary_phone_type}
                      </span>
                    )}
                  </div>
                </div>
              ) : null}
              {customer.email ? (
                <div className="flex items-center gap-3">
                  <Mail size={15} className="shrink-0 text-slate-400" />
                  <a href={`mailto:${customer.email}`} className="font-medium text-slate-800 hover:text-kratos break-all">
                    {customer.email}
                  </a>
                </div>
              ) : null}
              {!customer.phone && !customer.email && (
                <p className="text-slate-400">No contact info on file</p>
              )}
            </div>
          </div>

          {mostRecentOpp?.lead_source && (
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-slate-400">Lead Source</h2>
              <p className="text-sm font-medium text-slate-700">{mostRecentOpp.lead_source.name}</p>
            </div>
          )}
        </div>

        {/* RIGHT: quotes table */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
              <h2 className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                Quotes
                <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-slate-500">{opps.length}</span>
              </h2>
              <button
                onClick={() => router.push('/admin/opportunities')}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                <Plus size={12} /> New Quote
              </button>
            </div>
            {opps.length === 0 ? (
              <div className="py-16 text-center">
                <Package size={32} className="mx-auto mb-3 text-slate-200" />
                <p className="text-sm text-slate-400">No quotes yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-400">Status</th>
                      <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-400">Quote #</th>
                      <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-400">KGC</th>
                      <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-400">Service</th>
                      <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-400">Service Date</th>
                      <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-widest text-slate-400">Amount</th>
                      <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-400">Agent</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {opps.map(opp => (
                      <tr
                        key={opp.id}
                        onClick={() => router.push(`/admin/opportunities/${opp.id}`)}
                        className="cursor-pointer transition-colors hover:bg-slate-50"
                      >
                        <td className="px-4 py-3"><StatusPill status={opp.status} /></td>
                        <td className="px-4 py-3 font-mono text-xs font-medium text-slate-600">{formatQuoteNumber(opp.opportunity_number)}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">{COMPANY_DIVISION_LABELS[opp.company_division ?? 'kratos_moving'] ?? 'Kratos Moving'}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">{SERVICE_LABELS[opp.service_type] ?? opp.service_type}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{formatDate(opp.service_date)}</td>
                        <td className="px-4 py-3 text-right text-sm font-medium text-slate-800">
                          {opp.total_amount > 0 ? formatCurrency(opp.total_amount) : '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">{opp.agent?.full_name ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
