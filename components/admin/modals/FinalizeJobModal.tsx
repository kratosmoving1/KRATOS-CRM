'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, CheckCircle2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface Props {
  opportunityId: string
  isOpen: boolean
  onClose: () => void
  onFinalized: () => void
  // Pre-fill from the package on the opportunity (if available)
  defaultCrewCount?: number
  defaultTrucksCount?: number
  defaultHourlyRate?: number
  defaultMinimumHours?: number
}

export default function FinalizeJobModal({
  opportunityId,
  isOpen,
  onClose,
  onFinalized,
  defaultCrewCount = 2,
  defaultTrucksCount = 1,
  defaultHourlyRate,
  defaultMinimumHours = 3,
}: Props) {
  const [laborHours, setLaborHours] = useState('')
  const [travelHours, setTravelHours] = useState('0')
  const [deductionHours, setDeductionHours] = useState('0')
  const [minHours, setMinHours] = useState(String(defaultMinimumHours))
  const [crewCount, setCrewCount] = useState(String(defaultCrewCount))
  const [trucksCount, setTrucksCount] = useState(String(defaultTrucksCount))
  const [includeTravelInBillable, setIncludeTravelInBillable] = useState(false)
  const [tipsAmount, setTipsAmount] = useState('0')
  const [volumeCuft, setVolumeCuft] = useState('')
  const [weightLbs, setWeightLbs] = useState('')
  const [saving, setSaving] = useState(false)

  // Reset form when opened
  useEffect(() => {
    if (isOpen) {
      setLaborHours('')
      setTravelHours('0')
      setDeductionHours('0')
      setMinHours(String(defaultMinimumHours))
      setCrewCount(String(defaultCrewCount))
      setTrucksCount(String(defaultTrucksCount))
      setIncludeTravelInBillable(false)
      setTipsAmount('0')
      setVolumeCuft('')
      setWeightLbs('')
    }
  }, [isOpen, defaultCrewCount, defaultTrucksCount, defaultMinimumHours])

  const parsedLabor    = parseFloat(laborHours)    || 0
  const parsedTravel   = parseFloat(travelHours)   || 0
  const parsedDeduct   = parseFloat(deductionHours) || 0
  const parsedMin      = parseFloat(minHours)       || 0

  const rawBillable = includeTravelInBillable
    ? parsedLabor + parsedTravel - parsedDeduct
    : parsedLabor - parsedDeduct
  const billableHours = Math.max(rawBillable, parsedMin)

  const tipsAmountNum = parseFloat(tipsAmount) || 0
  const tipsCents = Math.round(tipsAmountNum * 100)

  const canFinalize = parsedLabor > 0

  async function handleFinalize() {
    if (!canFinalize) return
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/opportunities/${opportunityId}/finalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actual_labor_hours:        parsedLabor,
          actual_travel_hours:       parsedTravel,
          actual_deduction_hours:    parsedDeduct,
          actual_minimum_hours:      parsedMin,
          actual_billable_hours:     billableHours,
          actual_crew_count:         parseInt(crewCount) || defaultCrewCount,
          actual_trucks_count:       parseInt(trucksCount) || defaultTrucksCount,
          include_travel_in_billable: includeTravelInBillable,
          invoiced_volume_cuft:      volumeCuft ? parseFloat(volumeCuft) : null,
          invoiced_weight_lbs:       weightLbs  ? parseFloat(weightLbs)  : null,
          actual_tips_cents:         tipsCents > 0 ? tipsCents : null,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(json.error ?? 'Failed to finalize'); return }
      toast.success('Job finalized.')
      onFinalized()
      onClose()
    } catch {
      toast.error('Network error — please try again')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Final Charges</h2>
            <p className="mt-0.5 text-xs text-slate-400">Enter the actual values for the job.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">

          {/* Labor time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                Labor Time (hours) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.25"
                min="0"
                value={laborHours}
                onChange={e => setLaborHours(e.target.value)}
                placeholder="e.g. 4"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-kratos focus:outline-none focus:ring-1 focus:ring-kratos"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                Travel Time (hours)
              </label>
              <input
                type="number"
                step="0.25"
                min="0"
                value={travelHours}
                onChange={e => setTravelHours(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-kratos focus:outline-none focus:ring-1 focus:ring-kratos"
              />
            </div>
          </div>

          {/* Include travel + tips */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2 pt-5">
              <input
                id="include-travel"
                type="checkbox"
                checked={includeTravelInBillable}
                onChange={e => setIncludeTravelInBillable(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-kratos accent-kratos"
              />
              <label htmlFor="include-travel" className="text-sm text-slate-700 cursor-pointer">
                Include travel in billable time
              </label>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                Tips ($)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={tipsAmount}
                onChange={e => setTipsAmount(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-kratos focus:outline-none focus:ring-1 focus:ring-kratos"
              />
            </div>
          </div>

          {/* Deductions + minimum */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                Deductions (hours)
              </label>
              <input
                type="number"
                step="0.25"
                min="0"
                value={deductionHours}
                onChange={e => setDeductionHours(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-kratos focus:outline-none focus:ring-1 focus:ring-kratos"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                Minimum Job Time (hours)
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={minHours}
                onChange={e => setMinHours(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-kratos focus:outline-none focus:ring-1 focus:ring-kratos"
              />
            </div>
          </div>

          {/* Billable time (calculated) */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-slate-600">Billable Time</span>
            <span className="text-lg font-bold text-slate-900">{billableHours > 0 ? `${billableHours}h` : '—'}</span>
          </div>

          {/* Crew / trucks */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                Number of Trucks
              </label>
              <input
                type="number"
                step="1"
                min="1"
                value={trucksCount}
                onChange={e => setTrucksCount(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-kratos focus:outline-none focus:ring-1 focus:ring-kratos"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                Number of Crew
              </label>
              <input
                type="number"
                step="1"
                min="1"
                value={crewCount}
                onChange={e => setCrewCount(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-kratos focus:outline-none focus:ring-1 focus:ring-kratos"
              />
            </div>
          </div>

          {/* Volume / weight */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                Invoiced Volume (cu ft)
              </label>
              <input
                type="number"
                step="1"
                min="0"
                value={volumeCuft}
                onChange={e => setVolumeCuft(e.target.value)}
                placeholder="Optional"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-kratos focus:outline-none focus:ring-1 focus:ring-kratos"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                Invoiced Weight (lbs)
              </label>
              <input
                type="number"
                step="1"
                min="0"
                value={weightLbs}
                onChange={e => setWeightLbs(e.target.value)}
                placeholder="Optional"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-kratos focus:outline-none focus:ring-1 focus:ring-kratos"
              />
            </div>
          </div>

          {defaultHourlyRate && (
            <p className="text-xs text-slate-400">
              Pricing rate: <span className="font-medium text-slate-600">${defaultHourlyRate}/hr</span>
            </p>
          )}

        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleFinalize}
            disabled={saving || !canFinalize}
            className="flex items-center gap-1.5 rounded-lg bg-kratos px-6 py-2 text-sm font-semibold text-slate-950 hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {saving
              ? <Loader2 size={14} className="animate-spin" />
              : <CheckCircle2 size={14} />}
            {saving ? 'Finalizing...' : 'Finalize'}
          </button>
        </div>
      </div>
    </div>
  )
}
