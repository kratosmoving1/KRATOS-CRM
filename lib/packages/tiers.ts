import type { LucideIcon } from 'lucide-react'
import { Wrench, Truck, Crown, Gem } from 'lucide-react'

export type PackageTierId = 'bronze' | 'silver' | 'gold' | 'platinum'

export interface PackageTier {
  id: PackageTierId
  label: string
  description: string
  icon: LucideIcon
  num_trucks: number
  num_crew: number
  weekday_rate: number
  weekend_rate: number
  /** Move sizes this tier is the recommended default for */
  recommended_for: string[]
  /** Tailwind color theme — all classes written literally so Tailwind JIT picks them up */
  theme: {
    bg: string
    bg_hover: string
    border: string
    icon: string
    title: string
    muted: string
  }
}

export const PACKAGE_TIERS: PackageTier[] = [
  {
    id: 'bronze',
    label: 'Bronze',
    description: 'Labour only — customer provides truck',
    icon: Wrench,
    num_trucks: 0,
    num_crew: 2,
    weekday_rate: 129.99,
    weekend_rate: 139.99,
    recommended_for: ['few_items'],
    theme: {
      bg: 'bg-amber-200',
      bg_hover: 'hover:bg-amber-300',
      border: 'border-amber-400',
      icon: 'text-amber-800',
      title: 'text-amber-950',
      muted: 'text-amber-800',
    },
  },
  {
    id: 'silver',
    label: 'Silver',
    description: '1 truck, 2 movers',
    icon: Truck,
    num_trucks: 1,
    num_crew: 2,
    weekday_rate: 189.99,
    weekend_rate: 199.99,
    recommended_for: [
      'studio_apartment',
      '1_bedroom_apartment',
      'partial',
      'storage_5x5',
      'storage_5x10',
      // legacy values
      'studio',
      '1_bedroom',
      'storage',
    ],
    theme: {
      bg: 'bg-slate-300',
      bg_hover: 'hover:bg-slate-400',
      border: 'border-slate-500',
      icon: 'text-slate-800',
      title: 'text-slate-950',
      muted: 'text-slate-700',
    },
  },
  {
    id: 'gold',
    label: 'Gold',
    description: '1 truck, 3 movers',
    icon: Crown,
    num_trucks: 1,
    num_crew: 3,
    weekday_rate: 229.99,
    weekend_rate: 239.99,
    recommended_for: [
      '2_bedroom_apartment',
      '3_bedroom_apartment',
      '1_bedroom_house',
      '2_bedroom_house',
      '3_bedroom_house',
      'small_office',
      'medium_office',
      'storage_10x10',
      'storage_10x15',
      'pod',
      // legacy values
      '2_bedroom',
      '3_bedroom',
      'office',
    ],
    theme: {
      bg: 'bg-yellow-300',
      bg_hover: 'hover:bg-yellow-400',
      border: 'border-yellow-500',
      icon: 'text-yellow-900',
      title: 'text-yellow-950',
      muted: 'text-yellow-800',
    },
  },
  {
    id: 'platinum',
    label: 'Platinum',
    description: '1 truck, 4 movers',
    icon: Gem,
    num_trucks: 1,
    num_crew: 4,
    weekday_rate: 259.99,
    weekend_rate: 269.99,
    recommended_for: [
      '4_bedroom_apartment',
      '4_bedroom_house',
      '5_bedroom_house_plus',
      'large_office',
      'storage_10x20',
      'storage_10x25',
      'storage_10x30',
      // legacy values
      '4_bedroom',
      '5_bedroom_plus',
    ],
    theme: {
      bg: 'bg-indigo-200',
      bg_hover: 'hover:bg-indigo-300',
      border: 'border-indigo-400',
      icon: 'text-indigo-800',
      title: 'text-indigo-950',
      muted: 'text-indigo-700',
    },
  },
]

/**
 * Returns the rate for a tier given a date.
 * Parses date as local (not UTC) to avoid timezone-day-shift bugs.
 */
export function getRateForDate(
  tier: PackageTier,
  date: Date | string | null | undefined,
): { rate: number; isWeekend: boolean } {
  if (!date) return { rate: tier.weekday_rate, isWeekend: false }
  let day: number
  if (typeof date === 'string') {
    const [year, month, d] = date.split('-').map(Number)
    day = new Date(year, month - 1, d).getDay()
  } else {
    day = date.getDay()
  }
  const isWeekend = day === 0 || day === 6
  return { rate: isWeekend ? tier.weekend_rate : tier.weekday_rate, isWeekend }
}

/** Picks the recommended tier for a given move size. Falls back to Silver if no match. */
export function recommendTier(moveSize: string | null | undefined): PackageTierId {
  if (!moveSize) return 'silver'
  for (const tier of PACKAGE_TIERS) {
    if (tier.recommended_for.includes(moveSize)) return tier.id
  }
  return 'silver'
}

/**
 * Given the config stored on the existing Moving Labor charge, find which
 * PACKAGE_TIERS entry it matches — first by config.tier_id, then by num_trucks + num_crew.
 */
export function detectAppliedTier(
  config: Record<string, unknown> | null | undefined,
): PackageTierId | null {
  if (!config) return null
  if (config.tier_id) {
    const byId = PACKAGE_TIERS.find(t => t.id === config.tier_id)
    if (byId) return byId.id
  }
  const match = PACKAGE_TIERS.find(
    t => t.num_trucks === Number(config.num_trucks) && t.num_crew === Number(config.num_crew),
  )
  return match?.id ?? null
}

export function getTier(id: PackageTierId): PackageTier {
  return PACKAGE_TIERS.find(t => t.id === id)!
}
