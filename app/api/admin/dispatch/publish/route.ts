import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isActiveUser } from '@/lib/auth/permissions'
import { sendEmail, isEmailConfigured } from '@/lib/email/sendEmail'
import { buildCrewJobEmail } from '@/lib/email/dispatchEmails'

function fmtDate(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-CA', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })
}
function fmtTime(t: string | null): string {
  if (!t) return 'TBD'
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${String(m ?? 0).padStart(2, '0')} ${ampm}`
}

const ASSIGNMENT_SELECT = `
  id, scheduled_date, start_time, crew_id,
  crew:dispatch_crews!crew_id(
    id, name,
    driver:workforce_people!driver_id(id, name, email),
    dispatcher:workforce_people!dispatcher_id(id, name, email),
    helpers:dispatch_crew_helpers(person:workforce_people(id, name, email))
  ),
  opportunity:opportunities!opportunity_id(
    id, opportunity_number,
    origin_address_line1, origin_city, origin_province,
    dest_address_line1, dest_city, dest_province
  )
`

type Person = { id: string; name: string | null; email: string | null }
type Crew = {
  id: string; name: string | null
  driver: Person | Person[] | null
  dispatcher: Person | Person[] | null
  helpers: Array<{ person: Person | Person[] | null }>
}
type Opp = {
  id: string; opportunity_number: string
  origin_address_line1: string | null; origin_city: string | null; origin_province: string | null
  dest_address_line1: string | null; dest_city: string | null; dest_province: string | null
}

function one<T>(v: T | T[] | null): T | null {
  if (!v) return null
  return Array.isArray(v) ? v[0] ?? null : v
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role, is_active').eq('id', user.id).single()
  if (!isActiveUser(profile)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const date: string | undefined = body.date
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'A valid date is required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Only assignments that are actually placed on a crew get published
  const { data: rows, error } = await admin
    .from('dispatch_job_assignments')
    .select(ASSIGNMENT_SELECT)
    .eq('scheduled_date', date)
    .not('crew_id', 'is', null)
    .not('is_deleted', 'is', true)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const assignments = (rows ?? []) as unknown as Array<{
    id: string; scheduled_date: string; start_time: string | null
    crew: Crew | Crew[] | null; opportunity: Opp | Opp[] | null
  }>

  if (assignments.length === 0) {
    return NextResponse.json({ error: 'No scheduled jobs to publish on this day. Drag a job onto a crew first.' }, { status: 400 })
  }

  const now = new Date().toISOString()
  const emailReady = isEmailConfigured()
  let emailed = 0
  let crewCount = 0

  for (const a of assignments) {
    const crew = one(a.crew)
    const opp = one(a.opportunity)
    if (!crew) continue

    // Mark published
    await admin
      .from('dispatch_job_assignments')
      .update({ published_at: now, published_by: user.id })
      .eq('id', a.id)

    // Collect crew members with their role
    const members: Array<{ person: Person; role: string }> = []
    const driver = one(crew.driver)
    const dispatcher = one(crew.dispatcher)
    if (driver) members.push({ person: driver, role: 'driver' })
    if (dispatcher) members.push({ person: dispatcher, role: 'dispatcher' })
    for (const h of crew.helpers ?? []) {
      const p = one(h.person)
      if (p) members.push({ person: p, role: 'helper' })
    }

    const origin = [opp?.origin_address_line1, opp?.origin_city, opp?.origin_province].filter(Boolean).join(', ')
    const dest = [opp?.dest_address_line1, opp?.dest_city, opp?.dest_province].filter(Boolean).join(', ')

    for (const { person, role } of members) {
      crewCount++

      // Upsert a pending acceptance row (don't clobber an existing response)
      await admin
        .from('dispatch_crew_acceptances')
        .upsert(
          { assignment_id: a.id, person_id: person.id, role },
          { onConflict: 'assignment_id,person_id', ignoreDuplicates: true },
        )

      // Email the crew member
      if (emailReady && person.email) {
        const firstName = (person.name ?? '').split(' ')[0] || 'there'
        const { subject, html, text } = buildCrewJobEmail({
          crewFirstName: firstName,
          roleLabel: role.charAt(0).toUpperCase() + role.slice(1),
          dateLabel: fmtDate(a.scheduled_date),
          timeLabel: fmtTime(a.start_time),
          origin, destination: dest,
          crewName: crew.name ?? 'Crew',
        })
        try {
          await sendEmail({ to: person.email, subject, html, text, fromName: 'Kratos Moving' })
          emailed++
        } catch (e) {
          console.error('[dispatch/publish] crew email failed:', e instanceof Error ? e.message : e)
        }
      }
    }
  }

  return NextResponse.json({
    ok: true,
    publishedJobs: assignments.length,
    crewNotified: crewCount,
    emailsSent: emailed,
    emailConfigured: emailReady,
  })
}
