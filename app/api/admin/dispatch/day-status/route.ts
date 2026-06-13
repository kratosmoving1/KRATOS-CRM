import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isActiveUser } from '@/lib/auth/permissions'

const SELECT = `
  id, scheduled_date, start_time, crew_id,
  published_at, customer_confirmed_at,
  crew:dispatch_crews!crew_id(
    id, name,
    driver:workforce_people!driver_id(id, name, profile_picture_url),
    dispatcher:workforce_people!dispatcher_id(id, name, profile_picture_url),
    helpers:dispatch_crew_helpers(person:workforce_people(id, name, profile_picture_url))
  ),
  opportunity:opportunities!opportunity_id(
    id, opportunity_number, status, arrival_window_start, arrival_window_end,
    origin_city, origin_province, dest_city, dest_province,
    customer:customers!customer_id(id, full_name, email, phone)
  )
`

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role, is_active').eq('id', user.id).single()
  if (!isActiveUser(profile)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const date = req.nextUrl.searchParams.get('date')
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'A valid date is required' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: assignments, error } = await admin
    .from('dispatch_job_assignments')
    .select(SELECT)
    .eq('scheduled_date', date)
    .not('crew_id', 'is', null)
    .not('is_deleted', 'is', true)
    .order('start_time', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const ids = (assignments ?? []).map(a => a.id)
  let acceptances: Array<{ assignment_id: string; person_id: string; role: string | null; status: string; responded_at: string | null }> = []
  if (ids.length > 0) {
    const { data: acc } = await admin
      .from('dispatch_crew_acceptances')
      .select('assignment_id, person_id, role, status, responded_at')
      .in('assignment_id', ids)
    acceptances = acc ?? []
  }

  return NextResponse.json({ assignments: assignments ?? [], acceptances })
}
