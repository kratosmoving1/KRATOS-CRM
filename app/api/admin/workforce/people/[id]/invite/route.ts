import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Fetch the workforce person to get their email
  const { data: person, error: fetchErr } = await admin
    .from('workforce_people')
    .select('id, name, email, profile_id')
    .eq('id', params.id)
    .neq('is_deleted', true)
    .single()

  if (fetchErr || !person) return NextResponse.json({ error: 'Person not found' }, { status: 404 })
  if (!person.email) return NextResponse.json({ error: 'No email address on file for this person' }, { status: 400 })

  // If they already have a profile_id, their account exists — just resend invite
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://kratos-crm.vercel.app'

  const { data: inviteData, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(
    person.email,
    {
      redirectTo: `${appUrl}/crew`,
      data: {
        full_name: person.name,
        workforce_person_id: person.id,
        role: 'crew',
      },
    },
  )

  if (inviteErr) {
    // If user already exists, that's fine — they can log in
    if (!inviteErr.message?.includes('already been registered')) {
      return NextResponse.json({ error: inviteErr.message }, { status: 500 })
    }
  }

  // Link the new auth user back to the workforce_people record
  const newUserId = inviteData?.user?.id
  if (newUserId && !person.profile_id) {
    await admin
      .from('workforce_people')
      .update({ profile_id: newUserId })
      .eq('id', person.id)
  }

  return NextResponse.json({ ok: true, email: person.email })
}
