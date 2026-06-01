import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireActiveProfile } from '@/lib/auth/server'

export async function GET(_req: NextRequest) {
  const supabase = createClient()
  const auth = await requireActiveProfile(supabase)
  if (auth.response) return auth.response

  const { data, error } = await supabase
    .from('tariff_profiles')
    .select('*')
    .eq('is_deleted', false)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const auth = await requireActiveProfile(supabase)
  if (auth.response) return auth.response

  const body = await req.json().catch(() => ({}))
  const { name, service_type, min_booking_amount } = body

  if (!name?.trim()) {
    return NextResponse.json({ error: 'Tariff name is required.' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('tariff_profiles')
    .insert({
      name: name.trim(),
      service_type: service_type ?? 'local',
      min_booking_amount: Number(min_booking_amount ?? 0),
      is_active: true,
      created_by: auth.context!.profile.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
