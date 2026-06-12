import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const input = req.nextUrl.searchParams.get('input')?.trim()
  if (!input || input.length < 2) return NextResponse.json({ predictions: [] })

  const apiKey = process.env.GOOGLE_MAPS_SERVER_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Maps API key not configured' }, { status: 500 })

  const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
    },
    body: JSON.stringify({
      input,
      includedRegionCodes: ['ca'],
      includedPrimaryTypes: ['street_address', 'route'],
    }),
  })

  const data = await res.json()

  if (!res.ok) {
    return NextResponse.json({ error: data.error?.message ?? 'Places API error' }, { status: 500 })
  }

  // Normalize to the shape the client expects
  const predictions = (data.suggestions ?? []).map((s: {
    placePrediction: {
      placeId: string
      text: { text: string }
      structuredFormat: { mainText: { text: string }; secondaryText?: { text: string } }
    }
  }) => {
    const p = s.placePrediction
    return {
      place_id: p.placeId,
      description: p.text.text,
      structured_formatting: {
        main_text: p.structuredFormat.mainText.text,
        secondary_text: p.structuredFormat.secondaryText?.text ?? '',
      },
    }
  })

  return NextResponse.json({ predictions })
}
