import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

const PERSON_SELECT = `
  id, name, profile_picture_url,
  role_data:workforce_roles(label)
`

const ASSIGNMENT_SELECT = `
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
`

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const type = new URL(req.url).searchParams.get('type') ?? 'upcoming'
  const today = new Date().toISOString().split('T')[0]

  // --- Resolve workforce person with 3 fallbacks ---
  let person: Record<string, unknown> | null = null
  let needsLink = false

  // 1. Primary: profile_id column
  const { data: byProfileId } = await admin
    .from('workforce_people')
    .select(PERSON_SELECT)
    .eq('profile_id', user.id)
    .not('is_deleted', 'is', true)
    .maybeSingle()
  if (byProfileId) person = byProfileId as Record<string, unknown>

  // 2. Fallback: workforce_person_id stored in auth user_metadata at invite time
  if (!person) {
    const wpId = (user.user_metadata as Record<string, unknown> | null)?.workforce_person_id as string | undefined
    if (wpId) {
      const { data: byMeta } = await admin
        .from('workforce_people')
        .select(PERSON_SELECT)
        .eq('id', wpId)
        .not('is_deleted', 'is', true)
        .maybeSingle()
      if (byMeta) { person = byMeta as Record<string, unknown>; needsLink = true }
    }
  }

  // 3. Fallback: email match (works if email column exists and is populated)
  if (!person && user.email) {
    const { data: byEmail } = await admin
      .from('workforce_people')
      .select(PERSON_SELECT)
      .eq('email', user.email)
      .not('is_deleted', 'is', true)
      .maybeSingle()
    if (byEmail) { person = byEmail as Record<string, unknown>; needsLink = true }
  }

  if (!person) return NextResponse.json({ error: 'No crew profile found for this account.' }, { status: 404 })

  // Auto-link profile_id so future requests hit fallback 1
  if (needsLink) {
    await admin.from('workforce_people').update({ profile_id: user.id }).eq('id', person.id)
  }

  if (type === 'profile') return NextResponse.json({ person })

  // --- Query assignments ---
  let q = admin
    .from('dispatch_job_assignments')
    .select(ASSIGNMENT_SELECT)
    .not('is_deleted', 'is', true)

  if (type === 'history') {
    q = q.lt('scheduled_date', today).order('scheduled_date', { ascending: false })
  } else {
    q = q
      .gte('scheduled_date', today)
      .order('scheduled_date', { ascending: true })
      .order('start_time', { ascending: true })
  }

  const { data: assignments, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Filter to only assignments where this person is driver, dispatcher, or a helper
  const personId = person.id as string
  type CrewShape = {
    driver: { id: string } | null
    dispatcher: { id: string } | null
    helpers: Array<{ person: { id: string } }>
  } | null

  const myAssignments = (assignments ?? []).filter(a => {
    const crew = (Array.isArray(a.crew) ? a.crew[0] : a.crew) as unknown as CrewShape
    if (!crew) return false
    if (crew.driver?.id === personId) return true
    if (crew.dispatcher?.id === personId) return true
    return (crew.helpers ?? []).some(h => h.person?.id === personId)
  })

  // Attach this person's accept/decline status for each assignment
  const assignmentIds = myAssignments.map(a => a.id as string)
  const acceptanceByAssignment: Record<string, { status: string; responded_at: string | null }> = {}
  if (assignmentIds.length > 0) {
    const { data: acc } = await admin
      .from('dispatch_crew_acceptances')
      .select('assignment_id, status, responded_at')
      .eq('person_id', personId)
      .in('assignment_id', assignmentIds)
    for (const r of acc ?? []) {
      acceptanceByAssignment[r.assignment_id as string] = { status: r.status as string, responded_at: r.responded_at as string | null }
    }
  }

  const withAcceptance = myAssignments.map(a => ({
    ...a,
    my_acceptance: acceptanceByAssignment[a.id as string] ?? null,
  }))

  return NextResponse.json({ person, assignments: withAcceptance })
}
