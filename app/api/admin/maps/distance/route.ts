import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { origin, destination } = await req.json()
    if (!origin || !destination) {
      return NextResponse.json({ error: 'origin and destination required' }, { status: 400 })
    }

    const apiKey =
      process.env.GOOGLE_MAPS_SERVER_API_KEY ||
      process.env.GOOGLE_MAPS_SERVER_KEY ||
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

    if (!apiKey) {
      return NextResponse.json({ error: 'Maps service not configured' }, { status: 500 })
    }

    const params = new URLSearchParams({
      origins:      String(origin),
      destinations: String(destination),
      mode:         'driving',
      units:        'metric',
      key:          apiKey,
    })

    const res = await fetch(
      `https://maps.googleapis.com/maps/api/distancematrix/json?${params.toString()}`,
      { cache: 'no-store' },
    )
    const data = await res.json()

    if (data.status !== 'OK') {
      return NextResponse.json(
        { error: data.error_message || data.status },
        { status: 502 },
      )
    }

    const element = data.rows?.[0]?.elements?.[0]
    if (!element || element.status !== 'OK') {
      return NextResponse.json({ error: element?.status ?? 'NO_ROUTE' }, { status: 404 })
    }

    return NextResponse.json({
      duration_seconds: element.duration?.value ?? null,
      duration_text:    element.duration?.text ?? null,
      distance_meters:  element.distance?.value ?? null,
      distance_text:    element.distance?.text ?? null,
    })
  } catch (err) {
    console.error('[maps/distance] error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
