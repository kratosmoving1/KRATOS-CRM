import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const ALLOWED = [
  'name', 'role', 'role_id', 'location_id', 'status_id', 'tier_id',
  'english_proficiency', 'profile_picture_url',
  'tenure_started_at', 'referred_by',
  'column_id', 'position', 'notes',
  'email', 'phone',
]

const NULLABLE_KEYS = [
  'role', 'role_id', 'location_id', 'status_id', 'tier_id',
  'english_proficiency', 'profile_picture_url',
  'tenure_started_at', 'referred_by', 'column_id', 'notes',
  'email', 'phone',
]

function coercePayload(obj: Record<string, unknown>) {
  for (const key of NULLABLE_KEYS) {
    if (obj[key] === '') obj[key] = null
  }
  return obj
}

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const columnId = searchParams.get('column_id')

  let query = supabase
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
    .neq('is_deleted', true)
    .order('position', { ascending: true })

  if (columnId) query = query.eq('column_id', columnId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const name = String(body.name ?? '').trim()
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  // Build insert payload from allowlist, then coerce empty strings to null
  const filtered = Object.fromEntries(
    Object.entries(body).filter(([k, v]) => ALLOWED.includes(k) && v !== undefined)
  )
  coercePayload(filtered)
  filtered.name = name

  // Auto-assign position within target column
  const column_id: string | null = (filtered.column_id as string | null) ?? null
  const { data: maxRow } = await supabase
    .from('workforce_people')
    .select('position')
    .is('column_id', column_id)
    .neq('is_deleted', true)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()

  filtered.position = (maxRow?.position ?? -1) + 1
  filtered.created_by = user.id

  const { data, error } = await supabase
    .from('workforce_people')
    .insert(filtered)
    .select(`
      id, name, role, role_id, location_id, english_proficiency, profile_picture_url,
      status_id, tier_id, tenure_started_at, referred_by, column_id, position, notes,
      email, phone, profile_id,
      status:workforce_statuses(id,key,label,color,position),
      tier:workforce_tiers(id,key,label,color,position),
      role_data:workforce_roles(id,key,label,color,position),
      location:workforce_locations(id,key,label,color,position)
    `)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
