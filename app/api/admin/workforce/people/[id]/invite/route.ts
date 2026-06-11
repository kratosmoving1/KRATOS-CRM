import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email/sendEmail'

const APP_URL = process.env.NODE_ENV === 'development'
  ? 'http://localhost:3000'
  : 'https://kratos-crm.vercel.app'

// Generate a memorable temp password: Word + 4 digits + symbol
// Easy to type on mobile, meets most complexity requirements
function generateTempPassword(): string {
  const words = ['Mover', 'Truck', 'Drive', 'Carry', 'Haul', 'Shift', 'Crew']
  const word = words[Math.floor(Math.random() * words.length)]
  const num = Math.floor(1000 + Math.random() * 9000)
  return `${word}${num}!`
}

function buildCredentialsHtml(firstName: string, email: string, password: string) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#1e293b;border-radius:16px;overflow:hidden;">
        <tr><td style="padding:32px 32px 24px;text-align:center;border-bottom:1px solid #334155;">
          <p style="margin:0 0 8px;font-size:13px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#ffad33;">Kratos Moving</p>
          <h1 style="margin:0;font-size:22px;font-weight:700;color:#f8fafc;">You're on the crew, ${firstName}.</h1>
        </td></tr>
        <tr><td style="padding:28px 32px;">
          <p style="margin:0 0 20px;font-size:15px;color:#94a3b8;line-height:1.6;">Your Kratos Crew account is ready. Use the login details below to see your upcoming jobs.</p>

          <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;border-radius:10px;margin-bottom:24px;">
            <tr><td style="padding:20px 24px;">
              <p style="margin:0 0 12px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;">Your login details</p>
              <p style="margin:0 0 8px;font-size:14px;color:#94a3b8;">Email</p>
              <p style="margin:0 0 16px;font-size:16px;font-weight:600;color:#f8fafc;">${email}</p>
              <p style="margin:0 0 8px;font-size:14px;color:#94a3b8;">Temporary Password</p>
              <p style="margin:0;font-size:22px;font-weight:700;color:#ffad33;letter-spacing:0.05em;">${password}</p>
            </td></tr>
          </table>

          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td align="center">
              <a href="${APP_URL}/crew/login" style="display:inline-block;background:#ffad33;color:#0f172a;font-size:15px;font-weight:700;padding:14px 36px;border-radius:10px;text-decoration:none;">Open Crew App</a>
            </td></tr>
          </table>

          <p style="margin:20px 0 0;font-size:12px;color:#475569;text-align:center;">Save this password — you'll need it each time you log in.</p>
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

function buildCredentialsText(firstName: string, email: string, password: string) {
  return `Hi ${firstName},\n\nYour Kratos Crew account is ready. Log in at ${APP_URL}/crew/login\n\nEmail: ${email}\nTemporary Password: ${password}\n\nSave this password — you'll need it each time you log in.\n\n— Kratos Moving`
}

export async function POST(
  _req: NextRequest,
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

  const firstName = person.name.split(' ')[0]
  const tempPassword = generateTempPassword()

  let userId: string | null = person.profile_id ?? null

  if (userId) {
    // Existing account — reset their password to the new temp password
    const { error } = await admin.auth.admin.updateUserById(userId, { password: tempPassword })
    if (error) return NextResponse.json({ error: `Could not reset password: ${error.message}` }, { status: 500 })
  } else {
    // New account — create it directly (email_confirm: true skips any verify email)
    const { data: created, error } = await admin.auth.admin.createUser({
      email: person.email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: person.name, workforce_person_id: person.id, role: 'crew' },
    })
    if (error) return NextResponse.json({ error: `Could not create account: ${error.message}` }, { status: 500 })
    userId = created.user.id
    // Link the new auth user to the workforce record
    await admin.from('workforce_people').update({ profile_id: userId }).eq('id', person.id)
  }

  // Send credentials email — no magic links, no URLs that scanners can consume
  try {
    await sendEmail({
      to: person.email,
      subject: `${firstName}, your Kratos Crew account is ready`,
      html: buildCredentialsHtml(firstName, person.email, tempPassword),
      text: buildCredentialsText(firstName, person.email, tempPassword),
      fromName: 'Kratos Moving',
    })
  } catch (emailErr) {
    return NextResponse.json(
      { error: `Account created but email failed: ${emailErr instanceof Error ? emailErr.message : 'Unknown error'}` },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true, email: person.email })
}
