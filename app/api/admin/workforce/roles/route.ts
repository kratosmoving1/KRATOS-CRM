import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('workforce_roles')
    .select('id, key, label, color, position')
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
  const label = String(body.label ?? '').trim()
  if (!label) return NextResponse.json({ error: 'label is required' }, { status: 400 })

  const key = label.toLowerCase().replace(/[^a-z0-9]+/g, '_')

  const { data: maxRow } = await supabase
    .from('workforce_roles')
    .select('position')
    .neq('is_deleted', true)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()

  const position = (maxRow?.position ?? -1) + 1
  const color = body.color ?? '#64748b'

  const { data, error } = await supabase
    .from('workforce_roles')
    .insert({ key, label, color, position })
    .select('id, key, label, color, position')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
