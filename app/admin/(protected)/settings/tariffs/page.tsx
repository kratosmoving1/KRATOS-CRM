import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { normalizeRole } from '@/lib/auth/permissions'
import { ShieldAlert } from 'lucide-react'
import { TARIFF_PACKAGES, MOVE_SIZE_GROUPS_WITH_RECOMMENDATIONS } from '@/lib/tariff/admin'

export const dynamic = 'force-dynamic'

function fmt(n: number) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(n)
}

export default async function TariffsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return <AccessDenied message="Sign in to view tariff settings." />

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .single()

  const role = normalizeRole(profile?.role)
  if (!profile?.is_active || !['owner', 'admin', 'manager'].includes(role)) {
    return <AccessDenied message="Only owner, admin, and manager roles can view tariff settings." />
  }

  const packages = Object.values(TARIFF_PACKAGES)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Settings</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Tariffs & Packages</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Local move packages and pricing. Rates auto-populate when agents apply a package on the Estimate tab.
          </p>
        </div>
        <Link href="/admin/settings" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          ← Settings
        </Link>
      </div>

      {/* Note about DB */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <p className="font-semibold">Rates are currently managed in code.</p>
        <p className="mt-0.5">To enable database-driven rate editing, run the SQL from the tariff schema setup in Supabase SQL Editor. Until then, rate changes require a code deployment.</p>
      </div>

      {/* Package cards */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">Local Move Packages</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {packages.map(pkg => (
            <div key={pkg.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">{pkg.id.toUpperCase()}</p>
                  <h3 className="mt-0.5 text-xl font-bold text-slate-950">{pkg.name} Package</h3>
                </div>
                <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">Active</span>
              </div>
              <p className="mt-2 text-sm text-slate-500">{pkg.description}</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Stat label="Trucks" value={String(pkg.numTrucks)} />
                <Stat label="Movers" value={String(pkg.numCrew)} />
                <Stat label="Weekday rate" value={`${fmt(pkg.weekdayRate)}/hr`} />
                <Stat label="Weekend rate" value={`${fmt(pkg.weekendRate)}/hr`} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Move size rules */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">Move Size Rules</h2>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Move Size</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Recommended</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Alternative</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {MOVE_SIZE_GROUPS_WITH_RECOMMENDATIONS.map(row => (
                <tr key={row.value} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-medium text-slate-900">{row.label}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 rounded-full bg-kratos/10 px-2.5 py-0.5 text-xs font-semibold text-slate-900 capitalize">
                      {TARIFF_PACKAGES[row.primary as keyof typeof TARIFF_PACKAGES]?.name ?? row.primary}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    {row.alternative
                      ? <span className="capitalize">{TARIFF_PACKAGES[row.alternative as keyof typeof TARIFF_PACKAGES]?.name ?? row.alternative}</span>
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">{row.note ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Return travel rules */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">Return Travel Rules (Local)</h2>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Distance</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Return Travel</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {[
                { range: '≤ 40 km', travel: 'None — door-to-door billing' },
                { range: '41–60 km', travel: '0.5 h' },
                { range: '61–90 km', travel: '1.0 h' },
                { range: '91–130 km', travel: '1.5 h' },
                { range: '131+ km', travel: 'Manual review required' },
              ].map(row => (
                <tr key={row.range} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-medium">{row.range}</td>
                  <td className="px-4 py-3">{row.travel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  )
}

function AccessDenied({ message }: { message: string }) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="max-w-md rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <ShieldAlert className="mx-auto text-red-600" size={28} />
        <p className="mt-3 text-sm text-red-700">{message}</p>
      </div>
    </div>
  )
}
