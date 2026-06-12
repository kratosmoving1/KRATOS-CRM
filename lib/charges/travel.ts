import { KRATOS_DISPATCH_ADDRESS } from '@/lib/constants/company'

/** Below this threshold for either leg, travel is absorbed into labor. No separate charge. */
export const TRAVEL_THRESHOLD_MINUTES = 30

/**
 * Compute billable travel hours from the longer travel leg.
 * Returns 0 if under the threshold.
 * Floors to nearest 0.5h (rounds DOWN).
 */
export function computeBillableTravelHours(longerLegMinutes: number): number {
  if (longerLegMinutes < TRAVEL_THRESHOLD_MINUTES) return 0
  return Math.floor(longerLegMinutes / 30) * 0.5
}

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

export function buildOriginAddress(opp: Record<string, unknown>): string | null {
  if (!opp.origin_address_line1 && !opp.origin_city) return null
  const parts = [
    opp.origin_address_line1,
    opp.origin_city,
    opp.origin_province,
    opp.origin_postal_code,
  ].filter(Boolean) as string[]
  return parts.join(', ') || null
}

async function callDistanceMatrix(origin: string, destination: string): Promise<number | null> {
  const apiKey =
    process.env.GOOGLE_MAPS_SERVER_API_KEY ||
    process.env.GOOGLE_MAPS_SERVER_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

  if (!apiKey) {
    console.warn('[travel] No Google Maps API key configured')
    return null
  }

  try {
    const params = new URLSearchParams({ origins: origin, destinations: destination, mode: 'driving', key: apiKey })
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
    console.warn('[travel] callDistanceMatrix error:', err)
    return null
  }
}

/** Return-leg: destination → dispatch */
export async function fetchReturnDriveMinutes(destinationAddress: string): Promise<number | null> {
  return callDistanceMatrix(destinationAddress, KRATOS_DISPATCH_ADDRESS)
}

/**
 * Fetch both legs in parallel and return the longer one.
 * Uses whichever is longer: dispatch→origin (outbound) OR destination→dispatch (return).
 * This ensures jobs where dest = dispatch still generate a travel charge for the outbound leg.
 */
export async function fetchLongerTravelLegMinutes(
  originAddress: string | null,
  destinationAddress: string | null,
): Promise<{ minutes: number | null; leg: 'outbound' | 'return' | null }> {
  const [outbound, returnLeg] = await Promise.all([
    originAddress ? callDistanceMatrix(KRATOS_DISPATCH_ADDRESS, originAddress) : Promise.resolve(null),
    destinationAddress ? callDistanceMatrix(destinationAddress, KRATOS_DISPATCH_ADDRESS) : Promise.resolve(null),
  ])

  if (outbound == null && returnLeg == null) return { minutes: null, leg: null }
  if (outbound == null) return { minutes: returnLeg, leg: 'return' }
  if (returnLeg == null) return { minutes: outbound, leg: 'outbound' }
  return outbound >= returnLeg
    ? { minutes: outbound, leg: 'outbound' }
    : { minutes: returnLeg, leg: 'return' }
}
