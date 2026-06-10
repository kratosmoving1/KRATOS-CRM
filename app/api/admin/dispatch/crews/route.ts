import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const CREW_SELECT = `
  *,
  truck:dispatch_trucks(id, name, category, size, provider),
  driver:workforce_people!driver_id(id, name, profile_picture_url),
  dispatcher:workforce_people!dispatcher_id(id, name, profile_picture_url),
  helpers:dispatch_crew_helpers(
    person:workforce_people(id, name, profile_picture_url)
  ),
  assignments:dispatch_job_assignments(
    id, opportunity_id, crew_id, scheduled_date, start_time, duration_hours, position, is_deleted,
    opportunity:opportunities(
      id, move_size, origin_city, dest_city, total_amount,
      customer:customers(id, full_name)
    )
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
    .from('dispatch_crews')
    .select(CREW_SELECT)
    .eq('scheduled_date', date)
    .neq('is_deleted', true)
    .order('position', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const crews = (data ?? []).map((c: Record<string, unknown>) => ({
    ...c,
    helpers: (c.helpers as unknown[]) ?? [],
    assignments: ((c.assignments as Array<Record<string, unknown>>) ?? []).filter(a => !a.is_deleted),
  }))

  return NextResponse.json(crews)
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as Record<string, unknown>
  const { scheduled_date } = body

  if (!scheduled_date || typeof scheduled_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(scheduled_date)) {
    return NextResponse.json({ error: 'scheduled_date is required (YYYY-MM-DD)' }, { status: 400 })
  }

  const { data: existing } = await supabase
    .from('dispatch_crews')
    .select('position')
    .eq('scheduled_date', scheduled_date)
    .neq('is_deleted', true)
    .order('position', { ascending: false })
    .limit(1)

  const nextPosition = existing && existing.length > 0
    ? ((existing[0] as { position: number }).position + 1)
    : 0

  const crewCount = await supabase
    .from('dispatch_crews')
    .select('id', { count: 'exact', head: true })
    .eq('scheduled_date', scheduled_date)
    .neq('is_deleted', true)

  const crewNumber = (crewCount.count ?? 0) + 1
  const defaultName = `Crew ${crewNumber}`

  const { data, error } = await supabase
    .from('dispatch_crews')
    .insert({
      scheduled_date,
      position: nextPosition,
      name: defaultName,
      created_by: user.id,
    })
    .select(CREW_SELECT)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const crew = {
    ...data as Record<string, unknown>,
    helpers: [],
    assignments: [],
  }

  return NextResponse.json(crew, { status: 201 })
}
