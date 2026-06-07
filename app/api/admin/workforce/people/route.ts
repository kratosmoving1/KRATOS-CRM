import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const columnId = searchParams.get('column_id')

  let query = supabase
    .from('workforce_people')
    .select('id, name, role, status_id, tier_id, tenure_started_at, referred_by, column_id, position, notes, status:workforce_statuses(id,key,label,color,position), tier:workforce_tiers(id,key,label,color,position)')
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

  const column_id: string | null = body.column_id ?? null

  const { data: maxRow } = await supabase
    .from('workforce_people')
    .select('position')
    .eq('column_id', column_id as string)
    .neq('is_deleted', true)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()

  const position = (maxRow?.position ?? -1) + 1

  const { data, error } = await supabase
    .from('workforce_people')
    .insert({
      name,
      role: body.role ?? null,
      status_id: body.status_id ?? null,
      tier_id: body.tier_id ?? null,
      column_id,
      position,
      notes: body.notes ?? null,
      created_by: user.id,
    })
    .select('id, name, role, status_id, tier_id, tenure_started_at, referred_by, column_id, position, notes')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
