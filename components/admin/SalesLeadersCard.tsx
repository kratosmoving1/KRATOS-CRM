import { type DashboardData } from '@/lib/queries/dashboard'
import { formatCurrency } from '@/lib/format'

interface SalesLeadersCardProps {
  leaders: DashboardData['salesLeaders']
}

export default function SalesLeadersCard({ leaders }: SalesLeadersCardProps) {
  const maxRevenue = leaders.length > 0 ? leaders[0].revenue : 1

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
        Sales Leaders This Month
      </h3>

      {leaders.length === 0 ? (
        <p className="mt-8 text-center text-sm text-slate-400">
          No bookings yet this month
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {leaders.map((agent, i) => {
            const pct = maxRevenue > 0 ? (agent.revenue / maxRevenue) * 100 : 0
            return (
              <li key={agent.agent_name}>
                <div className="mb-1.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400 w-4">
                      {i + 1}
                    </span>
                    <span className="text-sm font-medium text-slate-800">
                      {agent.agent_name}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500">
                    {agent.moves} moves / {formatCurrency(agent.revenue)}
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
