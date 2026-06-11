import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Find the workforce_people record linked to this auth user
  const { data: person } = await admin
    .from('workforce_people')
    .select('id, name, profile_picture_url')
    .eq('profile_id', user.id)
    .not('is_deleted', 'is', true)
    .maybeSingle()

  if (!person) return NextResponse.json({ error: 'No crew profile found for this account.' }, { status: 404 })

  // Find all job assignments where this person is: driver, dispatcher, or helper
  const { data: assignments, error } = await admin
    .from('dispatch_job_assignments')
    .select(`
      id, scheduled_date, start_time, duration_hours, notes, position,
      crew:dispatch_crews!crew_id(
        id, name, notes,
        truck:dispatch_trucks(id, name, category),
        driver:workforce_people!driver_id(id, name, profile_picture_url),
        dispatcher:workforce_people!dispatcher_id(id, name, profile_picture_url),
        helpers:dispatch_crew_helpers(
          person:workforce_people(id, name, profile_picture_url)
        )
      ),
      opportunity:opportunities!opportunity_id(
        id, opportunity_number, status, service_type, service_date,
        origin_address_line1, origin_city, origin_province,
        dest_address_line1, dest_city, dest_province,
        move_size, total_amount,
        customer:customers!customer_id(id, full_name, phone)
      )
    `)
    .neq('is_deleted', true)
    .gte('scheduled_date', new Date().toISOString().split('T')[0])
    .order('scheduled_date', { ascending: true })
    .order('start_time', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Filter to only assignments where this person is on the crew
  const personId = person.id
  type CrewShape = { driver: { id: string } | null; dispatcher: { id: string } | null; helpers: Array<{ person: { id: string } }> } | null
  const myAssignments = (assignments ?? []).filter(a => {
    const crew = (Array.isArray(a.crew) ? a.crew[0] : a.crew) as unknown as CrewShape
    if (!crew) return false
    if (crew.driver?.id === personId) return true
    if (crew.dispatcher?.id === personId) return true
    return (crew.helpers ?? []).some(h => h.person?.id === personId)
  })

  return NextResponse.json({ person, assignments: myAssignments })
}
