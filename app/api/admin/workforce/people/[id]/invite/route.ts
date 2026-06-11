import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email/sendEmail'

function buildInviteHtml(name: string, link: string, isExisting: boolean) {
  const action = isExisting ? 'Log in to the Kratos Crew app' : 'Set up your Kratos Crew app account'
  const buttonLabel = isExisting ? 'Open Crew App' : 'Set Up My Account'
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#1e293b;border-radius:16px;overflow:hidden;">
        <tr><td style="padding:32px 32px 24px;text-align:center;border-bottom:1px solid #334155;">
          <p style="margin:0 0 8px;font-size:13px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#ffad33;">Kratos Moving</p>
          <h1 style="margin:0;font-size:22px;font-weight:700;color:#f8fafc;">You&apos;re on the crew, ${name.split(' ')[0]}.</h1>
        </td></tr>
        <tr><td style="padding:28px 32px;">
          <p style="margin:0 0 24px;font-size:15px;color:#94a3b8;line-height:1.6;">${action} to see your upcoming jobs, addresses, and crew assignments.</p>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td align="center">
              <a href="${link}" style="display:inline-block;background:#ffad33;color:#0f172a;font-size:15px;font-weight:700;padding:14px 36px;border-radius:10px;text-decoration:none;">${buttonLabel}</a>
            </td></tr>
          </table>
          <p style="margin:24px 0 0;font-size:12px;color:#475569;text-align:center;">This link expires in 24 hours. If you didn&apos;t expect this email, ignore it.</p>
        </td></tr>
        <tr><td style="padding:16px 32px 24px;text-align:center;border-top:1px solid #334155;">
          <p style="margin:0;font-size:12px;color:#334155;">Kratos Moving Inc. &mdash; Crew Portal</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function buildInviteText(name: string, link: string) {
  return `Hi ${name.split(' ')[0]},\n\nYou've been added to the Kratos Moving crew. Use the link below to set up your account and see your jobs:\n\n${link}\n\nThis link expires in 24 hours.\n\n— Kratos Moving`
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { data: person, error: fetchErr } = await admin
    .from('workforce_people')
    .select('id, name, email, profile_id')
    .eq('id', params.id)
    .not('is_deleted', 'is', true)
    .single()

  if (fetchErr || !person) return NextResponse.json({ error: 'Person not found' }, { status: 404 })
  if (!person.email) return NextResponse.json({ error: 'No email address on file. Add their email and save first.' }, { status: 400 })

  const appUrl = process.env.NODE_ENV === 'development'
    ? 'http://localhost:3000'
    : 'https://kratos-crm.vercel.app'
  const redirectTo = `${appUrl}/crew/auth/callback`

  // Try invite link first (works for brand-new users)
  let link: string | null = null
  let isExisting = false

  const { data: inviteLink, error: inviteErr } = await admin.auth.admin.generateLink({
    type: 'invite',
    email: person.email,
    options: {
      redirectTo,
      data: { full_name: person.name, workforce_person_id: person.id, role: 'crew' },
    },
  })

  if (!inviteErr && inviteLink?.properties?.action_link) {
    link = inviteLink.properties.action_link
    // Link profile_id if this created a new user
    const newUserId = inviteLink.user?.id
    if (newUserId && !person.profile_id) {
      await admin.from('workforce_people').update({ profile_id: newUserId }).eq('id', person.id)
    }
  } else {
    // User already exists — generate a magic link so they can log in
    isExisting = true
    const { data: magicData, error: magicErr } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: person.email,
      options: { redirectTo },
    })
    if (magicErr || !magicData?.properties?.action_link) {
      return NextResponse.json(
        { error: `Could not generate invite link: ${magicErr?.message ?? 'Unknown error'}` },
        { status: 500 },
      )
    }
    link = magicData.properties.action_link
  }

  // Send via our own email provider (Resend/SendGrid) — reliable, branded
  try {
    await sendEmail({
      to: person.email,
      subject: isExisting
        ? 'Your Kratos Crew login link'
        : `${person.name.split(' ')[0]}, you've been added to the Kratos crew`,
      html: buildInviteHtml(person.name, link, isExisting),
      text: buildInviteText(person.name, link),
      fromName: 'Kratos Moving',
    })
  } catch (emailErr) {
    return NextResponse.json(
      { error: `Invite link generated but email failed to send: ${emailErr instanceof Error ? emailErr.message : 'Unknown error'}` },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true, email: person.email })
}
