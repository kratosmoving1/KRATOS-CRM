import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const ASSIGNMENT_SELECT = `
  id, opportunity_id, crew_id, scheduled_date, start_time, duration_hours, position, is_deleted,
  opportunity:opportunities(
    id, move_size, origin_city, dest_city, total_amount,
    customer:customers(id, full_name)
  )
`

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date')
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'date query param required (YYYY-MM-DD)' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('dispatch_job_assignments')
    .select(ASSIGNMENT_SELECT)
    .eq('scheduled_date', date)
    .neq('is_deleted', true)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as Record<string, string>
  const { opportunity_id, crew_id, scheduled_date } = body

  if (!opportunity_id || !crew_id || !scheduled_date) {
    return NextResponse.json(
      { error: 'opportunity_id, crew_id, scheduled_date are required' },
      { status: 400 },
    )
  }

  const { data: existing } = await supabase
    .from('dispatch_job_assignments')
    .select('position')
    .eq('crew_id', crew_id)
    .neq('is_deleted', true)
    .order('position', { ascending: false })
    .limit(1)

  const nextPosition = existing && existing.length > 0
    ? ((existing[0] as { position: number }).position + 1)
    : 0

  const { data, error } = await supabase
    .from('dispatch_job_assignments')
    .insert({
      opportunity_id,
      crew_id,
      scheduled_date,
      start_time: '08:00',
      duration_hours: 3,
      position: nextPosition,
      created_by: user.id,
    })
    .select(ASSIGNMENT_SELECT)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
