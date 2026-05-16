import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireActiveProfile } from '@/lib/auth/server'
import { normalizeRole, type CrmRole } from '@/lib/auth/permissions'
import { logAuditEvent } from '@/lib/audit/logAuditEvent'
import type { Json } from '@/types/database'
import {
  getMissingRingCentralEnv,
  isRingCentralConfigured,
  RingCentralCallError,
  sendSmsViaRingCentral,
  renderTemplate,
} from '@/lib/ringcentral/client'
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

function quoteLink(opportunityId: string | null) {
  return opportunityId ? `/admin/opportunities/${opportunityId}/quote` : ''
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
    return NextResponse.json({ error: `RingCentral SMS failed: Invalid recipient phone number: ${recipientRaw}` }, { status: 400 })
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
    estimate_link: quoteLink(opportunityId),
    booking_link: quoteLink(opportunityId),
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
    newData: {
      opportunityId,
      customerId,
      phoneNumber: normalizedTo.normalized,
      templateId,
    } as unknown as Json,
    ipAddress: req.headers.get('x-forwarded-for'),
    userAgent: req.headers.get('user-agent'),
  })

  async function saveCommunication(status: 'sent' | 'failed', providerMessageId: string | null, errorMessage: string | null) {
    return supabase.from('communications').insert({
      opportunity_id: opportunityId,
      customer_id: customerId,
      type: 'sms',
      direction: 'outbound',
      body: text,
      phone_number: normalizedTo.normalized,
      status,
      provider: 'ringcentral',
      provider_message_id: providerMessageId,
      error_message: errorMessage,
      created_by: user.id,
    }).select().single()
  }

  try {
    if (!isRingCentralConfigured()) {
      const missing = getMissingRingCentralEnv()
      throw new RingCentralCallError(`RingCentral is not configured. Missing: ${missing.join(', ')}`, {
        code: 'RINGCENTRAL_NOT_CONFIGURED',
      })
    }

    const result = await sendSmsViaRingCentral({
      to: normalizedTo.normalized,
      from: process.env.RINGCENTRAL_FROM_NUMBER || '',
      text,
    })

    const { data, error } = await saveCommunication('sent', result.id ?? null, null)

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
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'SMS send failed'
    const responseMessage = errorMessage.startsWith('RingCentral is not configured.')
      ? errorMessage
      : `RingCentral SMS failed: ${errorMessage}`

    const { data: failedComm, error: failedCommError } = await saveCommunication('failed', null, errorMessage)
    if (failedCommError) console.error('Saving failed SMS communication failed:', failedCommError)

    console.error('SMS send error:', {
      message: errorMessage,
      status: err instanceof RingCentralCallError ? err.status : undefined,
      code: err instanceof RingCentralCallError ? err.code : undefined,
      details: err instanceof RingCentralCallError ? err.details : undefined,
    })

    await logAuditEvent({
      actorUserId: user.id,
      action: 'sms_failed',
      entityType: 'communication',
      entityId: failedComm?.id ?? null,
      oldData: null,
      newData: {
        error: errorMessage,
        opportunityId,
        customerId,
        phoneNumber: normalizedTo.normalized,
        templateId,
      } as unknown as Json,
      ipAddress: req.headers.get('x-forwarded-for'),
      userAgent: req.headers.get('user-agent'),
    })
    return NextResponse.json(
      { error: responseMessage, comm: failedComm ?? null },
      { status: err instanceof RingCentralCallError && err.status ? err.status : 500 },
    )
  }
}
