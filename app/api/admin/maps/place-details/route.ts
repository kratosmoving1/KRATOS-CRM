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

  const url = new URL('https://maps.googleapis.com/maps/api/place/details/json')
  url.searchParams.set('place_id', placeId)
  url.searchParams.set('key', apiKey)
  url.searchParams.set('fields', 'address_components,formatted_address')

  const res = await fetch(url.toString())
  const data = await res.json()

  if (data.status === 'REQUEST_DENIED') {
    return NextResponse.json({ error: `Places API denied: ${data.error_message ?? data.status}` }, { status: 500 })
  }

  return NextResponse.json(data.result ?? null)
}
