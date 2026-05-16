import { Archive, CalendarClock, CreditCard, PackageCheck } from 'lucide-react'

const SUMMARY = [
  { label: 'Storage Accounts', value: 'Coming soon', icon: Archive },
  { label: 'Active Storage', value: 'Coming soon', icon: PackageCheck },
  { label: 'Pending Pickup / Delivery', value: 'Coming soon', icon: CalendarClock },
  { label: 'Monthly Storage Billing', value: 'Coming soon', icon: CreditCard },
]

export default function StoragePage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Storage</h1>
        <p className="mt-0.5 text-sm text-slate-500">Storage module coming soon.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {SUMMARY.map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">{label}</p>
              <Icon size={18} className="text-kratos" />
            </div>
            <p className="mt-3 text-sm font-semibold text-slate-700">{value}</p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Storage Accounts</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px]">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-widest text-slate-500">
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Quote #</th>
                <th className="px-4 py-3">Start Date</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Storage Balance</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={5} className="px-4 py-14 text-center text-sm text-slate-500">
                  Storage accounts, SIT tracking, pickup/delivery scheduling, and monthly billing will appear here once the storage schema is connected.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
