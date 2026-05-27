'use client'

import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { OpportunityCharge } from './types'
import { CHARGE_TYPE_LABELS } from './types'

function formatMoney(n: number) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(n)
}

function ChargeRowMenu({
  charge,
  onEdit,
  onDelete,
}: {
  charge: OpportunityCharge
  onEdit: () => void
  onDelete: () => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
      >
        <MoreHorizontal size={15} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-36 rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
            <button
              type="button"
              onClick={() => { setOpen(false); onEdit() }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              <Pencil size={13} /> Edit
            </button>
            <button
              type="button"
              onClick={() => { setOpen(false); onDelete() }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              <Trash2 size={13} /> Delete
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function chargeRateLabel(charge: OpportunityCharge): string {
  const cfg = charge.config
  switch (charge.charge_type) {
    case 'moving_labor': {
      const billable = cfg.billable_hours ?? cfg.labor_hours ?? '?'
      const rate = cfg.hourly_rate ?? '?'
      const trucks = cfg.num_trucks ?? 1
      const crew = cfg.num_crew ?? 2
      return `${billable}h @ ${formatMoney(Number(rate))}/hr · ${trucks} truck, ${crew} crew`
    }
    case 'trip_and_travel':
      return `${cfg.distance_km ?? '?'} km @ $${cfg.rate_per_km ?? '?'}/km`
    case 'fuel_surcharge':
      if (cfg.percentage_of_labor != null) return `${cfg.percentage_of_labor}% of moving labor`
      return cfg.flat_amount != null ? `Flat ${formatMoney(Number(cfg.flat_amount))}` : ''
    case 'valuation':
      return `$${cfg.coverage_amount ?? '?'} coverage @ ${cfg.premium_rate ?? '?'}%`
    case 'storage':
      return `${cfg.months ?? '?'} month${Number(cfg.months ?? 1) !== 1 ? 's' : ''} @ ${formatMoney(Number(cfg.monthly_rate ?? 0))}/mo`
    case 'storage_in_transit':
      return `${cfg.num_days ?? '?'} day${Number(cfg.num_days ?? 1) !== 1 ? 's' : ''} @ ${formatMoney(Number(cfg.daily_rate ?? 0))}/day`
    default:
      if (cfg.quantity != null && cfg.unit_rate != null)
        return `${cfg.quantity} × ${formatMoney(Number(cfg.unit_rate))}`
      return charge.description ?? ''
  }
}

interface Props {
  charges: OpportunityCharge[]
  onAddCharge: () => void
  onEditCharge: (charge: OpportunityCharge) => void
  onDeleteCharge: (chargeId: string) => void
  deleting: string | null
}

export default function ChargesSection({ charges, onAddCharge, onEditCharge, onDeleteCharge, deleting }: Props) {
  const subtotal = charges.reduce((s, c) => s + c.total, 0)
  const totalDiscounts = charges.reduce((s, c) => s + c.discount_amount, 0)

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Charges</h2>
        <button
          type="button"
          onClick={onAddCharge}
          className="flex items-center gap-1.5 rounded-lg bg-kratos px-3 py-1.5 text-xs font-semibold text-slate-950 hover:opacity-90"
        >
          + Add Charge
        </button>
      </div>

      {charges.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">
          No charges yet.{' '}
          <button type="button" onClick={onAddCharge} className="font-medium text-kratos hover:underline">
            + Add Charge
          </button>{' '}
          to start building this estimate.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                <th className="pb-2 text-left font-medium">Name</th>
                <th className="pb-2 text-left font-medium">Rate / Detail</th>
                <th className="pb-2 text-right font-medium">Subtotal</th>
                <th className="pb-2 text-right font-medium">Discount</th>
                <th className="pb-2 text-right font-medium">Total</th>
                <th className="w-8 pb-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {charges.map(charge => (
                <tr
                  key={charge.id}
                  className={cn(
                    'group transition-colors',
                    deleting === charge.id ? 'opacity-40' : 'hover:bg-slate-50/60',
                  )}
                >
                  <td className="py-3 pr-3">
                    <p className="font-medium text-slate-900">{charge.name}</p>
                    <p className="text-xs text-slate-400">{CHARGE_TYPE_LABELS[charge.charge_type]}</p>
                  </td>
                  <td className="py-3 pr-3 text-xs text-slate-500">
                    {chargeRateLabel(charge)}
                  </td>
                  <td className="py-3 pr-3 text-right tabular-nums text-slate-700">
                    {formatMoney(charge.subtotal)}
                  </td>
                  <td className="py-3 pr-3 text-right tabular-nums text-slate-500">
                    {charge.discount_amount > 0
                      ? <span className="text-amber-600">−{formatMoney(charge.discount_amount)}</span>
                      : '—'}
                  </td>
                  <td className="py-3 pr-2 text-right tabular-nums font-semibold text-slate-900">
                    {formatMoney(charge.total)}
                  </td>
                  <td className="py-3">
                    <ChargeRowMenu
                      charge={charge}
                      onEdit={() => onEditCharge(charge)}
                      onDelete={() => onDeleteCharge(charge.id)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 font-semibold text-slate-900">
                <td colSpan={2} className="pt-3">Charges Total</td>
                <td className="pt-3 text-right tabular-nums">{formatMoney(charges.reduce((s, c) => s + c.subtotal, 0))}</td>
                <td className="pt-3 text-right tabular-nums text-amber-600">
                  {totalDiscounts > 0 ? `−${formatMoney(totalDiscounts)}` : '—'}
                </td>
                <td className="pt-3 text-right tabular-nums">{formatMoney(subtotal)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
