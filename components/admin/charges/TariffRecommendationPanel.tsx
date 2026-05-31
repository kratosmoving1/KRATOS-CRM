'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, ChevronDown, ChevronUp, Loader2, Sparkles, Truck, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  TARIFF_PACKAGES,
  checkTariffEligibility,
  recommendPackage,
  getRateForDate,
  getDateRateLabel,
  type PackageName,
} from '@/lib/tariff/packages'
import { estimateLabourTime } from '@/lib/tariff/time-estimator'

function fmt(n: number) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(n)
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TariffApplyConfig {
  // Package
  package_name: string
  num_trucks: number
  num_crew: number
  hourly_rate: number
  // Labour breakdown
  load_hours: number
  unload_hours: number
  handling_buffer_hours: number
  labor_hours: number       // total labour (load + unload + buffer)
  // Travel
  travel_hours: number
  distance_km: number | null
  drive_time_minutes: number | null
  travel_provider: string | null
  // Totals
  minimum_hours: number
  was_recommended: boolean
}

type TravelEstimateResult =
  | { ok: true; distanceKm: number; driveTimeMinutes: number; directDriveHours: number; returnTravelHours: number; recommendedTravelHours: number | null; manualReviewRequired: boolean; note: string | null; provider: string }
  | { ok: false; reason: string; message: string; provider?: string }

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  opportunityId: string
  serviceType: string | null
  moveSize: string | null
  moveDate: string | null
  hasExistingLaborCharge: boolean
  onApplyPackage: (config: TariffApplyConfig) => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function TariffRecommendationPanel({
  opportunityId,
  serviceType,
  moveSize,
  moveDate,
  hasExistingLaborCharge,
  onApplyPackage,
}: Props) {
  const [selectedPackage, setSelectedPackage] = useState<PackageName | null>(null)
  const [travelResult, setTravelResult] = useState<TravelEstimateResult | null>(null)
  const [travelLoading, setTravelLoading] = useState(false)
  const [travelOverride, setTravelOverride] = useState('')
  const [overrideReason, setOverrideReason] = useState('')
  const [showDetail, setShowDetail] = useState(false)

  const eligibility = checkTariffEligibility(serviceType)
  const recommendation = eligibility.eligible ? recommendPackage(moveSize) : null
  const labourEst = estimateLabourTime(moveSize)
  const rateLabel = getDateRateLabel(moveDate)
  const activePkg = selectedPackage ?? recommendation?.primary ?? null
  const isOverride = recommendation && activePkg && activePkg !== recommendation.primary

  // Fetch travel estimate when panel renders (for local moves with addresses)
  const fetchTravel = useCallback(async () => {
    if (!eligibility.eligible || !opportunityId) return
    setTravelLoading(true)
    try {
      const res = await fetch(`/api/admin/opportunities/${opportunityId}/travel-estimate`, { cache: 'no-store' })
      if (res.ok) setTravelResult(await res.json())
    } catch {
      // Non-critical — user can enter manually
    } finally {
      setTravelLoading(false)
    }
  }, [opportunityId, eligibility.eligible])

  useEffect(() => { fetchTravel() }, [fetchTravel])

  // Resolved travel hours
  const resolvedTravelHours: number = (() => {
    if (travelOverride !== '') return Math.max(0, parseFloat(travelOverride) || 0)
    if (travelResult?.ok) return travelResult.recommendedTravelHours ?? travelResult.directDriveHours
    return 0
  })()

  function buildApplyConfig(pkg: PackageName): TariffApplyConfig {
    const p = TARIFF_PACKAGES[pkg]
    const rate = getRateForDate(pkg, moveDate)
    return {
      package_name: p.name,
      num_trucks: p.numTrucks,
      num_crew: p.numCrew,
      hourly_rate: rate,
      load_hours: labourEst?.loadHours ?? 0,
      unload_hours: labourEst?.unloadHours ?? 0,
      handling_buffer_hours: labourEst?.handlingBufferHours ?? 0,
      labor_hours: labourEst?.totalLabourHours ?? 0,
      travel_hours: resolvedTravelHours,
      distance_km: travelResult?.ok ? travelResult.distanceKm : null,
      drive_time_minutes: travelResult?.ok ? travelResult.driveTimeMinutes : null,
      travel_provider: travelResult?.ok ? travelResult.provider : null,
      minimum_hours: 3,
      was_recommended: pkg === recommendation?.primary,
    }
  }

  // ── Non-local ──────────────────────────────────────────────────────────────
  if (!eligibility.eligible) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
        <div className="flex items-start gap-2.5">
          <AlertCircle size={15} className="mt-0.5 shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-semibold text-amber-900">Manual tariff required</p>
            <p className="mt-0.5 text-xs text-amber-700">{eligibility.reason}</p>
          </div>
        </div>
      </div>
    )
  }

  // ── No move size ───────────────────────────────────────────────────────────
  if (!moveSize) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <Sparkles size={14} className="shrink-0 text-slate-400" />
          <p className="text-sm text-slate-500">Select a move size to see package recommendations.</p>
        </div>
      </div>
    )
  }

  if (!recommendation) return null

  const totalBillable = (labourEst?.totalLabourHours ?? 0) + resolvedTravelHours
  const activePkgData = activePkg ? TARIFF_PACKAGES[activePkg] : null
  const activeRate = activePkg ? getRateForDate(activePkg, moveDate) : 0
  const estimatedSubtotal = Math.max(totalBillable, 3) * activeRate

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
        <Sparkles size={14} className="text-kratos" />
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Package Recommendation</p>
        <span className={cn(
          'ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold',
          rateLabel === 'weekend' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600',
        )}>
          {rateLabel === 'weekend' ? 'Weekend / Peak rate' : 'Weekday rate'}
        </span>
      </div>

      <div className="p-4 space-y-4">
        {/* Package cards */}
        <div className={cn('grid gap-3', recommendation.alternative ? 'sm:grid-cols-2' : 'grid-cols-1')}>
          <PackageCard
            pkg={recommendation.primary}
            moveDate={moveDate}
            label="Recommended"
            labelColor="text-green-700 bg-green-100"
            isSelected={activePkg === recommendation.primary}
            onSelect={() => setSelectedPackage(recommendation.primary)}
            onApply={() => onApplyPackage(buildApplyConfig(recommendation.primary))}
          />
          {recommendation.alternative && (
            <PackageCard
              pkg={recommendation.alternative}
              moveDate={moveDate}
              label="Alternative"
              labelColor="text-slate-600 bg-slate-100"
              isSelected={activePkg === recommendation.alternative}
              onSelect={() => setSelectedPackage(recommendation.alternative!)}
              onApply={() => onApplyPackage(buildApplyConfig(recommendation.alternative!))}
            />
          )}
        </div>

        {/* Override reason */}
        {isOverride && (
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">
              Override reason <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <input
              value={overrideReason}
              onChange={e => setOverrideReason(e.target.value)}
              placeholder="e.g. Customer requested extra mover, heavy furniture…"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-kratos focus:ring-2 focus:ring-kratos/20"
            />
          </div>
        )}

        {/* Note */}
        {recommendation.note && (
          <div className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2">
            <AlertCircle size={13} className="mt-0.5 shrink-0 text-slate-400" />
            <p className="text-xs text-slate-500">{recommendation.note}</p>
          </div>
        )}

        {/* Estimate detail toggle */}
        <button
          type="button"
          onClick={() => setShowDetail(o => !o)}
          className="flex w-full items-center justify-between text-xs font-semibold text-slate-500 hover:text-slate-700"
        >
          <span>Time &amp; travel estimate</span>
          {showDetail ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {showDetail && (
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-4">
            {/* Labour breakdown */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Labour Time</p>
              {labourEst?.requiresManualReview ? (
                <div className="flex items-start gap-2 text-xs text-amber-700">
                  <AlertCircle size={13} className="mt-0.5 shrink-0" />
                  <span>{labourEst.note}</span>
                </div>
              ) : labourEst ? (
                <div className="space-y-1.5 text-xs text-slate-600">
                  <EstRow label="Loading" value={`${labourEst.loadHours}h`} />
                  <EstRow label="Unloading" value={`${labourEst.unloadHours}h`} />
                  <EstRow label="Handling / buffer" value={`${labourEst.handlingBufferHours}h`} />
                  <EstRow label="Total labour" value={`${labourEst.totalLabourHours}h`} bold />
                  {labourEst.note && <p className="text-slate-400 italic">{labourEst.note}</p>}
                </div>
              ) : (
                <p className="text-xs text-slate-400">No estimate for this move size — enter manually.</p>
              )}
            </div>

            {/* Travel time */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Travel Time</p>
              {travelLoading ? (
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Loader2 size={12} className="animate-spin" /> Calculating…
                </div>
              ) : travelResult?.ok ? (
                <div className="space-y-1.5 text-xs text-slate-600">
                  <EstRow label="Google estimated drive" value={`${travelResult.driveTimeMinutes} min (${travelResult.distanceKm} km)`} />
                  {travelResult.returnTravelHours > 0 && (
                    <EstRow label="Return travel surcharge" value={`${travelResult.returnTravelHours}h`} />
                  )}
                  <EstRow label="Recommended billable travel" value={travelResult.manualReviewRequired ? 'Manual review' : `${travelResult.recommendedTravelHours}h`} bold />
                  {travelResult.note && <p className="text-slate-400 italic">{travelResult.note}</p>}
                </div>
              ) : (
                <p className="text-xs text-slate-400">
                  {travelResult?.ok === false ? travelResult.message : 'Fetching travel time…'}
                </p>
              )}

              {/* Manual override */}
              <div className="mt-3">
                <label className="mb-1 block text-xs font-semibold text-slate-500">
                  Override travel hours
                </label>
                <input
                  type="number" min={0} step={0.5}
                  value={travelOverride}
                  onChange={e => setTravelOverride(e.target.value)}
                  placeholder={String(resolvedTravelHours)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-kratos focus:ring-2 focus:ring-kratos/20"
                />
              </div>
            </div>

            {/* Summary */}
            {!labourEst?.requiresManualReview && activePkgData && (
              <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-1.5 text-xs">
                <p className="font-semibold text-slate-700 mb-2">{activePkgData.name} — Quick estimate</p>
                <EstRow label="Labour" value={`${labourEst?.totalLabourHours ?? 0}h`} />
                <EstRow label="Travel" value={`${resolvedTravelHours}h`} />
                <EstRow label="Total billable" value={`${totalBillable}h`} bold />
                <EstRow label={`${fmt(activeRate)}/hr × ${Math.max(totalBillable, 3)}h`} value={fmt(estimatedSubtotal)} bold />
              </div>
            )}
          </div>
        )}

        {hasExistingLaborCharge && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            A Moving Labor package already exists. Applying a package will update the current main package.
          </p>
        )}
      </div>
    </div>
  )
}

// ── Package card ──────────────────────────────────────────────────────────────

function PackageCard({
  pkg, moveDate, label, labelColor, isSelected, onSelect, onApply,
}: {
  pkg: PackageName; moveDate: string | null; label: string; labelColor: string
  isSelected: boolean; onSelect: () => void; onApply: () => void
}) {
  const p = TARIFF_PACKAGES[pkg]
  const rate = getRateForDate(pkg, moveDate)
  const rateLabel = getDateRateLabel(moveDate)
  return (
    <div
      className={cn(
        'rounded-xl border p-4 transition-all cursor-pointer',
        isSelected ? 'border-kratos ring-1 ring-kratos bg-kratos/5' : 'border-slate-200 bg-white hover:border-slate-300',
      )}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', labelColor)}>{label}</span>
          <p className="mt-1.5 text-base font-bold text-slate-950">{p.name}</p>
        </div>
        <div className={cn('flex h-5 w-5 items-center justify-center rounded-full border-2', isSelected ? 'border-kratos' : 'border-slate-300')}>
          {isSelected && <div className="h-2.5 w-2.5 rounded-full bg-kratos" />}
        </div>
      </div>
      <div className="space-y-1 text-xs text-slate-600">
        <div className="flex items-center gap-1.5"><Truck size={12} className="text-slate-400" /><span>{p.numTrucks} truck</span></div>
        <div className="flex items-center gap-1.5"><Users size={12} className="text-slate-400" /><span>{p.numCrew} movers</span></div>
      </div>
      <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2">
        <p className="text-lg font-bold text-slate-950">{fmt(rate)}<span className="text-xs font-semibold text-slate-400">/hr</span></p>
        <p className="text-[10px] text-slate-400 capitalize">{rateLabel} rate</p>
      </div>
      <button
        type="button"
        onClick={e => { e.stopPropagation(); onApply() }}
        className="mt-3 w-full rounded-lg bg-kratos py-2 text-xs font-bold text-slate-950 hover:opacity-90 transition-opacity"
      >
        Apply as Main Package
      </button>
    </div>
  )
}

function EstRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className={bold ? 'font-semibold text-slate-800' : ''}>{label}</span>
      <span className={bold ? 'font-bold text-slate-900' : 'tabular-nums'}>{value}</span>
    </div>
  )
}
