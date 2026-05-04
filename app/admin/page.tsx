'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, ClipboardList, TrendingUp, LineChart } from 'lucide-react'
import StatCard from '@/components/admin/StatCard'
import ActivityCard from '@/components/admin/ActivityCard'
import OpenItemsCard from '@/components/admin/OpenItemsCard'
import SalesLeadersCard from '@/components/admin/SalesLeadersCard'
import ReferralSourcesCard from '@/components/admin/ReferralSourcesCard'
import JobRevenueChart from '@/components/admin/JobRevenueChart'
import { formatCurrency } from '@/lib/format'
import type { DashboardData } from '@/lib/queries/dashboard'

// ── Skeleton ──────────────────────────────────────────────
function CardSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-xl border border-slate-200 bg-white p-5 ${className}`}>
      <div className="h-3 w-24 rounded bg-slate-100" />
      <div className="mt-3 h-8 w-32 rounded bg-slate-100" />
      <div className="mt-2 h-2.5 w-16 rounded bg-slate-100" />
    </div>
  )
}

function SkeletonDashboard() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map(i => <CardSkeleton key={i} />)}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {[0, 1, 2].map(i => <CardSkeleton key={i} className="min-h-[180px]" />)}
      </div>
      <CardSkeleton className="min-h-[320px]" />
      <CardSkeleton className="min-h-[180px]" />
    </div>
  )
}

// ── Dashboard ─────────────────────────────────────────────
export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/dashboard')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then(setData)
      .catch(err => setError(err.message))
  }, [])

  if (error) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-5 text-center">
          <p className="text-sm font-semibold text-red-700">Failed to load dashboard</p>
          <p className="mt-1 text-xs text-red-500">{error}</p>
        </div>
      </div>
    )
  }

  if (!data) return <SkeletonDashboard />

  const movesValue = `${data.movesThisMonth} / ${formatCurrency(data.revenueThisMonth)}`
  const avgProfit  = data.avgProfitPerCustomer > 0
    ? formatCurrency(data.avgProfitPerCustomer)
    : '$0'
  const avgMove = data.avgMoveValueThisMonth > 0
    ? formatCurrency(data.avgMoveValueThisMonth)
    : '$0'

  return (
    <div className="space-y-4">
      {/* Page title */}
      <div className="mb-2">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Dashboard</h1>
        <p className="mt-0.5 text-sm text-slate-500">Welcome back — here&apos;s what&apos;s happening at Kratos Moving.</p>
      </div>

      {/* Row 1 — stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Moves This Month"
          value={movesValue}
          sublabel="Booked / Revenue"
          icon={CheckCircle2}
        />
        <StatCard
          label="Jobs Today"
          value={String(data.jobsToday)}
          sublabel="Scheduled today"
          icon={ClipboardList}
        />
        <StatCard
          label="Avg Profit / Customer"
          value={avgProfit}
          sublabel="Completed this month"
          icon={TrendingUp}
        />
        <StatCard
          label="Avg Move Value"
          value={avgMove}
          sublabel="Booked this month"
          icon={LineChart}
        />
      </div>

      {/* Row 2 — activity, open items, sales leaders */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ActivityCard activity={data.activity} />
        <OpenItemsCard openItems={data.openItems} />
        <SalesLeadersCard leaders={data.salesLeaders} />
      </div>

      {/* Row 3 — chart */}
      <JobRevenueChart data={data.monthlyRevenue} />

      {/* Row 4 — referral sources */}
      <ReferralSourcesCard sources={data.referralSources} />
    </div>
  )
}
