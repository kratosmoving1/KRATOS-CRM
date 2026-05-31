'use client'

import { Copy, MoreHorizontal, Pencil, Plus, Trash2, Truck, Users, X } from 'lucide-react'
import { useState } from 'react'
import type { ElementType } from 'react'
import { cn } from '@/lib/utils'
import type { OpportunityCharge } from './types'
import { CHARGE_TYPE_LABELS } from './types'

function formatMoney(n: number) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(n)
}

// ── Supplementary charge row menu ─────────────────────────────────────────────

function ChargeRowMenu({ charge, onEdit, onDelete, onDuplicate }: {
  charge: OpportunityCharge; onEdit: () => void; onDelete: () => void; onDuplicate?: () => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(v => !v)}
        className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
        <MoreHorizontal size={15} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-36 rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
            <button type="button" onClick={() => { setOpen(false); onEdit() }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
              <Pencil size={13} /> Edit
            </button>
            {onDuplicate && (
              <button type="button" onClick={() => { setOpen(false); onDuplicate() }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                <Copy size={13} /> Duplicate
              </button>
            )}
            <button type="button" onClick={() => { setOpen(false); onDelete() }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50">
              <Trash2 size={13} /> Delete
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function suppRateLabel(charge: OpportunityCharge): string {
  const cfg = charge.config
  switch (charge.charge_type) {
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

function packageDisplayName(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return 'Moving Labor'
  return /package$/i.test(trimmed) ? trimmed : `${trimmed} Package`
}

function Field({ label, value, icon: Icon }: { label: string; value: string; icon?: ElementType }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 flex items-center gap-1 font-semibold text-slate-800">
        {Icon && <Icon size={11} className="text-slate-400" />}
        {value}
      </p>
    </div>
  )
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  charges: OpportunityCharge[]
  onAddCharge: () => void
  onEditCharge: (charge: OpportunityCharge) => void
  onDuplicateCharge?: (charge: OpportunityCharge) => void
  onDeleteCharge: (chargeId: string) => void
  deleting: string | null
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ChargesSection({ charges, onAddCharge, onEditCharge, onDuplicateCharge, onDeleteCharge, deleting }: Props) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const laborCharges = charges.filter(c => c.charge_type === 'moving_labor')
  const suppCharges  = charges.filter(c => c.charge_type !== 'moving_labor')
  const grandTotal   = charges.reduce((s, c) => s + c.total, 0)
  const grandSubtotal = charges.reduce((s, c) => s + c.subtotal, 0)
  const totalDiscounts = charges.reduce((s, c) => s + c.discount_amount, 0)

  const confirmCharge = charges.find(c => c.id === confirmDeleteId) ?? null
  function requestDelete(id: string) { setConfirmDeleteId(id) }
  function confirmDelete() { if (confirmDeleteId) { onDeleteCharge(confirmDeleteId); setConfirmDeleteId(null) } }

  return (
    <>
      {/* ── Main Package ──────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Main Package</h2>
        </div>

        {laborCharges.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-sm text-slate-400">No package applied yet.</p>
            <p className="mt-1 text-xs text-slate-400">Use the Package Recommendation above to select Silver or Gold.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {laborCharges.map(charge => {
              const cfg = charge.config
              const pkgName = packageDisplayName(String(cfg.package_name ?? 'Moving Labor'))
              const trucks = Number(cfg.num_trucks ?? 1)
              const crew   = Number(cfg.num_crew ?? 2)
              const rate   = Number(cfg.hourly_rate ?? 0)
              const billable = Number(cfg.billable_hours ?? cfg.labor_hours ?? 0)
              const travel   = Number(cfg.travel_hours ?? 0)
              const labor = Number(cfg.labor_hours ?? 0)
              const loadH    = Number(cfg.load_hours ?? 0)
              const unloadH  = Number(cfg.unload_hours ?? 0)
              const bufferH  = Number(cfg.handling_buffer_hours ?? 0)
              const hasBreakdown = loadH > 0 || unloadH > 0 || bufferH > 0

              return (
                <div key={charge.id} className={cn('px-5 py-4 transition-colors', deleting === charge.id ? 'opacity-40' : '')}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      {/* Package name + override badge */}
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-slate-900">{pkgName}</p>
                        {charge.is_overridden && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Agent override</span>
                        )}
                      </div>

                      <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-4">
                        <Field label="Trucks" value={`${trucks}`} icon={Truck} />
                        <Field label="Movers" value={`${crew}`} icon={Users} />
                        <Field label="Hourly rate" value={rate > 0 ? `${formatMoney(rate)}/hr` : '—'} />
                        <Field label="Subtotal" value={formatMoney(charge.subtotal)} />
                      </div>

                      {/* Time breakdown */}
                      <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-3">
                        <Field label="Labour hours" value={`${labor}h`} />
                        <Field label="Travel hours" value={`${travel}h`} />
                        <Field label="Total billable hours" value={`${billable}h`} />
                      </div>

                      <div className="mt-2 space-y-0.5 text-xs text-slate-500">
                        {hasBreakdown && (
                          <p>Labour: {loadH}h load · {unloadH}h unload · {bufferH}h buffer = {loadH+unloadH+bufferH}h</p>
                        )}
                        {cfg.distance_km != null && (
                          <p className="text-slate-400">{String(cfg.distance_km)} km · {String(cfg.drive_time_minutes ?? '?')} min drive</p>
                        )}
                      </div>
                    </div>

                    {/* Total + actions */}
                    <div className="shrink-0 text-right">
                      <p className="text-lg font-bold text-slate-900">{formatMoney(charge.total)}</p>
                      {charge.discount_amount > 0 && (
                        <p className="text-xs text-amber-600">−{formatMoney(charge.discount_amount)}</p>
                      )}
                      <div className="mt-2 flex items-center gap-1.5 justify-end">
                        <button type="button" onClick={() => onEditCharge(charge)}
                          className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
                          <Pencil size={11} /> Edit
                        </button>
                        <button type="button" onClick={() => requestDelete(charge.id)}
                          className="rounded-lg border border-red-100 px-2 py-1.5 text-xs text-red-500 hover:bg-red-50">
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Supplementary Charges ─────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Supplementary Charges</h2>
          <button type="button" onClick={onAddCharge}
            className="flex items-center gap-1.5 rounded-lg bg-kratos px-3 py-1.5 text-xs font-semibold text-slate-950 hover:opacity-90">
            <Plus size={12} /> Add Supplementary Charge
          </button>
        </div>

        {suppCharges.length === 0 ? (
          <p className="px-5 py-6 text-center text-sm text-slate-400">
            No supplementary charges.{' '}
            <button type="button" onClick={onAddCharge} className="font-medium text-kratos hover:underline">Add materials, packing, or fees.</button>
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  <th className="px-5 pb-2 pt-3 text-left font-medium">Name</th>
                  <th className="pb-2 pt-3 text-left font-medium">Rate / Detail</th>
                  <th className="pb-2 pt-3 pr-3 text-right font-medium">Subtotal</th>
                  <th className="pb-2 pt-3 pr-3 text-right font-medium">Discount</th>
                  <th className="pb-2 pt-3 pr-3 text-right font-medium">Total</th>
                  <th className="w-8 pb-2 pt-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {suppCharges.map(charge => (
                  <tr key={charge.id} className={cn('group transition-colors', deleting === charge.id ? 'opacity-40' : 'hover:bg-slate-50/60')}>
                    <td className="py-3 pl-5 pr-3">
                      <p className="font-medium text-slate-900">{charge.name}</p>
                      <p className="text-xs text-slate-400">{CHARGE_TYPE_LABELS[charge.charge_type]}</p>
                    </td>
                    <td className="py-3 pr-3 text-xs text-slate-500">{suppRateLabel(charge)}</td>
                    <td className="py-3 pr-3 text-right tabular-nums text-slate-700">{formatMoney(charge.subtotal)}</td>
                    <td className="py-3 pr-3 text-right tabular-nums text-slate-500">
                      {charge.discount_amount > 0 ? <span className="text-amber-600">−{formatMoney(charge.discount_amount)}</span> : '—'}
                    </td>
                    <td className="py-3 pr-2 text-right tabular-nums font-semibold text-slate-900">{formatMoney(charge.total)}</td>
                    <td className="py-3">
                      <ChargeRowMenu
                        charge={charge}
                        onEdit={() => onEditCharge(charge)}
                        onDuplicate={onDuplicateCharge ? () => onDuplicateCharge(charge) : undefined}
                        onDelete={() => requestDelete(charge.id)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Charges total footer — only when any charges exist */}
        {charges.length > 0 && (
          <div className="border-t-2 border-slate-200 px-5 py-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-slate-700">Charges Total</span>
              <div className="flex items-center gap-6 text-right">
                <span className="tabular-nums text-slate-500">{formatMoney(grandSubtotal)}</span>
                <span className="tabular-nums text-amber-600">{totalDiscounts > 0 ? `−${formatMoney(totalDiscounts)}` : '—'}</span>
                <span className="font-bold tabular-nums text-slate-900">{formatMoney(grandTotal)}</span>
                <span className="w-8" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      {confirmDeleteId && confirmCharge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmDeleteId(null)} />
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-900">Delete this charge?</p>
                <p className="mt-1 text-sm text-slate-600">
                  <span className="font-medium">{confirmCharge.name}</span> — {formatMoney(confirmCharge.total)}
                </p>
                <p className="mt-1 text-xs text-slate-400">Totals will recalculate immediately.</p>
              </div>
              <button onClick={() => setConfirmDeleteId(null)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X size={15} /></button>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setConfirmDeleteId(null)} className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">Cancel</button>
              <button onClick={confirmDelete} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">Delete charge</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
