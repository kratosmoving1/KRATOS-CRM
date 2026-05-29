import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireActiveProfile } from '@/lib/auth/server'
import { hasPermission } from '@/lib/auth/permissions'
import { logAuditEvent } from '@/lib/audit/logAuditEvent'
import { getSmsProvider, getSmsDeliveryStatus } from '@/lib/sms/provider'
import { sendSmsTwilio } from '@/lib/sms/twilio'
import {
  sendSmsViaRingCentral,
  renderTemplate,
  RingCentralCallError,
} from '@/lib/ringcentral/client'
import { getRingCentralUserConnection } from '@/lib/ringcentral/oauth'
import { normalizePhoneToE164 } from '@/lib/phone/normalizePhone'
import type { Json } from '@/types/database'

const SMS_MAX_LENGTH = 1600

function maskPhone(phone: string) {
  return phone.length > 4 ? `****${phone.slice(-4)}` : '****'
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const auth = await requireActiveProfile(supabase)
  if (auth.response) return auth.response
  const { user, role } = auth.context

  if (!hasPermission(role, 'lead:update') && !hasPermission(role, 'contact:update') &&
      !hasPermission(role, 'lead:update_assigned') && !hasPermission(role, 'contact:update_assigned')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const opportunityId = (body.quoteId ?? body.opportunityId ?? null) as string | null
  const customerId = (body.customerId ?? null) as string | null
  const templateId = (body.templateId ?? null) as string | null
  const rawTo = (body.to ?? null) as string | null
  const rawBody = (body.body ?? body.message ?? null) as string | null

  if (!opportunityId && !customerId) {
    return NextResponse.json({ error: 'quoteId or customerId required' }, { status: 400 })
  }

  // Check provider capability before doing anything expensive
  const status = getSmsDeliveryStatus()
  if (!status.canSend) {
    return NextResponse.json({
      error: `SMS delivery is not active: ${status.reason}`,
      recommendation: status.recommendation ?? null,
      provider: status.provider,
    }, { status: 503 })
  }

  // Resolve customer + opportunity
  let customer: { id: string; full_name: string; phone: string | null } | null = null
  let serviceDate: string | null = null
  let agentName: string | null = null

  if (opportunityId) {
    const { data, error } = await supabase
      .from('opportunities')
      .select('id, service_date, customer:customers!customer_id(id, full_name, phone), agent:profiles!sales_agent_id(full_name)')
      .eq('id', opportunityId)
      .eq('is_deleted', false)
      .single()

    if (error || !data) return NextResponse.json({ error: 'Quote not found' }, { status: 404 })

    type CustomerField = { id: string; full_name: string; phone: string | null }[] | { id: string; full_name: string; phone: string | null } | null
    type AgentField = { full_name: string }[] | { full_name: string } | null
    const c = data.customer as CustomerField
    const a = data.agent as AgentField

    customer = Array.isArray(c) ? (c[0] ?? null) : c
    serviceDate = data.service_date ?? null
    agentName = Array.isArray(a) ? (a[0]?.full_name ?? null) : (a?.full_name ?? null)
  }

  if (!customer && customerId) {
    const { data } = await supabase.from('customers').select('id, full_name, phone').eq('id', customerId).single()
    customer = data ?? null
  }

  const recipientRaw = rawTo ?? customer?.phone ?? null
  if (!recipientRaw) return NextResponse.json({ error: 'Recipient phone number required' }, { status: 400 })

  const normalized = normalizePhoneToE164(recipientRaw)
  if (!normalized.isE164) {
    return NextResponse.json({ error: `Invalid phone number: ${recipientRaw}` }, { status: 400 })
  }

  const { data: senderProfile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
  const senderName = senderProfile?.full_name ?? ''

  // Build template vars
  const vars: Record<string, string | undefined> = {
    customer_first_name: customer?.full_name?.split(' ')[0] ?? '',
    customer_name: customer?.full_name ?? '',
    customer_full_name: customer?.full_name ?? '',
    sales_agent_first_name: senderName.split(' ')[0],
    sales_agent_name: senderName,
    agent_first_name: (agentName ?? senderName).split(' ')[0],
    agent_full_name: agentName ?? senderName,
    quote_number: '',
    move_date: serviceDate ?? '',
    company_name: 'Kratos Moving',
    portal_link: '',
    estimate_total: '',
    deposit_amount: '',
  }

  // Resolve message text
  let text = rawBody?.trim() ?? null
  if (templateId) {
    const { data: tpl } = await supabase
      .from('communication_templates')
      .select('body')
      .eq('id', templateId)
      .eq('channel', 'sms')
      .eq('is_active', true)
      .single()

    if (!tpl) return NextResponse.json({ error: 'SMS template not found or inactive' }, { status: 404 })
    text = (await renderTemplate(tpl.body, vars)).trim()
  }

  if (!text) return NextResponse.json({ error: 'Message body required' }, { status: 400 })
  if (text.length > SMS_MAX_LENGTH) return NextResponse.json({ error: 'Message too long (max 1600 chars)' }, { status: 400 })

  const provider = getSmsProvider()

  await logAuditEvent({
    actorUserId: user.id,
    action: 'sms_send_attempted',
    entityType: 'communication',
    entityId: opportunityId ?? customerId,
    newData: { provider, to: maskPhone(normalized.normalized), opportunityId, customerId } as unknown as Json,
    ipAddress: req.headers.get('x-forwarded-for'),
    userAgent: req.headers.get('user-agent'),
  })

  const baseComm = {
    opportunity_id: opportunityId,
    customer_id: customerId ?? customer?.id ?? null,
    type: 'sms',
    direction: 'outbound',
    body: text,
    created_by: user.id,
    phone_number: normalized.normalized,
    provider,
  }

  try {
    let messageId: string | undefined

    if (provider === 'twilio') {
      const result = await sendSmsTwilio(normalized.normalized, text)
      messageId = result.sid
    } else if (provider === 'ringcentral') {
      const conn = await getRingCentralUserConnection(user.id)
      if (!conn) {
        throw new Error('Connect your RingCentral account in Settings > Integrations before sending SMS.')
      }
      const result = await sendSmsViaRingCentral({
        to: normalized.normalized,
        from: conn.smsFromNumber,
        accessToken: conn.accessToken,
        text,
      })
      messageId = result.id
    }

    const { data: comm, error: commErr } = await supabase
      .from('communications')
      .insert({ ...baseComm, status: 'sent', provider_message_id: messageId ?? null })
      .select()
      .single()

    if (commErr) {
      // Fallback: save without extended fields
      await supabase.from('communications').insert({
        opportunity_id: opportunityId,
        customer_id: customerId ?? customer?.id ?? null,
        type: 'sms',
        direction: 'outbound',
        body: text,
        created_by: user.id,
      })
    }

    await logAuditEvent({
      actorUserId: user.id,
      action: 'sms_sent',
      entityType: 'communication',
      entityId: comm?.id ?? opportunityId ?? customerId,
      newData: { provider, messageId: messageId ?? null, to: maskPhone(normalized.normalized) } as unknown as Json,
      ipAddress: req.headers.get('x-forwarded-for'),
      userAgent: req.headers.get('user-agent'),
    })

    return NextResponse.json({ ok: true, delivered: true, provider, messageId: messageId ?? null }, { status: 200 })

  } catch (err) {
    const errMsg = err instanceof RingCentralCallError
      ? err.message
      : err instanceof Error ? err.message : 'SMS send failed'

    try {
      await supabase.from('communications').insert({ ...baseComm, status: 'failed' })
    } catch { /* non-critical */ }

    await logAuditEvent({
      actorUserId: user.id,
      action: 'sms_failed',
      entityType: 'communication',
      entityId: opportunityId ?? customerId,
      newData: { provider, error: errMsg, to: maskPhone(normalized.normalized) } as unknown as Json,
      ipAddress: req.headers.get('x-forwarded-for'),
      userAgent: req.headers.get('user-agent'),
    })

    return NextResponse.json({ error: errMsg, delivered: false, provider }, { status: 502 })
  }
}
