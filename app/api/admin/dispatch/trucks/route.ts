import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const ALLOWED = ['name', 'category', 'provider', 'size', 'notes', 'position']
const VALID_CATEGORIES = ['owned', 'rental', 'contractor']
const VALID_SIZES = ['cargo_van', '10ft', '15ft', '16ft', '20ft', '26ft']

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('dispatch_trucks')
    .select('*')
    .neq('is_deleted', true)
    .order('category')
    .order('position')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
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

  if (!filtered.name || typeof filtered.name !== 'string' || !filtered.name.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }
  if (!VALID_CATEGORIES.includes(filtered.category as string)) {
    return NextResponse.json({ error: 'invalid category' }, { status: 400 })
  }
  if (!VALID_SIZES.includes(filtered.size as string)) {
    return NextResponse.json({ error: 'invalid size' }, { status: 400 })
  }

  const { data: maxRow } = await supabase
    .from('dispatch_trucks')
    .select('position')
    .eq('category', filtered.category)
    .neq('is_deleted', true)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()

  filtered.position = maxRow ? (maxRow.position as number) + 1 : 0
  filtered.created_by = user.id

  const { data, error } = await supabase
    .from('dispatch_trucks')
    .insert(filtered)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
