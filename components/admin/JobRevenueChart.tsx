'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { type DashboardData } from '@/lib/queries/dashboard'
import { formatCurrency } from '@/lib/format'

interface JobRevenueChartProps {
  data: DashboardData['monthlyRevenue']
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-lg">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm font-bold text-slate-900">
        {formatCurrency(payload[0].value)}
      </p>
    </div>
  )
}

export default function JobRevenueChart({ data }: JobRevenueChartProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-5 flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
          Job Revenue
        </h3>
        <div className="flex gap-1">
          <button className="rounded-md bg-kratos/10 px-3 py-1 text-xs font-semibold text-kratos">
            12 Months
          </button>
          <button className="rounded-md px-3 py-1 text-xs font-semibold text-slate-400">
            30 Days
          </button>
        </div>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#f1f5f9" />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
              interval={0}
              tickFormatter={v => v.split(' ')[0]} // show just "Jan", "Feb", etc.
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
              width={56}
              tickFormatter={v => {
                if (v >= 1000) return `$${(v / 1000).toFixed(0)}k`
                return `$${v}`
              }}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
            <Bar dataKey="revenue" fill="#ffad33" radius={[4, 4, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
