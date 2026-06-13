import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Crew member accepts or declines a job assignment they were scheduled on.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const action: string | undefined = body.action
  if (action !== 'accept' && action !== 'decline') {
    return NextResponse.json({ error: 'action must be "accept" or "decline"' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Resolve this auth user to their workforce person
  let personId: string | null = null
  const { data: byProfile } = await admin
    .from('workforce_people')
    .select('id')
    .eq('profile_id', user.id)
    .not('is_deleted', 'is', true)
    .maybeSingle()
  if (byProfile) personId = byProfile.id
  if (!personId && user.email) {
    const { data: byEmail } = await admin
      .from('workforce_people')
      .select('id')
      .eq('email', user.email)
      .not('is_deleted', 'is', true)
      .maybeSingle()
    if (byEmail) personId = byEmail.id
  }
  if (!personId) return NextResponse.json({ error: 'No crew profile found for this account.' }, { status: 404 })

  // The acceptance row must already exist (created at publish time)
  const status = action === 'accept' ? 'accepted' : 'declined'
  const { data: updated, error } = await admin
    .from('dispatch_crew_acceptances')
    .update({ status, responded_at: new Date().toISOString() })
    .eq('assignment_id', params.id)
    .eq('person_id', personId)
    .select('id, status, responded_at')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!updated) {
    return NextResponse.json({ error: 'This job has not been published to you yet.' }, { status: 404 })
  }

  return NextResponse.json({ ok: true, status: updated.status, responded_at: updated.responded_at })
}
