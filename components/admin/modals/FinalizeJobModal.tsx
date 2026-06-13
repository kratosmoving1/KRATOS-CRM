'use client'

import { useState, useEffect } from 'react'
import { X, CheckCircle2, Loader2, Clock, Users, Truck, DollarSign } from 'lucide-react'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/format'

interface JobInfo {
  jobNumber: string
  customerName: string | null
  serviceDate: string | null
  serviceType: string | null
  estHourlyRate: number | null
  estCrewCount: number | null
  estTrucksCount: number | null
  estMinimumHours: number | null
  estBillableHours: number | null
  estTotal: number
}

interface Props {
  opportunityId: string
  isOpen: boolean
  onClose: () => void
  onFinalized: () => void
  jobInfo: JobInfo
}

type TimeMode = 'labor' | 'startend'

const SERVICE_LABELS: Record<string, string> = {
  local: 'Local Move', long_distance: 'Long Distance', commercial: 'Commercial',
  packing: 'Packing Only', storage: 'Storage', international: 'International',
}

function fmtDate(d: string | null): string {
  if (!d) return 'TBD'
  return new Date(d).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function FinalizeJobModal({
  opportunityId,
  isOpen,
  onClose,
  onFinalized,
  jobInfo,
}: Props) {
  const [mode, setMode] = useState<TimeMode>('labor')
  const [laborHours, setLaborHours] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [travelHours, setTravelHours] = useState('0')
  const [deductionHours, setDeductionHours] = useState('0')
  const [minHours, setMinHours] = useState(String(jobInfo.estMinimumHours ?? 3))
  const [crewCount, setCrewCount] = useState(String(jobInfo.estCrewCount ?? 2))
  const [trucksCount, setTrucksCount] = useState(String(jobInfo.estTrucksCount ?? 1))
  const [includeTravelInBillable, setIncludeTravelInBillable] = useState(false)
  const [tipsAmount, setTipsAmount] = useState('0')
  const [volumeCuft, setVolumeCuft] = useState('')
  const [weightLbs, setWeightLbs] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setMode('labor')
    setLaborHours('')
    setStartTime('')
    setEndTime('')
    setTravelHours('0')
    setDeductionHours('0')
    setMinHours(String(jobInfo.estMinimumHours ?? 3))
    setCrewCount(String(jobInfo.estCrewCount ?? 2))
    setTrucksCount(String(jobInfo.estTrucksCount ?? 1))
    setIncludeTravelInBillable(false)
    setTipsAmount('0')
    setVolumeCuft('')
    setWeightLbs('')
  }, [isOpen, jobInfo.estMinimumHours, jobInfo.estCrewCount, jobInfo.estTrucksCount])

  const hoursFromTimes = (() => {
    if (!startTime || !endTime) return 0
    const [sh, sm] = startTime.split(':').map(Number)
    const [eh, em] = endTime.split(':').map(Number)
    const startMins = sh * 60 + sm
    let endMins = eh * 60 + em
    if (endMins < startMins) endMins += 24 * 60
    return Math.round((endMins - startMins) / 60 * 100) / 100
  })()

  const parsedLabor  = mode === 'labor' ? (parseFloat(laborHours) || 0) : hoursFromTimes
  const parsedTravel = parseFloat(travelHours) || 0
  const parsedDeduct = parseFloat(deductionHours) || 0
  const parsedMin    = parseFloat(minHours) || 0

  const rawBillable  = includeTravelInBillable
    ? parsedLabor + parsedTravel - parsedDeduct
    : parsedLabor - parsedDeduct
  const billableHours = Math.max(rawBillable, parsedMin)

  const tipsCents = Math.round((parseFloat(tipsAmount) || 0) * 100)
  const canFinalize = parsedLabor > 0 || hoursFromTimes > 0

  async function handleFinalize() {
    if (!canFinalize) return
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/opportunities/${opportunityId}/finalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actual_labor_hours:         parsedLabor,
          actual_travel_hours:        parsedTravel,
          actual_deduction_hours:     parsedDeduct,
          actual_minimum_hours:       parsedMin,
          actual_billable_hours:      billableHours,
          actual_crew_count:          parseInt(crewCount) || (jobInfo.estCrewCount ?? 2),
          actual_trucks_count:        parseInt(trucksCount) || (jobInfo.estTrucksCount ?? 1),
          include_travel_in_billable: includeTravelInBillable,
          invoiced_volume_cuft:       volumeCuft ? parseFloat(volumeCuft) : null,
          invoiced_weight_lbs:        weightLbs  ? parseFloat(weightLbs)  : null,
          actual_tips_cents:          tipsCents > 0 ? tipsCents : null,
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
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div
        className="relative flex w-full max-w-3xl rounded-2xl overflow-hidden shadow-2xl bg-white"
        style={{ maxHeight: '92vh' }}
      >
        {/* Left dark info panel */}
        <div className="hidden md:flex flex-col w-60 flex-shrink-0 bg-slate-900 p-6">
          <div className="mb-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Final Charges</p>
            <p className="text-base font-bold text-white">{jobInfo.jobNumber}</p>
          </div>

          {jobInfo.customerName && (
            <div className="mb-3.5">
              <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-0.5">Customer</p>
              <p className="text-sm font-medium text-white leading-tight">{jobInfo.customerName}</p>
            </div>
          )}

          <div className="mb-3.5">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-0.5">Move Date</p>
            <p className="text-sm font-medium text-white">{fmtDate(jobInfo.serviceDate)}</p>
          </div>

          {jobInfo.serviceType && (
            <div className="mb-3.5">
              <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-0.5">Service</p>
              <p className="text-sm font-medium text-white">{SERVICE_LABELS[jobInfo.serviceType] ?? jobInfo.serviceType}</p>
            </div>
          )}

          <div className="border-t border-slate-700 pt-4 mt-1 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 flex items-center gap-1.5"><Users size={11} /> Crew</span>
              <span className="text-sm font-semibold text-white">{jobInfo.estCrewCount ?? '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 flex items-center gap-1.5"><Truck size={11} /> Trucks</span>
              <span className="text-sm font-semibold text-white">{jobInfo.estTrucksCount ?? '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 flex items-center gap-1.5"><DollarSign size={11} /> Rate</span>
              <span className="text-sm font-semibold text-white">
                {jobInfo.estHourlyRate ? `$${jobInfo.estHourlyRate.toFixed(2)}/hr` : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 flex items-center gap-1.5"><Clock size={11} /> Est. Hours</span>
              <span className="text-sm font-semibold text-white">
                {jobInfo.estBillableHours ? `${jobInfo.estBillableHours}h` : '—'}
              </span>
            </div>
          </div>

          <div className="mt-auto pt-5 border-t border-slate-700">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Est. Total</p>
            <p className="text-xl font-bold" style={{ color: '#ffad33' }}>{formatCurrency(jobInfo.estTotal)}</p>
          </div>
        </div>

        {/* Right form */}
        <div className="flex flex-col flex-1 min-h-0">
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 flex-shrink-0">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Final Charges</h2>
              <p className="mt-0.5 text-xs text-slate-400">Enter the actual values for this job.</p>
            </div>
            <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {/* Mode toggle */}
            <div className="flex rounded-lg border border-slate-200 overflow-hidden text-sm font-medium">
              <button
                type="button"
                onClick={() => setMode('labor')}
                className={`flex-1 py-2 transition-colors ${mode === 'labor' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
              >
                Labor Hours
              </button>
              <button
                type="button"
                onClick={() => setMode('startend')}
                className={`flex-1 py-2 transition-colors border-l border-slate-200 ${mode === 'startend' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
              >
                Start &amp; End Time
              </button>
            </div>

            {mode === 'labor' && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                  Labor Time (hours) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number" step="0.25" min="0"
                  value={laborHours}
                  onChange={e => setLaborHours(e.target.value)}
                  placeholder="e.g. 4.5"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-kratos focus:outline-none focus:ring-1 focus:ring-kratos"
                />
              </div>
            )}

            {mode === 'startend' && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Start Time</label>
                    <input
                      type="time"
                      value={startTime}
                      onChange={e => setStartTime(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-kratos focus:outline-none focus:ring-1 focus:ring-kratos"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">End Time</label>
                    <input
                      type="time"
                      value={endTime}
                      onChange={e => setEndTime(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-kratos focus:outline-none focus:ring-1 focus:ring-kratos"
                    />
                  </div>
                </div>
                {hoursFromTimes > 0 && (
                  <p className="text-xs text-slate-500">
                    Calculated: <span className="font-semibold text-slate-700">{hoursFromTimes}h labor time</span>
                  </p>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Travel Time (hours)</label>
                <input
                  type="number" step="0.25" min="0"
                  value={travelHours}
                  onChange={e => setTravelHours(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-kratos focus:outline-none focus:ring-1 focus:ring-kratos"
                />
              </div>
              <div className="flex items-end pb-2.5">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeTravelInBillable}
                    onChange={e => setIncludeTravelInBillable(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 accent-kratos"
                  />
                  <span className="text-sm text-slate-700">Include in billable</span>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Deductions (hours)</label>
                <input
                  type="number" step="0.25" min="0"
                  value={deductionHours}
                  onChange={e => setDeductionHours(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-kratos focus:outline-none focus:ring-1 focus:ring-kratos"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Minimum Hours</label>
                <input
                  type="number" step="0.5" min="0"
                  value={minHours}
                  onChange={e => setMinHours(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-kratos focus:outline-none focus:ring-1 focus:ring-kratos"
                />
              </div>
            </div>

            {/* Billable time highlight */}
            <div className="rounded-xl border-2 border-kratos/40 bg-amber-50 px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-600">Billable Time</p>
                {parsedMin > 0 && rawBillable < parsedMin && (
                  <p className="text-[10px] text-slate-400 mt-0.5">Minimum enforced ({parsedMin}h)</p>
                )}
              </div>
              <span className="text-2xl font-bold text-slate-900">{billableHours > 0 ? `${billableHours}h` : '—'}</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Number of Crew</label>
                <input
                  type="number" step="1" min="1"
                  value={crewCount}
                  onChange={e => setCrewCount(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-kratos focus:outline-none focus:ring-1 focus:ring-kratos"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Number of Trucks</label>
                <input
                  type="number" step="1" min="1"
                  value={trucksCount}
                  onChange={e => setTrucksCount(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-kratos focus:outline-none focus:ring-1 focus:ring-kratos"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Tips ($)</label>
              <input
                type="number" step="0.01" min="0"
                value={tipsAmount}
                onChange={e => setTipsAmount(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-kratos focus:outline-none focus:ring-1 focus:ring-kratos"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                  Volume (cu ft){' '}
                  <span className="font-normal normal-case tracking-normal text-slate-300">optional</span>
                </label>
                <input
                  type="number" step="1" min="0"
                  value={volumeCuft}
                  onChange={e => setVolumeCuft(e.target.value)}
                  placeholder="—"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-kratos focus:outline-none focus:ring-1 focus:ring-kratos"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                  Weight (lbs){' '}
                  <span className="font-normal normal-case tracking-normal text-slate-300">optional</span>
                </label>
                <input
                  type="number" step="1" min="0"
                  value={weightLbs}
                  onChange={e => setWeightLbs(e.target.value)}
                  placeholder="—"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-kratos focus:outline-none focus:ring-1 focus:ring-kratos"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleFinalize}
              disabled={saving || !canFinalize}
              className="flex items-center gap-1.5 rounded-lg bg-kratos px-6 py-2 text-sm font-semibold text-slate-950 hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              {saving ? 'Finalizing...' : 'Finalize Job'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
