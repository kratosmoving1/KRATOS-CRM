import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const ALLOWED_FIELDS = new Set(['name', 'truck_id', 'driver_id', 'dispatcher_id', 'notes', 'position'])

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as Record<string, unknown>
  const patch: Record<string, unknown> = {}

  for (const [k, v] of Object.entries(body)) {
    if (!ALLOWED_FIELDS.has(k)) continue
    // Convert empty string to null for nullable FK fields
    if (['truck_id', 'driver_id', 'dispatcher_id'].includes(k)) {
      patch[k] = v === '' ? null : v
    } else {
      patch[k] = v
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('dispatch_crews')
    .update(patch)
    .eq('id', params.id)
    .neq('is_deleted', true)
    .select('id, name, truck_id, driver_id, dispatcher_id, notes, position, updated_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('dispatch_crews')
    .update({ is_deleted: true, deleted_at: new Date().toISOString() })
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
