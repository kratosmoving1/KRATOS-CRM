'use client'

import { useState } from 'react'
import { AlertCircle, ChevronDown, ChevronUp, Sparkles, Truck, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  TARIFF_PACKAGES,
  checkTariffEligibility,
  recommendPackage,
  getRateForDate,
  getDateRateLabel,
  recommendReturnTravel,
  type PackageName,
} from '@/lib/tariff/packages'

function fmt(n: number) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(n)
}

interface TariffApplyConfig {
  num_trucks: number
  num_crew: number
  hourly_rate: number
  travel_hours: number
  minimum_hours: number
  // meta for tracking selection
  package_name: string
  was_recommended: boolean
}

interface Props {
  serviceType: string | null
  moveSize: string | null
  moveDate: string | null
  hasExistingLaborCharge: boolean
  onApplyPackage: (config: TariffApplyConfig) => void
}

export default function TariffRecommendationPanel({
  serviceType,
  moveSize,
  moveDate,
  hasExistingLaborCharge,
  onApplyPackage,
}: Props) {
  const [selectedPackage, setSelectedPackage] = useState<PackageName | null>(null)
  const [distanceKm, setDistanceKm] = useState('')
  const [travelOverride, setTravelOverride] = useState('')
  const [overrideReason, setOverrideReason] = useState('')
  const [showDistance, setShowDistance] = useState(false)

  const eligibility = checkTariffEligibility(serviceType)
  const recommendation = eligibility.eligible ? recommendPackage(moveSize) : null
  const rateLabel = getDateRateLabel(moveDate)

  const distKm = parseFloat(distanceKm) || null
  const travelRec = recommendReturnTravel(distKm)
  const effectiveTravelHours = travelOverride !== '' ? (parseFloat(travelOverride) || 0) : travelRec.returnHours

  const activePkg = selectedPackage ?? recommendation?.primary ?? null
  const isOverride = recommendation && activePkg && activePkg !== recommendation.primary

  function handleApply(pkg: PackageName) {
    const p = TARIFF_PACKAGES[pkg]
    const rate = getRateForDate(pkg, moveDate)
    const config: TariffApplyConfig = {
      num_trucks: p.numTrucks,
      num_crew: p.numCrew,
      hourly_rate: rate,
      travel_hours: effectiveTravelHours,
      minimum_hours: 3,
      package_name: p.name,
      was_recommended: pkg === recommendation?.primary,
    }
    onApplyPackage(config)
  }

  // ── Non-local service type ────────────────────────────────────────────────
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

  // ── No move size selected ─────────────────────────────────────────────────
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

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
        <Sparkles size={14} className="text-kratos" />
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Package Recommendation</p>
        <span className={cn(
          'ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold',
          rateLabel === 'weekend' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
        )}>
          {rateLabel === 'weekend' ? 'Weekend / Peak rate' : 'Weekday rate'}
        </span>
      </div>

      <div className="p-4 space-y-4">
        {/* Package cards */}
        <div className={cn('grid gap-3', recommendation.alternative ? 'sm:grid-cols-2' : 'grid-cols-1')}>
          {/* Primary */}
          <PackageCard
            pkg={recommendation.primary}
            moveDate={moveDate}
            label="Recommended"
            labelColor="text-green-700 bg-green-100"
            isSelected={activePkg === recommendation.primary}
            onSelect={() => setSelectedPackage(recommendation.primary)}
            onApply={() => handleApply(recommendation.primary)}
            hasExistingCharge={hasExistingLaborCharge}
          />

          {/* Alternative */}
          {recommendation.alternative && (
            <PackageCard
              pkg={recommendation.alternative}
              moveDate={moveDate}
              label="Alternative"
              labelColor="text-slate-600 bg-slate-100"
              isSelected={activePkg === recommendation.alternative}
              onSelect={() => setSelectedPackage(recommendation.alternative!)}
              onApply={() => handleApply(recommendation.alternative!)}
              hasExistingCharge={hasExistingLaborCharge}
            />
          )}
        </div>

        {/* Override reason prompt */}
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

        {/* Travel time section */}
        <div>
          <button
            type="button"
            onClick={() => setShowDistance(o => !o)}
            className="flex w-full items-center justify-between text-xs font-semibold text-slate-500 hover:text-slate-700"
          >
            <span>Return travel time</span>
            {showDistance ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {showDistance && (
            <div className="mt-3 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">Distance (km)</label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={distanceKm}
                    onChange={e => { setDistanceKm(e.target.value); setTravelOverride('') }}
                    placeholder="e.g. 35"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-kratos focus:ring-2 focus:ring-kratos/20"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">
                    Return travel (h) <span className="font-normal text-slate-400">override</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={travelOverride}
                    onChange={e => setTravelOverride(e.target.value)}
                    placeholder={String(travelRec.returnHours)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-kratos focus:ring-2 focus:ring-kratos/20"
                  />
                </div>
              </div>

              {distKm !== null && distKm > 0 && (
                <div className={cn(
                  'flex items-start gap-2 rounded-lg px-3 py-2 text-xs',
                  travelRec.requiresManualReview
                    ? 'bg-red-50 text-red-700'
                    : travelRec.returnHours > 0
                    ? 'bg-amber-50 text-amber-700'
                    : 'bg-green-50 text-green-700',
                )}>
                  <AlertCircle size={13} className="mt-0.5 shrink-0" />
                  <span>{travelRec.note}</span>
                </div>
              )}

              {effectiveTravelHours > 0 && activePkg && (
                <p className="text-xs text-slate-500">
                  Travel time will be set to <span className="font-semibold">{effectiveTravelHours}h</span> when applying the package.
                </p>
              )}
            </div>
          )}
        </div>

        {hasExistingLaborCharge && (
          <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
            A Moving Labor charge already exists on this quote. Applying a package will create an additional charge — edit or remove the existing one first if needed.
          </p>
        )}
      </div>
    </div>
  )
}

// ── Package card ──────────────────────────────────────────────────────────────

function PackageCard({
  pkg,
  moveDate,
  label,
  labelColor,
  isSelected,
  onSelect,
  onApply,
  hasExistingCharge,
}: {
  pkg: PackageName
  moveDate: string | null
  label: string
  labelColor: string
  isSelected: boolean
  onSelect: () => void
  onApply: () => void
  hasExistingCharge: boolean
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
          <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', labelColor)}>
            {label}
          </span>
          <p className="mt-1.5 text-base font-bold text-slate-950">{p.name} Package</p>
        </div>
        <div className={cn(
          'flex h-5 w-5 items-center justify-center rounded-full border-2',
          isSelected ? 'border-kratos' : 'border-slate-300',
        )}>
          {isSelected && <div className="h-2.5 w-2.5 rounded-full bg-kratos" />}
        </div>
      </div>

      <div className="space-y-1.5 text-xs text-slate-600">
        <div className="flex items-center gap-1.5">
          <Truck size={12} className="text-slate-400" />
          <span>{p.numTrucks} truck</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Users size={12} className="text-slate-400" />
          <span>{p.numCrew} movers</span>
        </div>
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
        {hasExistingCharge ? 'Add as Additional Charge' : 'Apply Package'}
      </button>
    </div>
  )
}
