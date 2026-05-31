/**
 * Kratos CRM — Tariff & Package definitions (local moves).
 *
 * This file is the single source of truth for package rates.
 * Long-distance, interprovincial, and international are flagged as
 * "manual tariff required" and excluded from auto-recommendation.
 *
 * Extension point: when DB-driven tariffs are added (tariff_packages table),
 * replace TARIFF_PACKAGES with a DB fetch and keep this file as the fallback.
 */

// ── Package definitions ──────────────────────────────────────────────────────

export type PackageName = 'silver' | 'gold'

export interface TariffPackage {
  id: PackageName
  name: string            // Display name
  numTrucks: number
  numCrew: number
  weekdayRate: number     // Mon–Fri, non-peak
  weekendRate: number     // Sat, Sun, holidays/peak days
  description: string
  badge: string           // Short badge text for UI
}

export const TARIFF_PACKAGES: Record<PackageName, TariffPackage> = {
  silver: {
    id: 'silver',
    name: 'Silver',
    numTrucks: 1,
    numCrew: 2,
    weekdayRate: 189.99,
    weekendRate: 199.99,
    description: 'Best for studio to 1-bedroom moves. Light to moderate inventory.',
    badge: '1 truck · 2 movers',
  },
  gold: {
    id: 'gold',
    name: 'Gold',
    numTrucks: 1,
    numCrew: 3,
    weekdayRate: 229.99,
    weekendRate: 239.99,
    description: 'Best for 2-bedroom+ moves, heavy inventory, or stairs/access challenges.',
    badge: '1 truck · 3 movers',
  },
} as const

// ── Move size → package recommendation ──────────────────────────────────────

export interface PackageRecommendation {
  primary: PackageName
  alternative: PackageName | null
  note: string | null
}

/**
 * Recommends a package based on move size.
 * Returns null if move size is unknown (agent must choose manually).
 * Returns null for non-local service types (manual tariff required).
 */
export function recommendPackage(moveSize: string | null | undefined): PackageRecommendation | null {
  if (!moveSize) return null

  switch (moveSize) {
    // Studio / small apartments → Silver only
    case 'studio':
    case 'studio_apartment':
      return { primary: 'silver', alternative: null, note: null }

    // 1 bedroom → Silver only
    case '1_bedroom':
    case '1_bedroom_apartment':
    case '1_bedroom_house':
      return { primary: 'silver', alternative: null, note: null }

    // 2 bedroom apartment — Silver primary, Gold alternative
    case '2_bedroom':
    case '2_bedroom_apartment':
      return {
        primary: 'silver',
        alternative: 'gold',
        note: '2-bedroom apartments typically fit Silver. Upgrade to Gold if stairs, elevator wait times, or heavy furniture exist.',
      }

    // 2 bedroom house — Gold primary, Silver alternative
    case '2_bedroom_house':
      return {
        primary: 'gold',
        alternative: 'silver',
        note: '2-bedroom houses typically need Gold. Silver works if inventory is light and access is easy.',
      }

    // 3 bedroom → Gold only
    case '3_bedroom':
    case '3_bedroom_apartment':
    case '3_bedroom_house':
      return { primary: 'gold', alternative: null, note: null }

    // 4 bedroom+ → Gold with flag for manual review
    case '4_bedroom':
    case '4_bedroom_apartment':
    case '4_bedroom_house':
    case '5_bedroom_plus':
    case '5_bedroom_house_plus':
      return {
        primary: 'gold',
        alternative: null,
        note: '4+ bedrooms: Gold package recommended. For very large moves, consider a 2-truck setup — flag for operations review.',
      }

    // Office / storage — Gold as conservative default
    case 'office':
      return {
        primary: 'gold',
        alternative: 'silver',
        note: 'Office moves: Gold recommended for heavier furniture and equipment. Confirm inventory before finalizing.',
      }

    case 'storage':
      return { primary: 'silver', alternative: 'gold', note: 'Storage unit moves vary. Confirm inventory size before selecting package.' }

    default:
      // Unknown size — let agent choose
      return { primary: 'silver', alternative: 'gold', note: 'Move size not recognized — please select the appropriate package manually.' }
  }
}

// ── Date → rate type ─────────────────────────────────────────────────────────

/**
 * Returns true if the move date falls on a weekend or peak day.
 * Extension point: admin-defined peak dates table can override this later.
 */
export function isWeekendOrPeak(moveDate: string | null | undefined): boolean {
  if (!moveDate) return false
  // Parse as local date (not UTC) to avoid timezone shift
  const [year, month, day] = moveDate.split('-').map(Number)
  const d = new Date(year, month - 1, day)
  const dow = d.getDay()
  return dow === 0 || dow === 6 // Sunday = 0, Saturday = 6
}

export function getRateForDate(pkg: PackageName, moveDate: string | null | undefined): number {
  const p = TARIFF_PACKAGES[pkg]
  return isWeekendOrPeak(moveDate) ? p.weekendRate : p.weekdayRate
}

export function getDateRateLabel(moveDate: string | null | undefined): 'weekday' | 'weekend' {
  return isWeekendOrPeak(moveDate) ? 'weekend' : 'weekday'
}

// ── Distance → return travel recommendation ──────────────────────────────────

export interface TravelRecommendation {
  returnHours: number
  requiresManualReview: boolean
  note: string
}

/**
 * Recommends return travel hours based on pickup-to-dropoff distance.
 * ≤ 40 km: no surcharge
 * 41–60 km: 0.5h return
 * 61–90 km: 1.0h return
 * 91–130 km: 1.5h return
 * 131+ km: manual review required
 */
export function recommendReturnTravel(distanceKm: number | null | undefined): TravelRecommendation {
  if (!distanceKm || distanceKm <= 0) {
    return { returnHours: 0, requiresManualReview: false, note: 'Enter distance to calculate return travel.' }
  }
  if (distanceKm <= 40) {
    return { returnHours: 0, requiresManualReview: false, note: `${distanceKm} km — door-to-door billing, no return travel surcharge.` }
  }
  if (distanceKm <= 60) {
    return { returnHours: 0.5, requiresManualReview: false, note: `${distanceKm} km — recommend 0.5h return travel.` }
  }
  if (distanceKm <= 90) {
    return { returnHours: 1.0, requiresManualReview: false, note: `${distanceKm} km — recommend 1.0h return travel.` }
  }
  if (distanceKm <= 130) {
    return { returnHours: 1.5, requiresManualReview: false, note: `${distanceKm} km — recommend 1.5h return travel.` }
  }
  return {
    returnHours: 0,
    requiresManualReview: true,
    note: `${distanceKm} km exceeds 130 km — return travel requires manual review. Contact operations.`,
  }
}

// ── Service type check ───────────────────────────────────────────────────────

export type TariffEligibility =
  | { eligible: true; serviceType: string }
  | { eligible: false; reason: string }

/**
 * Checks whether a service type supports automatic tariff recommendation.
 * Only local moves are auto-recommended for now.
 */
export function checkTariffEligibility(serviceType: string | null | undefined): TariffEligibility {
  if (!serviceType) return { eligible: false, reason: 'Service type not selected.' }
  if (serviceType === 'local') return { eligible: true, serviceType }
  return {
    eligible: false,
    reason: `${serviceType.replace(/_/g, ' ')} moves require a manual tariff. Contact operations for pricing.`,
  }
}
