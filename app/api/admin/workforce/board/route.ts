import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [colRes, peopleRes, statusRes, tierRes, roleRes, locationRes] = await Promise.all([
    supabase
      .from('workforce_columns')
      .select('id, name, position, color')
      .neq('is_deleted', true)
      .order('position', { ascending: true }),
    supabase
      .from('workforce_people')
      .select(`
        id, name, role, role_id, location_id, english_proficiency, profile_picture_url,
        status_id, tier_id, tenure_started_at, referred_by, column_id, position, notes,
        email, phone, profile_id,
        status:workforce_statuses(id,key,label,color,position),
        tier:workforce_tiers(id,key,label,color,position),
        role_data:workforce_roles(id,key,label,color,position),
        location:workforce_locations(id,key,label,color,position)
      `)
      .not('is_deleted', 'is', true)
      .order('position', { ascending: true }),
    supabase
      .from('workforce_statuses')
      .select('id, key, label, color, position')
      .neq('is_deleted', true)
      .order('position', { ascending: true }),
    supabase
      .from('workforce_tiers')
      .select('id, key, label, color, position')
      .neq('is_deleted', true)
      .order('position', { ascending: true }),
    supabase
      .from('workforce_roles')
      .select('id, key, label, color, position')
      .neq('is_deleted', true)
      .order('position', { ascending: true }),
    supabase
      .from('workforce_locations')
      .select('id, key, label, color, position')
      .neq('is_deleted', true)
      .order('position', { ascending: true }),
  ])

  return NextResponse.json({
    columns: colRes.data ?? [],
    people: peopleRes.data ?? [],
    statuses: statusRes.data ?? [],
    tiers: tierRes.data ?? [],
    roles: roleRes.data ?? [],
    locations: locationRes.data ?? [],
  })
}
