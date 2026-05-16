'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Plus, ChevronLeft, ChevronRight, ArrowUpDown } from 'lucide-react'
import { useCreateModal } from '@/contexts/CreationModalsContext'
import StatusPill from '@/components/ui/StatusPill'
import { COMPANY_DIVISION_LABELS, OPP_STATUSES } from '@/lib/constants'
import { formatCurrency } from '@/lib/format'
import { formatQuoteNumber } from '@/lib/opportunityDisplay'
import { cn } from '@/lib/utils'

interface Agent { id: string; full_name: string }
interface Opp {
  id: string
  opportunity_number: string
  status: string
  service_type: string
  company_division: string | null
  service_date: string | null
  total_amount: number
  customer: { id: string; full_name: string } | null
  agent: { id: string; full_name: string } | null
  lead_source: { id: string; name: string } | null
}

const SERVICE_TYPE_LABELS: Record<string, string> = {
  local: 'Moving',
  long_distance: 'Moving',
  commercial: 'Moving',
  packing: 'Packing',
  storage: 'Storage',
  international: 'Moving',
}

function formatDate(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function OpportunitiesPage() {
  const router = useRouter()
  const { openModal } = useCreateModal()

  const [opps, setOpps] = useState<Opp[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortBy, setSortBy] = useState('created_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [agents, setAgents] = useState<Agent[]>([])
  const [agentFilter, setAgentFilter] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    fetch('/api/admin/profiles').then(r => r.json()).then(setAgents).catch(() => {})
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        sort_by: sortBy,
        sort_dir: sortDir,
        ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
        ...(agentFilter ? { agent_id: agentFilter } : {}),
      })
      const res = await fetch(`/api/admin/opportunities?${params}`)
      const json = await res.json()
      setOpps(json.data ?? [])
      setCount(json.count ?? 0)
    } finally {
      setLoading(false)
    }
  }, [page, sortBy, sortDir, statusFilter, debouncedSearch, agentFilter])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [statusFilter, debouncedSearch, agentFilter])

  function toggleSort(col: string) {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortDir('desc') }
  }

  const totalPages = Math.ceil(count / 25)

  const SortBtn = ({ col, label }: { col: string; label: string }) => (
    <button
      onClick={() => toggleSort(col)}
      className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600 hover:text-slate-900"
    >
      {label}
      <ArrowUpDown size={11} className={sortBy === col ? 'text-kratos' : 'text-slate-400'} />
    </button>
  )

  return (
    <div className="space-y-5">
      <div className="border-b border-slate-200 pb-6">
        <div className="flex items-end justify-between gap-4">
          <div className="flex items-baseline gap-3">
            <h1 className="text-2xl font-normal tracking-tight text-slate-900">Quotes</h1>
            <span className="text-xs font-semibold uppercase text-slate-500">
              {loading ? '...' : `${count.toLocaleString()} total`}
            </span>
          </div>
          <button
            onClick={() => openModal('opportunity')}
            className="flex items-center gap-2 rounded-md bg-kratos px-4 py-2 text-sm font-semibold text-slate-900 hover:opacity-90"
          >
            <Plus size={16} /> New Quote
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[180px_1fr]">
        <aside className="space-y-1 pt-12 text-sm">
          {[
            ['all', 'Quotes'],
            ['opportunity', 'Open Quotes'],
            ['booked', 'Booked'],
            ['completed', 'Completed'],
            ['cancelled', 'Cancelled'],
          ].map(([value, label]) => (
            <button
              key={value}
              onClick={() => setStatusFilter(value)}
              className={cn(
                'block w-full px-3 py-2 text-left transition-colors',
                statusFilter === value ? 'bg-slate-100 font-semibold text-slate-900' : 'text-slate-600 hover:bg-slate-50',
              )}
            >
              {label}
            </button>
          ))}
        </aside>

        <section className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="rounded-md border-0 bg-transparent px-1 py-2 text-sm text-blue-600 outline-none"
            >
              <option value="all">Any Status</option>
              {OPP_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search quotes or customers..."
                  className="h-10 w-72 rounded-none border border-slate-300 bg-white pl-3 pr-9 text-sm outline-none focus:border-blue-500"
                />
              </div>
              <select
                value={agentFilter}
                onChange={e => setAgentFilter(e.target.value)}
                className="h-10 rounded-none border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-500"
              >
                <option value="">All agents</option>
                {agents.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
              </select>
            </div>
          </div>

          <div className="overflow-hidden border border-slate-200 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1180px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="w-12 px-4 py-3 text-left">
                      <input type="checkbox" className="h-4 w-4 rounded border-slate-300" aria-label="Select all" />
                    </th>
                    <th className="px-4 py-3 text-left"><span className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Quote #</span></th>
                    <th className="px-4 py-3 text-left"><span className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Customer</span></th>
                    <th className="px-4 py-3 text-left"><span className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">KGC</span></th>
                    <th className="px-4 py-3 text-left"><SortBtn col="service_type" label="Service" /></th>
                    <th className="px-4 py-3 text-left"><SortBtn col="service_date" label="Date" /></th>
                    <th className="px-4 py-3 text-left"><SortBtn col="status" label="Status" /></th>
                    <th className="px-4 py-3 text-left"><SortBtn col="total_amount" label="Amount" /></th>
                    <th className="px-4 py-3 text-left"><span className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Source</span></th>
                    <th className="px-4 py-3 text-left"><span className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Latest Assigned To</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    Array.from({ length: 9 }).map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        {Array.from({ length: 9 }).map((__, j) => (
                          <td key={j} className="px-4 py-4">
                            <div className="h-4 rounded bg-slate-100" style={{ width: `${50 + (j * 9) % 35}%` }} />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : opps.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-16 text-center text-sm text-slate-500">No quotes found</td>
                    </tr>
                  ) : (
                    opps.map(opp => (
                      <tr
                        key={opp.id}
                        onClick={() => router.push(`/admin/opportunities/${opp.id}`)}
                        className="cursor-pointer text-sm transition-colors hover:bg-slate-50"
                      >
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          <input type="checkbox" className="h-4 w-4 rounded border-slate-300" aria-label={`Select ${opp.customer?.full_name ?? 'quote'}`} />
                        </td>
                        <td className="px-4 py-3 font-mono text-xs font-medium text-slate-700">{formatQuoteNumber(opp.opportunity_number)}</td>
                        <td className="px-4 py-3 font-medium text-blue-600">{opp.customer?.full_name ?? '—'}</td>
                        <td className="px-4 py-3 text-slate-700">{COMPANY_DIVISION_LABELS[opp.company_division ?? 'kratos_moving'] ?? 'Kratos Moving'}</td>
                        <td className="px-4 py-3 text-slate-700">{SERVICE_TYPE_LABELS[opp.service_type] ?? opp.service_type}</td>
                        <td className="px-4 py-3 text-slate-700">{formatDate(opp.service_date)}</td>
                        <td className="px-4 py-3"><StatusPill status={opp.status} /></td>
                        <td className="px-4 py-3 text-slate-700">{formatCurrency(opp.total_amount ?? 0)}</td>
                        <td className="px-4 py-3 text-slate-700">{opp.lead_source?.name ?? 'Unknown'}</td>
                        <td className="px-4 py-3 text-slate-700">{opp.agent?.full_name ?? '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="border border-slate-200 px-3 py-1.5 text-sm text-slate-600 disabled:opacity-40">
                « Previous
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pg = Math.max(1, Math.min(page - 2, totalPages - 4)) + i
                return (
                  <button key={pg} onClick={() => setPage(pg)}
                    className={cn('border border-slate-200 px-3 py-1.5 text-sm',
                      pg === page ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50')}>
                    {pg}
                  </button>
                )
              })}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="border border-slate-200 px-3 py-1.5 text-sm text-slate-600 disabled:opacity-40">
                Next »
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
