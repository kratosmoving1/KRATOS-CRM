'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight, Phone, Mail, User, Calendar } from 'lucide-react'
import StatusPill from '@/components/ui/StatusPill'
import { formatCurrency } from '@/lib/format'
import { cn } from '@/lib/utils'

interface Opp {
  id: string; opportunity_number: string; status: string
  service_type: string; service_date: string | null; total_amount: number
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

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'overview' | 'opportunities'>('overview')

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
      <div className="h-8 w-48 rounded bg-slate-200" />
      <div className="h-48 rounded-xl bg-slate-200" />
    </div>
  )

  if (error || !customer) return (
    <div className="py-32 text-center">
      <p className="text-sm text-slate-500">{error ?? 'Not found'}</p>
      <Link href="/admin/customers" className="mt-4 block text-sm text-kratos hover:underline">← Back</Link>
    </div>
  )

  const opps = customer.opportunities ?? []
  const totalRevenue = opps.filter(o => ['booked','completed'].includes(o.status)).reduce((s, o) => s + o.total_amount, 0)

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-slate-500">
        <Link href="/admin/customers" className="hover:text-slate-800">Customers</Link>
        <ChevronRight size={14} />
        <span className="font-medium text-slate-700">{customer.full_name}</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{customer.full_name}</h1>
          <div className="mt-1 flex flex-wrap gap-4 text-sm text-slate-500">
            {customer.phone && (
              <span className="flex items-center gap-1.5">
                <Phone size={13} /> {customer.phone}
                {customer.phone_type && <span className="capitalize text-xs">({customer.phone_type})</span>}
              </span>
            )}
            {customer.email && (
              <span className="flex items-center gap-1.5">
                <Mail size={13} /> {customer.email}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {(['overview', 'opportunities'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('px-4 py-2.5 text-sm font-medium capitalize transition-colors',
              tab === t ? 'border-b-2 border-kratos text-slate-900' : 'text-slate-500 hover:text-slate-700')}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            {/* Contact info */}
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-slate-400">Contact Info</h2>
              <div className="space-y-3 text-sm">
                {customer.phone && (
                  <div className="flex items-center gap-3">
                    <Phone size={16} className="text-slate-400 shrink-0" />
                    <span className="text-slate-700">{customer.phone}</span>
                    {customer.phone_type && <span className="capitalize rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{customer.phone_type}</span>}
                  </div>
                )}
                {customer.secondary_phone && (
                  <div className="flex items-center gap-3">
                    <Phone size={16} className="text-slate-400 shrink-0" />
                    <span className="text-slate-700">{customer.secondary_phone}</span>
                    {customer.secondary_phone_type && <span className="capitalize rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{customer.secondary_phone_type}</span>}
                  </div>
                )}
                {customer.email && (
                  <div className="flex items-center gap-3">
                    <Mail size={16} className="text-slate-400 shrink-0" />
                    <a href={`mailto:${customer.email}`} className="text-slate-700 hover:text-kratos">{customer.email}</a>
                  </div>
                )}
                {!customer.phone && !customer.email && (
                  <p className="text-slate-400">No contact info</p>
                )}
              </div>
            </div>

            {/* Recent opportunities */}
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400">Recent Opportunities</h2>
                {opps.length > 5 && (
                  <button onClick={() => setTab('opportunities')} className="text-xs text-kratos hover:underline">View all {opps.length}</button>
                )}
              </div>
              {opps.length === 0 ? (
                <p className="text-sm text-slate-400">No opportunities yet</p>
              ) : (
                <div className="space-y-2">
                  {opps.slice(0, 5).map(opp => (
                    <div key={opp.id} onClick={() => router.push(`/admin/opportunities/${opp.id}`)}
                      className="flex cursor-pointer items-center justify-between rounded-lg border border-slate-100 p-3 hover:bg-slate-50">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-slate-500">{opp.opportunity_number}</span>
                          <StatusPill status={opp.status} />
                        </div>
                        <p className="mt-0.5 text-sm text-slate-700">{SERVICE_LABELS[opp.service_type] ?? opp.service_type} · {formatDate(opp.service_date)}</p>
                      </div>
                      <span className="text-sm font-medium text-slate-800">{opp.total_amount > 0 ? formatCurrency(opp.total_amount) : '—'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Stats sidebar */}
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-slate-400">Stats</h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Opportunities</span>
                  <span className="font-semibold text-slate-900">{opps.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Revenue</span>
                  <span className="font-semibold text-emerald-600">{totalRevenue > 0 ? formatCurrency(totalRevenue) : '$0'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Customer Since</span>
                  <span className="text-slate-700">{formatDate(customer.created_at)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'opportunities' && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-slate-500">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-slate-500">Opp #</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-slate-500">Service</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-slate-500">Move Date</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-widest text-slate-500">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-slate-500">Agent</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-slate-500">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {opps.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-400">No opportunities</td></tr>
                ) : opps.map(opp => (
                  <tr key={opp.id} onClick={() => router.push(`/admin/opportunities/${opp.id}`)}
                    className="cursor-pointer hover:bg-slate-50">
                    <td className="px-4 py-3"><StatusPill status={opp.status} /></td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{opp.opportunity_number}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{SERVICE_LABELS[opp.service_type] ?? opp.service_type}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{formatDate(opp.service_date)}</td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-slate-800">{opp.total_amount > 0 ? formatCurrency(opp.total_amount) : '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{opp.agent?.full_name ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">{formatDate(opp.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
