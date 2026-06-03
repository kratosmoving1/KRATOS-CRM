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
  appliedChargeConfig: Record<string, unknown> | null | undefined
  onApplied?: () => void
}

export function PackageTierCards({
  opportunityId,
  moveSize,
  moveDate,
  appliedChargeConfig,
  onApplied,
}: Props) {
  const recommendedId = recommendTier(moveSize)
  const appliedId = detectAppliedTier(appliedChargeConfig)
  const [applyingId, setApplyingId] = useState<PackageTierId | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Compute isWeekend once (same date for all tiers)
  const { isWeekend } = getRateForDate(PACKAGE_TIERS[0], moveDate)

  const handleApply = async (tierId: PackageTierId) => {
    setApplyingId(tierId)
    setError(null)
    try {
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
        setError(j.error ?? 'Failed to apply package')
        return
      }
      onApplied?.()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Network error')
    } finally {
      setApplyingId(null)
    }
  }

  return (
    <section className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-500" />
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
            Package Recommendation
          </h3>
        </div>
        {isWeekend && (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
            Weekend / Peak rate
          </span>
        )}
      </div>

      {/* 4-card grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {PACKAGE_TIERS.map(tier => {
          const isRecommended = tier.id === recommendedId
          const isApplied = tier.id === appliedId
          const { rate } = getRateForDate(tier, moveDate)
          const Icon = tier.icon

          const borderClass = isApplied
            ? `${tier.theme.border_applied} ring-2 ring-offset-1 ${tier.theme.border_applied.replace('border-', 'ring-')}`
            : isRecommended
            ? tier.theme.border_recommended
            : tier.theme.border

          return (
            <article
              key={tier.id}
              className={`relative rounded-xl border-2 p-4 ${tier.theme.bg} ${borderClass} flex flex-col`}
            >
              {/* Tier label + status badge */}
              <div className="flex items-center justify-between mb-2">
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ${tier.theme.badge_bg} ${tier.theme.badge_text}`}
                >
                  <Icon className="w-3 h-3" />
                  {tier.label}
                </span>
                {isApplied && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700">
                    <Check className="w-3 h-3" />
                    Applied
                  </span>
                )}
                {!isApplied && isRecommended && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-700">
                    Recommended
                  </span>
                )}
              </div>

              {/* Description */}
              <p className="text-xs text-slate-600 mb-3">{tier.description}</p>

              {/* Rate */}
              <div className="mb-4">
                <p className={`text-2xl font-bold ${tier.theme.accent_text}`}>
                  ${rate.toFixed(2)}
                  <span className="text-sm font-normal text-slate-500">/hr</span>
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isWeekend ? 'Weekend Rate' : 'Weekday Rate'}
                </p>
              </div>

              {/* Crew breakdown */}
              <div className="text-xs text-slate-600 mb-4 space-y-0.5">
                <p>
                  {tier.num_trucks === 0
                    ? 'No truck (labour only)'
                    : `${tier.num_trucks} truck${tier.num_trucks > 1 ? 's' : ''}`}
                </p>
                <p>{tier.num_crew} movers</p>
              </div>

              {/* Apply button */}
              <button
                type="button"
                onClick={() => handleApply(tier.id)}
                disabled={applyingId !== null || isApplied}
                className={`mt-auto w-full px-3 py-2 rounded-lg text-sm font-semibold text-white transition-colors ${
                  isApplied
                    ? 'bg-green-600 cursor-default'
                    : `${tier.theme.button_bg} ${tier.theme.button_bg_hover} disabled:opacity-50`
                }`}
              >
                {applyingId === tier.id
                  ? 'Applying...'
                  : isApplied
                  ? 'Applied'
                  : 'Apply'}
              </button>
            </article>
          )
        })}
      </div>

      {/* Footer notices */}
      {appliedId && (
        <p className="mt-3 text-xs text-slate-500">
          Applying a different package will update the existing Moving Labor charge.
        </p>
      )}
      {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
    </section>
  )
}
