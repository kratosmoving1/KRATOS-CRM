'use client'

import { useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { OPP_STATUSES, STATUS_TRANSITIONS } from '@/lib/constants'
import type { OppStatus } from '@/lib/constants'
import { cn } from '@/lib/utils'

interface Props {
  opportunityId: string
  currentStatus: OppStatus
  onClose: () => void
  onSuccess: (newStatus: OppStatus) => void
}

export default function ChangeStatusModal({ opportunityId, currentStatus, onClose, onSuccess }: Props) {
  const [selected, setSelected] = useState<OppStatus | ''>('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const available = STATUS_TRANSITIONS[currentStatus] ?? []
  const requiresReason = selected === 'cancelled'

  async function handleSubmit() {
    if (!selected) { setError('Please select a status'); return }
    if (requiresReason && !reason.trim()) { setError('Reason is required for this status change'); return }

    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/opportunities/${opportunityId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: selected, _reason: reason || null }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Update failed'); return }
      toast.success(`Status changed to ${OPP_STATUSES.find(s => s.value === selected)?.label}`)
      onSuccess(selected as OppStatus)
      onClose()
    } catch {
      setError('Network error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">Change Status</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <X size={16} />
          </button>
        </div>

        <p className="mb-3 text-sm text-slate-500">
          Current: <span className="font-medium text-slate-700">{OPP_STATUSES.find(s => s.value === currentStatus)?.label}</span>
        </p>

        {available.length === 0 ? (
          <p className="text-sm text-slate-500">No status transitions available from this state.</p>
        ) : (
          <div className="space-y-2">
            {available.map(status => {
              const meta = OPP_STATUSES.find(s => s.value === status)!
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => setSelected(status)}
                  className={cn(
                    'w-full rounded-lg border px-4 py-2.5 text-left text-sm font-medium transition-colors',
                    selected === status
                      ? 'border-kratos bg-kratos/10 text-slate-900'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50',
                  )}
                >
                  {meta.label}
                </button>
              )
            })}
          </div>
        )}

        {requiresReason && (
          <div className="mt-4">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-slate-500">
              Reason <span className="text-red-400">*</span>
            </label>
            <textarea
              rows={2}
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Explain why…"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm outline-none transition focus:border-kratos focus:bg-white focus:ring-2 focus:ring-kratos/20"
            />
          </div>
        )}

        {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-slate-500 hover:bg-slate-100">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !selected}
            className="flex items-center gap-2 rounded-lg bg-kratos px-5 py-2 text-sm font-semibold text-slate-900 hover:opacity-90 disabled:opacity-50"
          >
            {submitting && <Loader2 size={14} className="animate-spin" />}
            Update Status
          </button>
        </div>
      </div>
    </div>
  )
}
