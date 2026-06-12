import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const placeId = req.nextUrl.searchParams.get('place_id')?.trim()
  if (!placeId) return NextResponse.json({ error: 'place_id required' }, { status: 400 })

  const apiKey = process.env.GOOGLE_MAPS_SERVER_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Maps API key not configured' }, { status: 500 })

  const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
    headers: {
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'id,formattedAddress,addressComponents',
    },
  })

  const data = await res.json()

  if (!res.ok) {
    return NextResponse.json({ error: data.error?.message ?? 'Places API error' }, { status: 500 })
  }

  // Normalize to legacy shape that AddressAutocomplete expects
  const address_components = (data.addressComponents ?? []).map((c: {
    longText: string
    shortText: string
    types: string[]
  }) => ({
    long_name: c.longText,
    short_name: c.shortText,
    types: c.types,
  }))

  return NextResponse.json({
    formatted_address: data.formattedAddress ?? '',
    address_components,
  })
}
