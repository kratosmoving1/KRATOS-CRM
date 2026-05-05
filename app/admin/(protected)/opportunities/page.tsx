'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Plus, ChevronLeft, ChevronRight, ArrowUpDown } from 'lucide-react'
import { useCreateModal } from '@/contexts/CreationModalsContext'
import StatusPill from '@/components/ui/StatusPill'
import { OPP_STATUSES } from '@/lib/constants'
import { formatCurrency } from '@/lib/format'
import { cn } from '@/lib/utils'

interface Agent   { id: string; full_name: string }
interface Opp {
  id: string; opportunity_number: string; status: string
  service_type: string; service_date: string | null; move_size: string | null
  total_amount: number; created_at: string
  customer: { id: string; full_name: string } | null
  agent: { id: string; full_name: string } | null
  lead_source: { id: string; name: string } | null
}

const SERVICE_TYPE_LABELS: Record<string, string> = {
  local: 'Local', long_distance: 'Long Distance', commercial: 'Commercial',
  packing: 'Packing', storage: 'Storage', international: 'International',
}

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function OpportunitiesPage() {
  const router = useRouter()
  const { openModal } = useCreateModal()

  const [opps, setOpps]       = useState<Opp[]>([])
  const [count, setCount]     = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage]       = useState(1)
  const [search, setSearch]   = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortBy, setSortBy]   = useState('created_at')
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('desc')
  const [agents, setAgents]   = useState<Agent[]>([])
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
        page: String(page), sort_by: sortBy, sort_dir: sortDir,
        ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
        ...(agentFilter ? { agent_id: agentFilter } : {}),
      })
      const res = await fetch(`/api/admin/opportunities?${params}`)
      const json = await res.json()
      setOpps(json.data ?? [])
      setCount(json.count ?? 0)
    } catch { } finally { setLoading(false) }
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
      className="flex items-center gap-1 text-xs font-semibold uppercase tracking-widest text-slate-500 hover:text-slate-800"
    >
      {label}
      <ArrowUpDown size={12} className={sortBy === col ? 'text-kratos' : ''} />
    </button>
  )

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Opportunities</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {loading ? '…' : `${count.toLocaleString()} total`}
          </p>
        </div>
        <button
          onClick={() => openModal('opportunity')}
          className="flex items-center gap-2 rounded-lg bg-kratos px-4 py-2 text-sm font-semibold text-slate-900 hover:opacity-90"
        >
          <Plus size={16} /> New Opportunity
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setStatusFilter('all')}
            className={cn('rounded-full px-3 py-1 text-xs font-semibold transition-colors',
              statusFilter === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>
            All
          </button>
          {OPP_STATUSES.map(s => (
            <button key={s.value} onClick={() => setStatusFilter(s.value)}
              className={cn('rounded-full px-3 py-1 text-xs font-semibold transition-colors',
                statusFilter === s.value ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>
              {s.label}
            </button>
          ))}
        </div>
        <div className="relative ml-auto">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
            className="w-52 rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-sm outline-none focus:border-kratos focus:ring-2 focus:ring-kratos/20" />
        </div>
        <select value={agentFilter} onChange={e => setAgentFilter(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 outline-none focus:border-kratos">
          <option value="">All agents</option>
          {agents.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-3 text-left"><SortBtn col="status" label="Status" /></th>
                <th className="px-4 py-3 text-left"><SortBtn col="opportunity_number" label="Opp #" /></th>
                <th className="px-4 py-3 text-left"><span className="text-xs font-semibold uppercase tracking-widest text-slate-500">Customer</span></th>
                <th className="px-4 py-3 text-left"><SortBtn col="service_type" label="Service" /></th>
                <th className="px-4 py-3 text-left"><SortBtn col="service_date" label="Move Date" /></th>
                <th className="px-4 py-3 text-left"><span className="text-xs font-semibold uppercase tracking-widest text-slate-500">Size</span></th>
                <th className="px-4 py-3 text-right"><SortBtn col="total_amount" label="Amount" /></th>
                <th className="px-4 py-3 text-left"><span className="text-xs font-semibold uppercase tracking-widest text-slate-500">Source</span></th>
                <th className="px-4 py-3 text-left"><span className="text-xs font-semibold uppercase tracking-widest text-slate-500">Agent</span></th>
                <th className="px-4 py-3 text-left"><SortBtn col="created_at" label="Created" /></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 10 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 rounded bg-slate-100" style={{ width: `${60 + (j * 7) % 40}%` }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : opps.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-16 text-center">
                    <p className="text-sm font-medium text-slate-500">No opportunities found</p>
                    <p className="mt-1 text-xs text-slate-400">Try adjusting your filters or create a new opportunity</p>
                    <button onClick={() => openModal('opportunity')}
                      className="mt-4 rounded-lg bg-kratos px-4 py-2 text-sm font-semibold text-slate-900 hover:opacity-90">
                      + Create Opportunity
                    </button>
                  </td>
                </tr>
              ) : (
                opps.map(opp => (
                  <tr key={opp.id} onClick={() => router.push(`/admin/opportunities/${opp.id}`)}
                    className="cursor-pointer transition-colors hover:bg-slate-50">
                    <td className="px-4 py-3"><StatusPill status={opp.status} /></td>
                    <td className="px-4 py-3 font-mono text-xs font-medium text-slate-700">{opp.opportunity_number}</td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{opp.customer?.full_name ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{SERVICE_TYPE_LABELS[opp.service_type] ?? opp.service_type}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{formatDate(opp.service_date)}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{opp.move_size?.replace(/_/g,' ') ?? '—'}</td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-slate-900">{opp.total_amount > 0 ? formatCurrency(opp.total_amount) : '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{opp.lead_source?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{opp.agent?.full_name ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">{formatDate(opp.created_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
            <p className="text-sm text-slate-500">Page {page} of {totalPages} · {count} total</p>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-40">
                <ChevronLeft size={16} />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pg = Math.max(1, Math.min(page - 2, totalPages - 4)) + i
                return (
                  <button key={pg} onClick={() => setPage(pg)}
                    className={cn('min-w-[32px] rounded-lg px-2 py-1 text-sm transition-colors',
                      pg === page ? 'bg-kratos font-semibold text-slate-900' : 'text-slate-600 hover:bg-slate-100')}>
                    {pg}
                  </button>
                )
              })}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-40">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
