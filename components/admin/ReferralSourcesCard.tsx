import { type DashboardData } from '@/lib/queries/dashboard'
import { formatCurrency } from '@/lib/format'

interface ReferralSourcesCardProps {
  sources: DashboardData['referralSources']
}

export default function ReferralSourcesCard({ sources }: ReferralSourcesCardProps) {
  const maxRevenue = sources.length > 0 ? sources[0].revenue : 1

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
        Top Referral Sources This Month
      </h3>

      {sources.length === 0 ? (
        <p className="mt-8 text-center text-sm text-slate-400">
          No bookings yet this month
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {sources.map(source => {
            const pct = maxRevenue > 0 ? (source.revenue / maxRevenue) * 100 : 0
            return (
              <li key={source.source_name}>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-800">
                    {source.source_name}
                  </span>
                  <span className="text-xs text-slate-500">
                    {source.moves} moves / {formatCurrency(source.revenue)}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-kratos transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
