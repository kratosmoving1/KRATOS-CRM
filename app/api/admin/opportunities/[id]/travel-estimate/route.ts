/**
 * Server-side travel time estimate using Google Maps Distance Matrix API.
 * The API key is never exposed to the client.
 *
 * Reads origin + destination from the opportunity record.
 * Falls back to static distance table if Google Maps is unavailable.
 *
 * Env vars (in priority order):
 *   GOOGLE_MAPS_SERVER_API_KEY — server-only key (preferred)
 *   NEXT_PUBLIC_GOOGLE_MAPS_API_KEY — fallback to existing public key
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireActiveProfile } from '@/lib/auth/server'
import { recommendReturnTravel } from '@/lib/tariff/packages'

type GoogleDistanceMatrixRow = {
  elements: Array<{
    status: string
    distance?: { value: number; text: string }
    duration?: { value: number; text: string }
  }>
}

type GoogleDistanceMatrixResponse = {
  status: string
  rows?: GoogleDistanceMatrixRow[]
  error_message?: string
}

function getApiKey(): string | null {
  return process.env.GOOGLE_MAPS_SERVER_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || null
}

function buildAddressString(parts: Array<string | null | undefined>): string {
  return parts.filter(Boolean).join(', ')
}

function minutesToBillableHours(minutes: number): number {
  // Round up to the nearest 0.5h for billing purposes
  return Math.ceil((minutes / 60) * 2) / 2
}

async function fetchGoogleMapsDistance(origin: string, destination: string, apiKey: string) {
  const params = new URLSearchParams({
    origins: origin,
    destinations: destination,
    mode: 'driving',
    key: apiKey,
  })

  const res = await fetch(
    `https://maps.googleapis.com/maps/api/distancematrix/json?${params.toString()}`,
    { cache: 'no-store' },
  )

  if (!res.ok) {
    throw new Error(`Google Maps API HTTP ${res.status}`)
  }

  const data = (await res.json()) as GoogleDistanceMatrixResponse

  if (data.status !== 'OK') {
    throw new Error(`Google Maps API error: ${data.status} — ${data.error_message ?? ''}`)
  }

  const element = data.rows?.[0]?.elements?.[0]
  if (!element || element.status !== 'OK' || !element.distance || !element.duration) {
    throw new Error(`No route found between the specified addresses.`)
  }

  const distanceMeters = element.distance.value
  const durationSeconds = element.duration.value

  return {
    distanceKm: Math.round((distanceMeters / 1000) * 10) / 10,
    driveTimeMinutes: Math.round(durationSeconds / 60),
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createClient()
  const auth = await requireActiveProfile(supabase)
  if (auth.response) return auth.response

  const { data: opp } = await supabase
    .from('opportunities')
    .select('id, origin_address_line1, origin_city, origin_province, origin_postal_code, dest_address_line1, dest_city, dest_province, dest_postal_code')
    .eq('id', params.id)
    .eq('is_deleted', false)
    .single()

  if (!opp) {
    return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
  }

  const originStr = buildAddressString([
    opp.origin_address_line1,
    opp.origin_city,
    opp.origin_province,
    opp.origin_postal_code,
  ])

  const destStr = buildAddressString([
    opp.dest_address_line1,
    opp.dest_city,
    opp.dest_province,
    opp.dest_postal_code,
  ])

  if (!originStr || !destStr) {
    return NextResponse.json({
      ok: false,
      reason: 'missing_addresses',
      message: 'Add origin and destination addresses to calculate travel time.',
    })
  }

  const apiKey = getApiKey()

  // ── Try Google Maps ───────────────────────────────────────────────────────
  if (apiKey) {
    try {
      const { distanceKm, driveTimeMinutes } = await fetchGoogleMapsDistance(originStr, destStr, apiKey)
      const driveTimeHours = Math.round((driveTimeMinutes / 60) * 100) / 100
      const travelRec = recommendReturnTravel(distanceKm)

      const recommendedBillableHours = travelRec.requiresManualReview
        ? null
        : minutesToBillableHours(driveTimeMinutes) + travelRec.returnHours

      return NextResponse.json({
        ok: true,
        provider: 'google_maps',
        distanceKm,
        driveTimeMinutes,
        driveTimeHours,
        // Direct drive time (one-way) as billable reference
        directDriveHours: minutesToBillableHours(driveTimeMinutes),
        // Return travel surcharge on top of direct drive
        returnTravelHours: travelRec.returnHours,
        // Total recommended billable travel (direct + return if > 40km)
        recommendedTravelHours: recommendedBillableHours,
        manualReviewRequired: travelRec.requiresManualReview,
        note: travelRec.note,
        origin: originStr,
        destination: destStr,
      }, { headers: { 'Cache-Control': 'no-store' } })
    } catch (err) {
      console.warn('[TravelEstimate] Google Maps failed, using fallback:', err instanceof Error ? err.message : err)
      // Fall through to static fallback
    }
  }

  // ── Static fallback — no Google Maps or API call failed ──────────────────
  // We can't compute distance without Maps, so return a prompt for manual entry
  return NextResponse.json({
    ok: false,
    provider: apiKey ? 'google_maps_failed' : 'not_configured',
    reason: apiKey ? 'google_maps_error' : 'no_api_key',
    message: apiKey
      ? 'Google Maps request failed. Enter travel time manually.'
      : 'Google Maps is not configured (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY not set). Enter travel time manually.',
    origin: originStr,
    destination: destStr,
  })
}
