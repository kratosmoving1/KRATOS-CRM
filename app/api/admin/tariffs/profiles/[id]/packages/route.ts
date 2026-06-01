import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireActiveProfile } from '@/lib/auth/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createClient()
  const auth = await requireActiveProfile(supabase)
  if (auth.response) return auth.response

  const { data, error } = await supabase
    .from('tariff_packages')
    .select('*')
    .eq('profile_id', params.id)
    .eq('is_deleted', false)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createClient()
  const auth = await requireActiveProfile(supabase)
  if (auth.response) return auth.response

  const body = await req.json().catch(() => ({}))
  const { name, description, num_trucks, num_crew, weekday_rate, weekend_rate, minimum_hours } = body

  if (!name?.trim()) {
    return NextResponse.json({ error: 'Package name is required.' }, { status: 400 })
  }

  // Get current max sort_order to append at end
  const { data: existing } = await supabase
    .from('tariff_packages')
    .select('sort_order')
    .eq('profile_id', params.id)
    .eq('is_deleted', false)
    .order('sort_order', { ascending: false })
    .limit(1)

  const nextSort = ((existing?.[0]?.sort_order ?? 0) as number) + 1

  const { data, error } = await supabase
    .from('tariff_packages')
    .insert({
      profile_id: params.id,
      name: name.trim(),
      description: description?.trim() || null,
      num_trucks: Number(num_trucks ?? 1),
      num_crew: Number(num_crew ?? 2),
      weekday_rate: Number(weekday_rate ?? 0),
      weekend_rate: Number(weekend_rate ?? 0),
      minimum_hours: Number(minimum_hours ?? 3),
      is_active: true,
      sort_order: nextSort,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
