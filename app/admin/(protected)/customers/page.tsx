'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { formatCurrency } from '@/lib/format'
import { formatQuoteNumber } from '@/lib/opportunityDisplay'
import { formatDisplayPhone } from '@/lib/phone/formatPhone'
import { cn } from '@/lib/utils'

interface Opp {
  id: string; opportunity_number: string; status: string; service_type: string; total_amount: number
  created_at: string
  agent: { full_name: string } | null
  lead_source: { name: string } | null
}

interface Customer {
  id: string; full_name: string; email: string | null; phone: string | null
  created_at: string; opportunities: Opp[]; total_paid_cents: number
}

function mostRecentQuote(opps: Opp[]): Opp | null {
  if (!opps.length) return null
  const sorted = [...opps].sort((a, b) => {
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })
  return sorted[0]
}

function kratosPoints(totalPaidCents: number) {
  return Math.floor(totalPaidCents / 100)
}

export default function CustomersPage() {
  const router = useRouter()

  const [customers, setCustomers] = useState<Customer[]>([])
  const [count, setCount]   = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage]     = useState(1)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350)
    return () => clearTimeout(t)
  }, [search])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
      })
      const res = await fetch(`/api/admin/customers?${params}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Unable to load customers')
      setCustomers(json.data ?? [])
      setCount(json.count ?? 0)
    } catch (err) {
      console.error('Customers load failed:', err)
      setCustomers([])
      setCount(0)
    } finally { setLoading(false) }
  }, [page, debouncedSearch])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [debouncedSearch])

  const totalPages = Math.ceil(count / 25)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Customer Profiles</h1>
          <p className="mt-0.5 text-sm text-slate-500">{loading ? '…' : `${count.toLocaleString()} total`}</p>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, email, phone…"
            className="w-64 rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-3 text-sm outline-none focus:border-kratos focus:ring-2 focus:ring-kratos/20" />
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-slate-500">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-slate-500">Email</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-slate-500">Phone</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-slate-500">Most Recent Quote</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-widest text-slate-500">Total Paid</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-widest text-slate-500">Kratos Points</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 rounded bg-slate-100" style={{ width: `${50 + (j * 9) % 45}%` }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center">
                    <p className="text-sm font-medium text-slate-500">No customers found</p>
                    <p className="mt-1 text-xs text-slate-400">Customers are created automatically when you create quotes</p>
                  </td>
                </tr>
              ) : (
                customers.map(c => {
                  const quote = mostRecentQuote(c.opportunities)
                  const totalPaidCents = c.total_paid_cents ?? 0
                  return (
                    <tr key={c.id} onClick={() => router.push(`/admin/customers/${c.id}`)}
                      className="cursor-pointer transition-colors hover:bg-slate-50">
                      <td className="px-4 py-3 text-sm font-medium text-slate-900">{c.full_name}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{c.email ?? '—'}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{formatDisplayPhone(c.phone)}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {quote ? (
                          <button
                            type="button"
                            onClick={event => {
                              event.stopPropagation()
                              router.push(`/admin/opportunities/${quote.id}/quote`)
                            }}
                            className="font-mono text-xs font-semibold text-blue-600 hover:underline"
                          >
                            {formatQuoteNumber(quote.opportunity_number)}
                          </button>
                        ) : 'No quote'}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-slate-700">{formatCurrency(totalPaidCents / 100)}</td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-slate-700">{kratosPoints(totalPaidCents).toLocaleString()}</td>
                    </tr>
                  )
                })
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
                    className={cn('min-w-[32px] rounded-lg px-2 py-1 text-sm',
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
