'use client'

import { useState } from 'react'
import { Check, Sparkles } from 'lucide-react'
import {
  PACKAGE_TIERS,
  getRateForDate,
  recommendTier,
  detectAppliedTier,
  type PackageTierId,
} from '@/lib/packages/tiers'

interface Props {
  opportunityId: string
  moveSize: string | null | undefined
  moveDate: string | null | undefined
  /** ID of the existing Moving Labor charge row (null if none applied) */
  appliedChargeId: string | null
  /** config object from the existing Moving Labor charge (null if none applied) */
  appliedChargeConfig: Record<string, unknown> | null
  onChanged?: () => void
}

export function PackageTierCards({
  opportunityId,
  moveSize,
  moveDate,
  appliedChargeId,
  appliedChargeConfig,
  onChanged,
}: Props) {
  const recommendedId = recommendTier(moveSize)
  const appliedId = detectAppliedTier(appliedChargeConfig)
  const [busyId, setBusyId] = useState<PackageTierId | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { isWeekend } = getRateForDate(PACKAGE_TIERS[0], moveDate)

  const handleCardClick = async (tierId: PackageTierId) => {
    if (busyId) return
    setError(null)
    setBusyId(tierId)
    try {
      if (appliedId === tierId && appliedChargeId) {
        // Toggle off — soft-delete the existing Moving Labor charge
        const res = await fetch(
          `/api/admin/opportunities/${opportunityId}/charges/${appliedChargeId}`,
          { method: 'DELETE' },
        )
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          throw new Error(j.error ?? 'Failed to remove package')
        }
      } else {
        // Apply (or switch) — create/update Moving Labor charge to this tier
        const res = await fetch(
          `/api/admin/opportunities/${opportunityId}/apply-package`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tier_id: tierId }),
          },
        )
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          throw new Error(j.error ?? 'Failed to apply package')
        }
      }
      onChanged?.()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Network error')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="bg-white rounded-lg border border-slate-200 p-4 mb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-500" />
          <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
            Package Recommendation
          </h3>
        </div>
        {isWeekend && (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
            Weekend / Peak rate
          </span>
        )}
      </div>

      {/* 4-card grid — extra top padding so ribbons don't clip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 pt-4">
        {PACKAGE_TIERS.map(tier => {
          const isRecommended = tier.id === recommendedId
          const isApplied = tier.id === appliedId
          const isBusy = busyId === tier.id
          const { rate } = getRateForDate(tier, moveDate)
          const Icon = tier.icon

          const stateRing = isApplied
            ? 'ring-4 ring-green-500 ring-offset-2'
            : isRecommended
            ? 'ring-4 ring-orange-400 ring-offset-2'
            : ''

          const interactivity = isBusy
            ? 'opacity-70 cursor-wait'
            : 'cursor-pointer hover:scale-[1.03] hover:shadow-lg active:scale-[0.98]'

          return (
            <button
              key={tier.id}
              type="button"
              onClick={() => handleCardClick(tier.id)}
              disabled={!!busyId}
              aria-pressed={isApplied}
              className={`group relative rounded-xl border-2 p-5 flex flex-col text-left transition-all duration-200 ${tier.theme.bg} ${tier.theme.bg_hover} ${tier.theme.border} ${stateRing} ${interactivity}`}
            >
              {/* RECOMMENDED ribbon */}
              {isRecommended && !isApplied && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-orange-500 text-white text-[10px] font-bold rounded-full shadow uppercase tracking-wider whitespace-nowrap">
                  ✨ Recommended
                </div>
              )}

              {/* SELECTED ribbon */}
              {isApplied && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-green-600 text-white text-[10px] font-bold rounded-full shadow uppercase tracking-wider inline-flex items-center gap-1 whitespace-nowrap">
                  <Check className="w-2.5 h-2.5" />
                  Selected
                </div>
              )}

              {/* Icon + name */}
              <div className="flex items-center gap-2 mb-3 mt-1">
                <Icon className={`w-5 h-5 ${tier.theme.icon}`} />
                <h4 className={`text-lg font-bold ${tier.theme.title}`}>{tier.label}</h4>
              </div>

              {/* Description */}
              <p className={`text-xs ${tier.theme.muted} mb-4 leading-snug`}>
                {tier.description}
              </p>

              {/* Rate */}
              <div className="mb-4">
                <p className={`text-3xl font-bold ${tier.theme.title}`}>
                  ${rate.toFixed(2)}
                  <span className="text-sm font-normal ml-1">/hr</span>
                </p>
                <p className={`text-xs ${tier.theme.muted} mt-0.5`}>
                  {isWeekend ? 'Weekend Rate' : 'Weekday Rate'}
                </p>
              </div>

              {/* Crew breakdown */}
              <div className={`text-sm ${tier.theme.title} space-y-1 mb-4`}>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60 shrink-0" />
                  {tier.num_trucks === 0
                    ? 'No truck (labour only)'
                    : `${tier.num_trucks} truck${tier.num_trucks > 1 ? 's' : ''}`}
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60 shrink-0" />
                  {tier.num_crew} movers
                </div>
              </div>

              {/* Status hint at card bottom */}
              <div className={`mt-auto pt-2 text-xs font-semibold ${tier.theme.muted} border-t ${tier.theme.border} border-opacity-40`}>
                {isBusy
                  ? 'Working...'
                  : isApplied
                  ? '✓ Click again to remove'
                  : 'Click to select'}
              </div>
            </button>
          )
        })}
      </div>

      {error && <p className="mt-3 text-xs text-red-600 font-medium">{error}</p>}
    </section>
  )
}
