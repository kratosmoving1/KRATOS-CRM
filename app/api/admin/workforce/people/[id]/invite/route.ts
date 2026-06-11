import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email/sendEmail'
import { sendSmsTwilio } from '@/lib/sms/twilio'
import { normalizePhoneToE164 } from '@/lib/phone/normalizePhone'

const APP_URL = process.env.NODE_ENV === 'development'
  ? 'http://localhost:3000'
  : 'https://kratos-crm.vercel.app'

const LOGIN_URL = `${APP_URL}/crew/login`

function generateTempPassword(): string {
  const words = ['Mover', 'Truck', 'Drive', 'Carry', 'Haul', 'Shift', 'Crew']
  const word = words[Math.floor(Math.random() * words.length)]
  const num = Math.floor(1000 + Math.random() * 9000)
  return `${word}${num}!`
}

function buildEmailHtml(firstName: string, email: string, password: string) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#1e293b;border-radius:16px;overflow:hidden;">
        <tr><td style="padding:32px 32px 24px;text-align:center;border-bottom:1px solid #334155;">
          <p style="margin:0 0 8px;font-size:13px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#ffad33;">Kratos Moving</p>
          <h1 style="margin:0;font-size:22px;font-weight:700;color:#f8fafc;">You're on the crew, ${firstName}.</h1>
        </td></tr>
        <tr><td style="padding:28px 32px;">
          <p style="margin:0 0 20px;font-size:15px;color:#94a3b8;line-height:1.6;">Your Kratos Crew account is ready. Use these details to log in and see your upcoming jobs.</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;border-radius:10px;margin-bottom:24px;">
            <tr><td style="padding:20px 24px;">
              <p style="margin:0 0 12px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;">Your login details</p>
              <p style="margin:0 0 4px;font-size:13px;color:#94a3b8;">Email</p>
              <p style="margin:0 0 16px;font-size:15px;font-weight:600;color:#f8fafc;">${email}</p>
              <p style="margin:0 0 4px;font-size:13px;color:#94a3b8;">Password</p>
              <p style="margin:0;font-size:24px;font-weight:700;color:#ffad33;letter-spacing:0.05em;">${password}</p>
            </td></tr>
          </table>
          <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
            <a href="${LOGIN_URL}" style="display:inline-block;background:#ffad33;color:#0f172a;font-size:15px;font-weight:700;padding:14px 36px;border-radius:10px;text-decoration:none;">Open Crew App</a>
          </td></tr></table>
          <p style="margin:20px 0 0;font-size:12px;color:#475569;text-align:center;">Save this password — you'll need it each time you log in.</p>
        </td></tr>
        <tr><td style="padding:16px 32px 24px;text-align:center;border-top:1px solid #334155;">
          <p style="margin:0;font-size:12px;color:#334155;">Kratos Moving Inc. &mdash; Crew Portal</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

function buildEmailText(firstName: string, email: string, password: string) {
  return `Hi ${firstName},\n\nYour Kratos Crew account is ready.\n\nLogin: ${LOGIN_URL}\nEmail: ${email}\nPassword: ${password}\n\nSave this password.\n\n— Kratos Moving`
}

function buildSmsText(firstName: string, email: string, password: string) {
  return `Hi ${firstName}! Your Kratos Crew login is ready.\n\nApp: ${LOGIN_URL}\nEmail: ${email}\nPassword: ${password}\n\nSave this. - Kratos Moving`
}

async function getOrCreateAccount(
  admin: ReturnType<typeof createAdminClient>,
  person: { id: string; name: string; email: string; profile_id: string | null },
  tempPassword: string,
): Promise<{ userId: string; error?: string }> {
  if (person.profile_id) {
    const { error } = await admin.auth.admin.updateUserById(person.profile_id, { password: tempPassword })
    if (error) return { userId: '', error: `Could not reset password: ${error.message}` }
    return { userId: person.profile_id }
  }
  const { data: created, error } = await admin.auth.admin.createUser({
    email: person.email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { full_name: person.name, workforce_person_id: person.id, role: 'crew' },
  })
  if (error) return { userId: '', error: `Could not create account: ${error.message}` }
  const userId = created.user.id
  await admin.from('workforce_people').update({ profile_id: userId }).eq('id', person.id)
  return { userId }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const method: 'email' | 'sms' | 'both' = ['sms', 'both'].includes(body.method) ? body.method : 'email'

  const admin = createAdminClient()

  const { data: person, error: fetchErr } = await admin
    .from('workforce_people')
    .select('id, name, email, phone, profile_id')
    .eq('id', params.id)
    .not('is_deleted', 'is', true)
    .single()

  if (fetchErr || !person) return NextResponse.json({ error: 'Person not found' }, { status: 404 })

  // Validate required fields for the selected method(s)
  const needsSms = method === 'sms' || method === 'both'
  const needsEmail = method === 'email' || method === 'both'

  if (needsEmail && !person.email) return NextResponse.json({ error: 'No email address on file. Add their email and save first.' }, { status: 400 })
  if (needsSms && !person.email) return NextResponse.json({ error: 'An email is required to create the account even when inviting by SMS.' }, { status: 400 })
  if (needsSms && !person.phone) return NextResponse.json({ error: 'No phone number on file. Add their phone and save first.' }, { status: 400 })

  let normalized: ReturnType<typeof normalizePhoneToE164> | null = null
  if (needsSms) {
    normalized = normalizePhoneToE164(person.phone!)
    if (!normalized.isE164) return NextResponse.json({ error: `Phone number is not valid for SMS: ${person.phone}` }, { status: 400 })
  }

  // Generate ONE password for this entire request — used for all channels
  const tempPassword = generateTempPassword()
  const { userId, error: accountErr } = await getOrCreateAccount(admin, person as typeof person & { email: string }, tempPassword)
  if (accountErr) return NextResponse.json({ error: accountErr }, { status: 500 })

  const firstName = person.name.split(' ')[0]
  const errors: string[] = []

  if (needsEmail) {
    try {
      await sendEmail({
        to: person.email!,
        subject: `${firstName}, your Kratos Crew account is ready`,
        html: buildEmailHtml(firstName, person.email!, tempPassword),
        text: buildEmailText(firstName, person.email!, tempPassword),
        fromName: 'Kratos Moving',
      })
    } catch (e) {
      errors.push(`Email failed: ${e instanceof Error ? e.message : 'Unknown'}`)
    }
  }

  if (needsSms && normalized) {
    try {
      await sendSmsTwilio(normalized.normalized, buildSmsText(firstName, person.email!, tempPassword))
    } catch (e) {
      errors.push(`SMS failed: ${e instanceof Error ? e.message : 'Unknown'}`)
    }
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: `Account set but delivery failed: ${errors.join('; ')}` }, { status: 500 })
  }

  return NextResponse.json({ ok: true, method, userId })
}
