import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireActiveProfile } from '@/lib/auth/server'

export async function GET(req: NextRequest) {
  void req
  const supabase = createClient()
  const auth = await requireActiveProfile(supabase)
  if (auth.response) return auth.response

  const { data, error } = await supabase
    .from('customer_portal_content_blocks')
    .select('*')
    .eq('is_deleted', false)
    .order('position', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const auth = await requireActiveProfile(supabase)
  if (auth.response) return auth.response

  const body = await req.json() as {
    section_type: string
    title?: string | null
    body?: string | null
    data?: Record<string, unknown>
  }

  if (!body.section_type) {
    return NextResponse.json({ error: 'section_type required' }, { status: 400 })
  }

  const { data: existing } = await supabase
    .from('customer_portal_content_blocks')
    .select('position')
    .eq('is_deleted', false)
    .order('position', { ascending: false })
    .limit(1)

  const nextPos = existing && existing.length > 0
    ? (existing[0] as { position: number }).position + 1
    : 0

  const { data: created, error } = await supabase
    .from('customer_portal_content_blocks')
    .insert({
      section_type: body.section_type,
      title: body.title ?? null,
      body: body.body ?? null,
      data: body.data ?? {},
      position: nextPos,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(created, { status: 201 })
}
