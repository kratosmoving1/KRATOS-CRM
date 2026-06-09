'use client'

import { useState } from 'react'
import { Copy, MoreHorizontal, Pencil, Plus, Trash2, X, ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { OpportunityCharge } from './types'
import { CHARGE_TYPE_LABELS } from './types'
import { formatRate } from '@/lib/charges/format'

function fmt(n: number) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(n)
}

// ── Row three-dot menu ────────────────────────────────────────────────────────

function ChargeRowMenu({
  charge,
  onEdit,
  onDelete,
  onDuplicate,
}: {
  charge: OpportunityCharge
  onEdit: () => void
  onDelete: () => void
  onDuplicate?: () => void
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
            {onDuplicate && (
              <button
                type="button"
                onClick={() => { setOpen(false); onDuplicate() }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                <Copy size={13} /> Duplicate
              </button>
            )}
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

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  charges: OpportunityCharge[]
  onAddCharge: () => void
  onEditCharge: (charge: OpportunityCharge) => void
  onDuplicateCharge?: (charge: OpportunityCharge) => void
  onDeleteCharge: (chargeId: string) => void
  deleting: string | null
}

// ── Unified Charges table ─────────────────────────────────────────────────────

export default function ChargesSection({
  charges,
  onAddCharge,
  onEditCharge,
  onDuplicateCharge,
  onDeleteCharge,
  deleting,
}: Props) {
  const [collapsed, setCollapsed] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const grandSubtotal = charges.reduce((s, c) => s + c.subtotal, 0)
  const totalDiscounts = charges.reduce((s, c) => s + c.discount_amount, 0)
  const grandTotal = charges.reduce((s, c) => s + c.total, 0)

  const confirmCharge = charges.find(c => c.id === confirmDeleteId) ?? null

  function requestDelete(id: string) {
    setConfirmDeleteId(id)
  }
  function confirmDelete() {
    if (confirmDeleteId) {
      onDeleteCharge(confirmDeleteId)
      setConfirmDeleteId(null)
    }
  }

  return (
    <>
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {/* Section header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setCollapsed(v => !v)}
              className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
            >
              Charges
            </button>
            <button
              type="button"
              onClick={onAddCharge}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-xs font-medium text-slate-700 transition-colors"
            >
              <Plus size={12} /> Add Charge
            </button>
          </div>
          <button
            type="button"
            onClick={() => setCollapsed(v => !v)}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            {collapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>

        {!collapsed && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[540px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  <th className="px-5 pb-2 pt-3 text-left font-medium w-[28%]">Name</th>
                  <th className="pb-2 pt-3 pr-3 text-left font-medium w-[32%]">Rate</th>
                  <th className="pb-2 pt-3 pr-3 text-right font-medium w-[13%]">Subtotal</th>
                  <th className="pb-2 pt-3 pr-3 text-right font-medium w-[12%]">Discount</th>
                  <th className="pb-2 pt-3 pr-3 text-right font-medium w-[11%]">Total</th>
                  <th className="w-8 pb-2 pt-3" />
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-50">
                {charges.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-sm text-slate-400">
                      No charges yet.{' '}
                      <button
                        type="button"
                        onClick={onAddCharge}
                        className="font-medium text-kratos hover:underline"
                      >
                        Apply a package above or click + Add Charge.
                      </button>
                    </td>
                  </tr>
                ) : (
                  charges.map(charge => (
                    <tr
                      key={charge.id}
                      className={cn(
                        'group transition-colors',
                        deleting === charge.id ? 'opacity-40' : 'hover:bg-slate-50/60',
                      )}
                    >
                      {/* Name */}
                      <td className="py-3 pl-5 pr-3">
                        <p className="font-medium text-slate-900">{charge.name}</p>
                        <p className="text-xs text-slate-400">{CHARGE_TYPE_LABELS[charge.charge_type]}</p>
                        {charge.is_overridden && (
                          <span className="mt-0.5 inline-block rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                            Agent override
                          </span>
                        )}
                        {charge.charge_type === 'trip_and_travel' && (charge.config as Record<string, unknown>)?.source === 'auto_distance_matrix' && (
                          <span className="mt-0.5 inline-block rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-600">
                            Auto-computed
                          </span>
                        )}
                      </td>

                      {/* Rate */}
                      <td className="py-3 pr-3 text-xs text-slate-500">
                        {formatRate(charge)}
                      </td>

                      {/* Subtotal */}
                      <td className="py-3 pr-3 text-right tabular-nums text-slate-700">
                        {fmt(charge.subtotal)}
                      </td>

                      {/* Discount */}
                      <td className="py-3 pr-3 text-right tabular-nums text-slate-500">
                        {charge.discount_amount > 0
                          ? <span className="text-amber-600">−{fmt(charge.discount_amount)}</span>
                          : '—'}
                      </td>

                      {/* Total */}
                      <td className="py-3 pr-2 text-right tabular-nums font-medium text-slate-900">
                        {fmt(charge.total)}
                      </td>

                      {/* Actions */}
                      <td className="py-3">
                        <ChargeRowMenu
                          charge={charge}
                          onEdit={() => onEditCharge(charge)}
                          onDuplicate={
                            onDuplicateCharge && charge.charge_type !== 'moving_labor'
                              ? () => onDuplicateCharge(charge)
                              : undefined
                          }
                          onDelete={() => requestDelete(charge.id)}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>

              {/* Estimated Total footer */}
              {charges.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold text-slate-800">
                    <td colSpan={2} className="px-5 py-3">Estimated Total</td>
                    <td className="py-3 pr-3 text-right tabular-nums">{fmt(grandSubtotal)}</td>
                    <td className="py-3 pr-3 text-right tabular-nums text-amber-600">
                      {totalDiscounts > 0 ? `−${fmt(totalDiscounts)}` : '—'}
                    </td>
                    <td className="py-3 pr-2 text-right tabular-nums">{fmt(grandTotal)}</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      {confirmDeleteId && confirmCharge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmDeleteId(null)} />
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-900">Delete this charge?</p>
                <p className="mt-1 text-sm text-slate-600">
                  <span className="font-medium">{confirmCharge.name}</span> — {fmt(confirmCharge.total)}
                </p>
                <p className="mt-1 text-xs text-slate-400">Totals will recalculate immediately.</p>
              </div>
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X size={15} />
              </button>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
              >
                Delete charge
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
