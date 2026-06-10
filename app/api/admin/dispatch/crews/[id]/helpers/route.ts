import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as Record<string, unknown>
  const { person_id } = body

  if (!person_id || typeof person_id !== 'string') {
    return NextResponse.json({ error: 'person_id is required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('dispatch_crew_helpers')
    .insert({ crew_id: params.id, person_id })

  if (error) {
    // Unique constraint violation = already a helper, treat as success
    if (error.code === '23505') return NextResponse.json({ ok: true })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true }, { status: 201 })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as Record<string, unknown>
  const { person_id } = body

  if (!person_id || typeof person_id !== 'string') {
    return NextResponse.json({ error: 'person_id is required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('dispatch_crew_helpers')
    .delete()
    .eq('crew_id', params.id)
    .eq('person_id', person_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
