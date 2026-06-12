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

  const url = new URL('https://maps.googleapis.com/maps/api/place/autocomplete/json')
  url.searchParams.set('input', input)
  url.searchParams.set('key', apiKey)
  url.searchParams.set('components', 'country:ca')
  url.searchParams.set('types', 'address')

  const res = await fetch(url.toString())
  const data = await res.json()

  if (data.status === 'REQUEST_DENIED') {
    return NextResponse.json({ error: `Places API denied: ${data.error_message ?? data.status}` }, { status: 500 })
  }

  return NextResponse.json({ predictions: data.predictions ?? [] })
}
