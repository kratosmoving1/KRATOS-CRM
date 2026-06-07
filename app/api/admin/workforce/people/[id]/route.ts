import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const ALLOWED = ['name', 'role', 'status_id', 'tier_id', 'tenure_started_at', 'referred_by', 'column_id', 'position', 'notes']

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const payload = Object.fromEntries(Object.entries(body).filter(([k]) => ALLOWED.includes(k)))
  if (Object.keys(payload).length === 0) return NextResponse.json({ error: 'No valid fields' }, { status: 400 })

  const { data, error } = await supabase
    .from('workforce_people')
    .update(payload)
    .eq('id', params.id)
    .neq('is_deleted', true)
    .select('id, name, role, status_id, tier_id, tenure_started_at, referred_by, column_id, position, notes')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('workforce_people')
    .update({ is_deleted: true, deleted_at: new Date().toISOString() })
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
