import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

type CrewShape = {
  driver:     { id: string } | null
  dispatcher: { id: string } | null
  helpers:    Array<{ person: { id: string } }>
} | null

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Resolve crew person
  const { data: person } = await admin
    .from('workforce_people')
    .select('id')
    .eq('profile_id', user.id)
    .not('is_deleted', 'is', true)
    .maybeSingle()

  if (!person) return NextResponse.json({ error: 'Crew profile not found.' }, { status: 404 })

  // Load the assignment with crew, verify it belongs to this crew member
  const { data: assignment } = await admin
    .from('dispatch_job_assignments')
    .select(`
      id, opportunity_id,
      crew:dispatch_crews!crew_id(
        driver:workforce_people!driver_id(id),
        dispatcher:workforce_people!dispatcher_id(id),
        helpers:dispatch_crew_helpers(person:workforce_people(id))
      )
    `)
    .eq('id', params.id)
    .not('is_deleted', 'is', true)
    .maybeSingle()

  if (!assignment) return NextResponse.json({ error: 'Assignment not found.' }, { status: 404 })

  // Security: verify this crew member is actually on this job
  const crew = (Array.isArray(assignment.crew) ? assignment.crew[0] : assignment.crew) as unknown as CrewShape
  const personId = person.id
  const isMember = crew && (
    crew.driver?.id === personId ||
    crew.dispatcher?.id === personId ||
    (crew.helpers ?? []).some(h => h.person?.id === personId)
  )
  if (!isMember) return NextResponse.json({ error: 'Not authorized for this job.' }, { status: 403 })

  if (!assignment.opportunity_id) return NextResponse.json({ documents: [] })

  // Return documents for this opportunity (hide internal fields)
  const { data: docs } = await admin
    .from('documents')
    .select('id, name, category, status, signed_at, sent_to, signature_data')
    .eq('opportunity_id', assignment.opportunity_id)
    .eq('is_deleted', false)
    .order('created_at', { ascending: true })

  const safeDocuments = (docs ?? []).map(d => {
    const sig = d.signature_data as Record<string, string> | null
    return {
      id:           d.id,
      name:         d.name,
      category:     d.category,
      status:       d.status,
      signed_at:    d.signed_at,
      sent_to:      d.sent_to,
      signed_by:    sig?.signer_name ?? null,
    }
  })

  return NextResponse.json({ documents: safeDocuments })
}
