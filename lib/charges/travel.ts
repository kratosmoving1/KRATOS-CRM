import { KRATOS_DISPATCH_ADDRESS } from '@/lib/constants/company'

/** Below this return-drive threshold, door-to-door labor absorbs the travel. No separate charge. */
export const TRAVEL_THRESHOLD_MINUTES = 30

/**
 * Compute billable travel hours from the return-leg drive time.
 * Returns 0 if under the threshold.
 * Otherwise floors to the nearest 0.5h (rounds DOWN).
 *
 * Examples:
 *   25 min  → 0     (below threshold)
 *   30 min  → 0.5
 *   45 min  → 0.5
 *   60 min  → 1.0
 *   89 min  → 1.0
 *   90 min  → 1.5
 *   120 min → 2.0
 */
export function computeBillableTravelHours(returnDurationMinutes: number): number {
  if (returnDurationMinutes < TRAVEL_THRESHOLD_MINUTES) return 0
  return Math.floor(returnDurationMinutes / 30) * 0.5
}

/**
 * Build a Google Maps-compatible address string from opportunity dest fields.
 * Returns null if no usable address data.
 */
export function buildDestinationAddress(opp: Record<string, unknown>): string | null {
  if (!opp.dest_address_line1 && !opp.dest_city) return null
  const parts = [
    opp.dest_address_line1,
    opp.dest_city,
    opp.dest_province,
    opp.dest_postal_code,
  ].filter(Boolean) as string[]
  return parts.join(', ') || null
}

/**
 * Call Google Maps Distance Matrix directly (server-side only — key never reaches browser).
 * Returns drive time in minutes, or null on any failure.
 *
 * Checks GOOGLE_MAPS_SERVER_API_KEY first, then GOOGLE_MAPS_SERVER_KEY,
 * then falls back to the public key (which may fail for server-to-server calls).
 */
export async function fetchReturnDriveMinutes(destinationAddress: string): Promise<number | null> {
  const apiKey =
    process.env.GOOGLE_MAPS_SERVER_API_KEY ||
    process.env.GOOGLE_MAPS_SERVER_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

  if (!apiKey) {
    console.warn('[travel] No Google Maps API key configured')
    return null
  }

  try {
    const params = new URLSearchParams({
      origins:      destinationAddress,
      destinations: KRATOS_DISPATCH_ADDRESS,
      mode:         'driving',
      key:          apiKey,
    })
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/distancematrix/json?${params.toString()}`,
      { cache: 'no-store' },
    )
    if (!res.ok) return null
    const data = await res.json()
    if (data.status !== 'OK') {
      console.warn('[travel] Distance Matrix status:', data.status, data.error_message)
      return null
    }
    const element = data.rows?.[0]?.elements?.[0]
    if (!element || element.status !== 'OK') return null
    return Math.round(element.duration.value / 60)
  } catch (err) {
    console.warn('[travel] fetchReturnDriveMinutes error:', err)
    return null
  }
}
