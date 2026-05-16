import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { normalizeRole } from '@/lib/auth/permissions'
import { requireActiveProfile } from '@/lib/auth/server'
import { emailConfigError, sendEmail } from '@/lib/email/sendEmail'

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const auth = await requireActiveProfile(supabase)
  if (auth.response) return auth.response

  const { role } = auth.context
  const normalizedRole = normalizeRole(role)
  if (!['owner', 'admin'].includes(normalizedRole)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const to = typeof body.to === 'string' ? body.to.trim() : ''
  if (!validEmail(to)) {
    return NextResponse.json({ error: 'Valid test recipient email is required.' }, { status: 400 })
  }

  try {
    if (process.env.EMAIL_PROVIDER !== 'resend') {
      return NextResponse.json({ error: `EMAIL_PROVIDER must be resend. Current value: ${process.env.EMAIL_PROVIDER || 'missing'}.` }, { status: 400 })
    }

    if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM_DEFAULT) {
      return NextResponse.json({ error: emailConfigError() }, { status: 503 })
    }

    const result = await sendEmail({
      to,
      subject: 'Kratos CRM Email Test',
      text: 'This is a test email from Kratos CRM.',
      html: '<p>This is a test email from Kratos CRM.</p>',
      fromEmail: process.env.EMAIL_FROM_DEFAULT,
      replyTo: process.env.EMAIL_REPLY_TO_DEFAULT,
    })

    return NextResponse.json({
      ok: true,
      provider: result.provider,
      id: result.id ?? null,
      message: 'Test email sent.',
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unable to send Resend test email.'
    console.error('Resend test failed:', err)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
