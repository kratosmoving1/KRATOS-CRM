import { type DashboardData } from '@/lib/queries/dashboard'

interface OpenItemsCardProps {
  openItems: DashboardData['openItems']
}

export default function OpenItemsCard({ openItems }: OpenItemsCardProps) {
  const items = [
    { label: 'Unassigned',         value: openItems.unassignedLeads,   accent: true },
    { label: 'Open Opportunities', value: openItems.newLeads,           accent: false },
    { label: 'Booked Today',       value: openItems.bookedToday,        accent: false },
    { label: 'Stale Opportunities',value: openItems.staleOpportunities, accent: true },
  ]

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
        Open Items
      </h3>

      <div className="mt-4 grid grid-cols-2 gap-3">
        {items.map(({ label, value, accent }) => (
          <div
            key={label}
            className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3"
          >
            <p className={`text-2xl font-semibold ${accent && value > 0 ? 'text-kratos' : 'text-slate-900'}`}>
              {value}
            </p>
            <p className="mt-0.5 text-[11px] font-medium text-slate-500">{label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
