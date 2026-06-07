import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('workforce_columns')
    .select('id, name, position, color')
    .neq('is_deleted', true)
    .order('position', { ascending: true })

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

  const { data: maxRow } = await supabase
    .from('workforce_columns')
    .select('position')
    .neq('is_deleted', true)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()

  const position = (maxRow?.position ?? -1) + 1

  const { data, error } = await supabase
    .from('workforce_columns')
    .insert({ name, position, created_by: user.id })
    .select('id, name, position, color')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
