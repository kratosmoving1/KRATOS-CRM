import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireActiveProfile } from '@/lib/auth/server'
import { normalizeRole, type CrmRole } from '@/lib/auth/permissions'
import { logAuditEvent } from '@/lib/audit/logAuditEvent'
import type { Json } from '@/types/database'
import { getSmsProvider } from '@/lib/sms/provider'
import { sendSmsTwilio } from '@/lib/sms/twilio'
import {
  RingCentralCallError,
  sendSmsViaRingCentral,
  renderTemplate,
} from '@/lib/ringcentral/client'
import { getRingCentralUserConnection } from '@/lib/ringcentral/oauth'
import { normalizePhoneToE164 } from '@/lib/phone/normalizePhone'

const SMS_ALLOWED_ROLES: CrmRole[] = ['owner', 'admin', 'manager', 'sales', 'dispatcher']
const COMPANY_PHONE = '(800) 321-3222'
const SMS_MAX_LENGTH = 1600

type SmsSendBody = {
  opportunityId?: string | null
  customerId?: string | null
  templateId?: string | null
  messageBody?: string | null
  message?: string | null
  toPhoneNumber?: string | null
  to?: string | null
  vars?: Record<string, string | undefined>
}

type CustomerRecord = {
  id: string
  full_name: string
  phone: string | null
  email?: string | null
}

type OpportunityRecord = {
  id: string
  customer_id: string
  sales_agent_id: string | null
  service_date: string | null
  origin_city: string | null
  dest_city: string | null
  customer?: CustomerRecord | CustomerRecord[] | null
  agent?: { full_name: string | null } | { full_name: string | null }[] | null
}

function firstName(fullName: string | null | undefined) {
  return fullName?.trim().split(/\s+/)[0] ?? ''
}

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

