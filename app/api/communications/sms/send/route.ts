import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireActiveProfile } from '@/lib/auth/server'
import { logAuditEvent } from '@/lib/audit/logAuditEvent'
import type { Json } from '@/types/database'
import { isRingCentralConfigured, sendSmsViaRingCentral, renderTemplate } from '@/lib/ringcentral/client'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const auth = await requireActiveProfile(supabase)
  if (auth.response) return auth.response
  const { user, profile } = auth.context

  const body = await req.json()
  const { opportunityId, customerId, to, templateId, message, vars } = body

  if (!opportunityId && !customerId) return NextResponse.json({ error: 'opportunityId or customerId required' }, { status: 400 })

  if (!isRingCentralConfigured()) {
    return NextResponse.json({ error: 'RingCentral is not configured.' }, { status: 500 })
  }

  let text = message ?? null
  if (templateId) {
    // fetch template from DB
    const { data: tpl } = await supabase.from('communication_templates').select('*').eq('id', templateId).single()
    if (!tpl) return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    text = await renderTemplate(tpl.body, vars ?? {})
  }
  if (!text) return NextResponse.json({ error: 'Message content required' }, { status: 400 })

  try {
    // Attempt to send via RingCentral
    const result = await sendSmsViaRingCentral({ to: to, from: process.env.RINGCENTRAL_FROM_NUMBER || '', text })

    // Save communication record after successful send
    const { data, error } = await supabase.from('communications').insert({
      opportunity_id: opportunityId ?? null,
      customer_id: customerId ?? null,
      type: 'sms',
      direction: 'outbound',
      body: text,
      created_by: user.id,
    }).select().single()

    if (error) {
      console.error('Saving SMS communication failed:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await logAuditEvent({
      actorUserId: user.id,
      action: 'sms_sent',
      entityType: 'communication',
      entityId: data.id,
      oldData: null,
      newData: data,
      ipAddress: req.headers.get('x-forwarded-for'),
      userAgent: req.headers.get('user-agent'),
    })

    return NextResponse.json({ success: true, result, comm: data }, { status: 200 })
  } catch (err: any) {
    console.error('SMS send error:', err)
    await logAuditEvent({
      actorUserId: user.id,
      action: 'sms_failed',
      entityType: 'communication',
      entityId: null,
      oldData: null,
      newData: { error: String(err.message ?? err) } as unknown as Json,
      ipAddress: req.headers.get('x-forwarded-for'),
      userAgent: req.headers.get('user-agent'),
    })
    return NextResponse.json({ error: err.message ?? 'SMS send failed' }, { status: 500 })
  }
}
