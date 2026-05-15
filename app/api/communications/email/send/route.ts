import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireActiveProfile } from '@/lib/auth/server'
import { logAuditEvent } from '@/lib/audit/logAuditEvent'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const auth = await requireActiveProfile(supabase)
  if (auth.response) return auth.response
  const { user } = auth.context

  // Currently a skeleton — no email provider configured
  // Future: implement SendGrid/Resend/Mailgun/Gmail API integration here.
  await logAuditEvent({
    actorUserId: user.id,
    action: 'email_send_attempted',
    entityType: 'communication',
    entityId: null,
    oldData: null,
    newData: null,
    ipAddress: req.headers.get('x-forwarded-for'),
    userAgent: req.headers.get('user-agent'),
  })

  return NextResponse.json({ error: 'Email provider is not configured.' }, { status: 500 })
}
