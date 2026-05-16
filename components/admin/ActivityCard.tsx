import { type DashboardData } from '@/lib/queries/dashboard'

interface ActivityCardProps {
  activity: DashboardData['activity']
}

const ROWS = [
  { key: 'leads',         label: 'Leads' },
  { key: 'opportunities', label: 'Quotes' },
  { key: 'booked',        label: 'Booked' },
  { key: 'cancellations', label: 'Cancellations' },
] as const

type ActivityKey = typeof ROWS[number]['key']

export default function ActivityCard({ activity }: ActivityCardProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
        Activity
      </h3>

      <div className="mt-4 overflow-hidden rounded-lg border border-slate-100">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="py-2.5 pl-4 pr-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                &nbsp;
              </th>
              {(['today', 'week', 'month'] as const).map(period => (
                <th
                  key={period}
                  className="py-2.5 px-3 text-center text-[10px] font-semibold uppercase tracking-widest text-slate-400"
                >
                  {period === 'today' ? 'Today' : period === 'week' ? 'Week' : 'Month'}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map(({ key, label }, i) => (
              <tr
                key={key}
                className={i < ROWS.length - 1 ? 'border-b border-slate-100' : ''}
              >
                <td className="py-3 pl-4 pr-3 font-medium text-slate-700">{label}</td>
                {(['today', 'week', 'month'] as const).map(period => (
                  <td key={period} className="py-3 px-3 text-center font-semibold text-slate-900">
                    {activity[period][key as ActivityKey]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
