import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const ALLOWED = ['name', 'category', 'provider', 'size', 'notes', 'position']

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const filtered = Object.fromEntries(
    Object.entries(body as Record<string, unknown>).filter(([k, v]) => ALLOWED.includes(k) && v !== undefined)
  ) as Record<string, unknown>

  for (const key of ['provider', 'notes']) {
    if (filtered[key] === '') filtered[key] = null
  }

  const { data, error } = await supabase
    .from('dispatch_trucks')
    .update(filtered)
    .eq('id', params.id)
    .neq('is_deleted', true)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const now = new Date().toISOString()

  const { error: truckError } = await supabase
    .from('dispatch_trucks')
    .update({ is_deleted: true, deleted_at: now })
    .eq('id', params.id)

  if (truckError) return NextResponse.json({ error: truckError.message }, { status: 500 })

  // Soft-delete orphaned assignments for this truck
  await supabase
    .from('dispatch_job_assignments')
    .update({ is_deleted: true, deleted_at: now })
    .eq('truck_id', params.id)
    .neq('is_deleted', true)

  return NextResponse.json({ ok: true })
}