function maskPhone(phone: string) {
  return phone.length > 4 ? `****${phone.slice(-4)}` : '****'
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const auth = await requireActiveProfile(supabase)
  if (auth.response) return auth.response
  const { user, role } = auth.context
  const normalizedRole = normalizeRole(role)

  if (!SMS_ALLOWED_ROLES.includes(normalizedRole)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: SmsSendBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const opportunityId = body.opportunityId ?? null
  let customerId = body.customerId ?? null
  const templateId = body.templateId ?? null
  const directMessage = body.messageBody ?? body.message ?? null
  const explicitTo = body.toPhoneNumber ?? body.to ?? null

  if (!opportunityId && !customerId) {
    return NextResponse.json({ error: 'opportunityId or customerId required' }, { status: 400 })
  }

  // ── Check provider before any expensive queries ─────────────────
  const provider = getSmsProvider()
  if (provider === 'disabled') {
    return NextResponse.json({
      error: 'SMS is not configured. Set SMS_PROVIDER in your environment variables.',
    }, { status: 503 })
  }

  let opportunity: OpportunityRecord | null = null
  let customer: CustomerRecord | null = null

  if (opportunityId) {
    const { data, error } = await supabase
      .from('opportunities')
      .select('id, customer_id, sales_agent_id, service_date, origin_city, dest_city, customer:customers!customer_id(id, full_name, phone, email), agent:profiles!sales_agent_id(full_name)')
      .eq('id', opportunityId)
      .eq('is_deleted', false)
      .single()

    if (error || !data) return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 })
    opportunity = data as unknown as OpportunityRecord
    customer = one(opportunity.customer)
    customerId = customerId ?? opportunity.customer_id
  }

  if (!customer && customerId) {
    const { data, error } = await supabase
      .from('customers')
      .select('id, full_name, phone, email')
      .eq('id', customerId)
      .eq('is_deleted', false)
      .single()

    if (error || !data) return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    customer = data as CustomerRecord
  }

  const recipientRaw = explicitTo ?? customer?.phone ?? null
  if (!recipientRaw) return NextResponse.json({ error: 'SMS recipient phone number required' }, { status: 400 })

  const normalizedTo = normalizePhoneToE164(recipientRaw)
  if (!normalizedTo.isE164) {
    return NextResponse.json({ error: `Invalid recipient phone number: ${recipientRaw}` }, { status: 400 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  const agentName = profile?.full_name ?? one(opportunity?.agent)?.full_name ?? ''
  const templateVars = {
    customer_first_name: firstName(customer?.full_name),
    customer_full_name: customer?.full_name ?? '',
    agent_first_name: firstName(agentName),
    agent_full_name: agentName,
    company_phone: COMPANY_PHONE,
    move_date: opportunity?.service_date ?? '',
    origin_city: opportunity?.origin_city ?? '',
    destination_city: opportunity?.dest_city ?? '',
    ...(body.vars ?? {}),
  }

  let text = directMessage?.trim() ?? null
  if (templateId) {
    const { data: tpl } = await supabase
      .from('communication_templates')
      .select('*')
      .eq('id', templateId)
      .eq('channel', 'sms')
      .eq('is_active', true)
      .single()

    if (!tpl) return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    text = (await renderTemplate(tpl.body, templateVars)).trim()
  }

  if (!text) return NextResponse.json({ error: 'Message content required' }, { status: 400 })
  if (text.length > SMS_MAX_LENGTH) return NextResponse.json({ error: 'SMS message is too long.' }, { status: 400 })

  await logAuditEvent({
    actorUserId: user.id,
    action: 'sms_send_attempted',
    entityType: 'communication',
    entityId: opportunityId ?? customerId,
    oldData: null,
    newData: { provider, opportunityId, customerId, to: maskPhone(normalizedTo.normalized), templateId } as unknown as Json,
    ipAddress: req.headers.get('x-forwarded-for'),
    userAgent: req.headers.get('user-agent'),
  })

  async function saveComm(status: 'sent' | 'failed', providerMessageId: string | null, errorMessage: string | null) {
    const base = {
      opportunity_id: opportunityId,
      customer_id: customerId,
      type: 'sms',
      direction: 'outbound',
      body: text,
      created_by: user.id,
    }
    const full = {
      ...base,
      phone_number: normalizedTo.normalized,
      status,
      provider,
      provider_message_id: providerMessageId,
      error_message: errorMessage,
    }
    const result = await supabase.from('communications').insert(full).select().single()
    // Graceful fallback if extended columns are missing
    if (result.error?.code === '42703') {
      return supabase.from('communications').insert(base).select().single()
    }
    return result
  }

  // ── Twilio path — never touches ringcentral_user_connections ─────
  if (provider === 'twilio') {
    try {
      const result = await sendSmsTwilio(normalizedTo.normalized, text)
      const { data, error } = await saveComm('sent', result.sid, null)
      if (error) {
        console.error('[SMS/Twilio] Failed to save communication record:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      await logAuditEvent({
        actorUserId: user.id,
        action: 'sms_sent',
        entityType: 'communication',
        entityId: data?.id ?? opportunityId ?? customerId,
        newData: { provider: 'twilio', sid: result.sid, to: maskPhone(normalizedTo.normalized) } as unknown as Json,
        ipAddress: req.headers.get('x-forwarded-for'),
        userAgent: req.headers.get('user-agent'),
      })
      return NextResponse.json({ success: true, provider: 'twilio', sid: result.sid }, { status: 200 })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Twilio SMS failed.'
      console.error('[SMS/Twilio] Send error:', msg)
      await saveComm('failed', null, msg)
      await logAuditEvent({
        actorUserId: user.id,
        action: 'sms_failed',
        entityType: 'communication',
        entityId: opportunityId ?? customerId,
        newData: { provider: 'twilio', error: msg, to: maskPhone(normalizedTo.normalized) } as unknown as Json,
        ipAddress: req.headers.get('x-forwarded-for'),
        userAgent: req.headers.get('user-agent'),
      })
      return NextResponse.json({ error: msg }, { status: 502 })
    }
  }

  // ── RingCentral path — only reached when SMS_PROVIDER=ringcentral ─
  if (provider === 'ringcentral') {
    let ringCentralConnection: Awaited<ReturnType<typeof getRingCentralUserConnection>>
    try {
      ringCentralConnection = await getRingCentralUserConnection(user.id)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'RingCentral connection failed.'
      console.error('[SMS/RingCentral] Connection error:', msg)
      await saveComm('failed', null, msg)
      return NextResponse.json({ error: msg }, { status: 503 })
    }

    if (!ringCentralConnection) {
      const msg = 'Connect your RingCentral account in Settings > Integrations before sending SMS.'
      await saveComm('failed', null, msg)
      return NextResponse.json({ error: msg }, { status: 503 })
    }

    try {
      const result = await sendSmsViaRingCentral({
        to: normalizedTo.normalized,
        from: ringCentralConnection.smsFromNumber,
        accessToken: ringCentralConnection.accessToken,
        text,
      })
      const { data, error } = await saveComm('sent', result.id ?? null, null)
      if (error) {
        console.error('[SMS/RingCentral] Failed to save communication record:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      await logAuditEvent({
        actorUserId: user.id,
        action: 'sms_sent',
        entityType: 'communication',
        entityId: data?.id ?? opportunityId ?? customerId,
        newData: { provider: 'ringcentral', messageId: result.id ?? null, to: maskPhone(normalizedTo.normalized) } as unknown as Json,
        ipAddress: req.headers.get('x-forwarded-for'),
        userAgent: req.headers.get('user-agent'),
      })
      return NextResponse.json({ success: true, provider: 'ringcentral', result }, { status: 200 })
    } catch (err) {
      const msg = err instanceof RingCentralCallError
        ? err.message
        : err instanceof Error ? err.message : 'RingCentral SMS failed.'
      console.error('[SMS/RingCentral] Send error:', msg)
      await saveComm('failed', null, msg)
      await logAuditEvent({
        actorUserId: user.id,
        action: 'sms_failed',
        entityType: 'communication',
        entityId: opportunityId ?? customerId,
        newData: { provider: 'ringcentral', error: msg, to: maskPhone(normalizedTo.normalized) } as unknown as Json,
        ipAddress: req.headers.get('x-forwarded-for'),
        userAgent: req.headers.get('user-agent'),
      })
      return NextResponse.json({ error: msg }, { status: err instanceof RingCentralCallError && err.status ? err.status : 502 })
    }
  }

  return NextResponse.json({ error: 'SMS provider is not configured.' }, { status: 503 })
}
