import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { normalizeRole } from '@/lib/auth/permissions'
import { requireActiveProfile } from '@/lib/auth/server'
import { logAuditEvent } from '@/lib/audit/logAuditEvent'
import { getOrCreateEstimatePortalLink, portalEstimateUrl } from '@/lib/estimates/portal'
import { getSmsDeliveryStatus, getSmsProvider } from '@/lib/sms/provider'
import { sendSmsTwilio } from '@/lib/sms/twilio'
import { sendSmsViaRingCentral, RingCentralCallError } from '@/lib/ringcentral/client'
import { getRingCentralUserConnection } from '@/lib/ringcentral/oauth'
import { normalizePhoneToE164 } from '@/lib/phone/normalizePhone'
import type { Json } from '@/types/database'

const DEFAULT_DEPOSIT = 150
const COMPANY_PHONE = '(800) 321-3222'

type CustomerField = { id: string; full_name: string; email: string | null; phone: string | null }[] | { id: string; full_name: string; email: string | null; phone: string | null } | null
type ProfilesField = { full_name: string | null; email: string | null }[] | { full_name: string | null; email: string | null } | null

function one<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null
  return Array.isArray(v) ? v[0] ?? null : v
}

function appOrigin(req: NextRequest) {
  return process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin
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
  if (!['owner', 'admin', 'manager', 'sales', 'dispatcher'].includes(normalizedRole)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Check SMS delivery capability before doing anything
  const smsStatus = getSmsDeliveryStatus()
  if (!smsStatus.canSend) {
    return NextResponse.json({
      error: `SMS delivery is not active: ${smsStatus.reason}`,
      recommendation: smsStatus.recommendation ?? null,
    }, { status: 503 })
  }

  const body = await req.json()
  const opportunityId = typeof body.opportunityId === 'string' ? body.opportunityId : null
  const quoteId = typeof body.quoteId === 'string' ? body.quoteId : null
  const customMessage = typeof body.message === 'string' && body.message.trim() ? body.message.trim() : null
  const depositAmount = body.depositAmount != null ? Number(body.depositAmount) : null

  if (!opportunityId) return NextResponse.json({ error: 'opportunityId is required' }, { status: 400 })

  const { data: opportunity, error: oppErr } = await supabase
    .from('opportunities')
    .select('*, customer:customers!customer_id(id, full_name, email, phone), agent:profiles!sales_agent_id(full_name, email)')
    .eq('id', opportunityId)
    .eq('is_deleted', false)
    .single()

  if (oppErr || !opportunity) {
    return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
  }
  if (normalizedRole === 'sales' && opportunity.sales_agent_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const customer = one(opportunity.customer as CustomerField)
  const agent = one(opportunity.agent as ProfilesField)

  const toPhone = customer?.phone ?? null
  if (!toPhone) {
    return NextResponse.json({ error: 'Customer has no phone number on file.' }, { status: 400 })
  }

  const normalized = normalizePhoneToE164(toPhone)
  if (!normalized.isE164) {
    return NextResponse.json({ error: `Customer phone number is not valid for SMS: ${toPhone}` }, { status: 400 })
  }

  const { data: senderProfile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  const senderName = senderProfile?.full_name ?? agent?.full_name ?? 'Kratos Moving'
  const senderFirst = senderName.split(' ')[0] ?? 'Kratos'
  const customerFirst = customer?.full_name?.split(' ')[0] ?? 'there'
  const resolvedDeposit = depositAmount ?? Number(opportunity.deposit_amount ?? DEFAULT_DEPOSIT)

  // Generate portal link server-side
  let portalToken: string
  try {
    const admin = createAdminClient()
    const link = await getOrCreateEstimatePortalLink({ supabase: admin, opportunityId, quoteId, createdBy: user.id })
    portalToken = link.token
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unable to create estimate portal link.'
    console.error('[Estimate SMS] Portal link generation failed:', { opportunityId, error: message })
    return NextResponse.json({ error: message }, { status: 500 })
  }

  const portalUrl = portalEstimateUrl(appOrigin(req), portalToken)
  const depositStr = resolvedDeposit > 0
    ? `CA$${resolvedDeposit.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : ''

  const smsText = customMessage
    ?? `Hi ${customerFirst}, your Kratos Moving estimate is ready. View it here: ${portalUrl}${depositStr ? ` — Deposit to secure your move: ${depositStr}` : ''} Questions? Call us at ${COMPANY_PHONE}. — ${senderFirst}, Kratos Moving`

  if (smsText.length > 1600) {
    return NextResponse.json({ error: 'SMS message is too long.' }, { status: 400 })
  }

  await logAuditEvent({
    actorUserId: user.id,
    action: 'estimate_sms_send_attempted',
    entityType: 'opportunity',
    entityId: opportunityId,
    newData: { opportunityId, to: maskPhone(normalized.normalized), provider: getSmsProvider() } as unknown as Json,
    ipAddress: req.headers.get('x-forwarded-for'),
    userAgent: req.headers.get('user-agent'),
  })

  const provider = getSmsProvider()
  let messageId: string | null = null

  async function saveSmsCommunication(status: 'sent' | 'failed', errorMessage: string | null) {
    const base = {
      opportunity_id: opportunityId,
      customer_id: customer?.id ?? opportunity.customer_id,
      type: 'sms',
      direction: 'outbound',
      body: errorMessage ? `${smsText}\n\nSend error: ${errorMessage}` : smsText,
      created_by: user.id,
    }
    const full = {
      ...base,
      provider,
      provider_message_id: messageId,
      status,
      phone_number: normalized.normalized,
      error_message: errorMessage,
    }

    const result = await supabase.from('communications').insert(full).select().single()
    if (!result.error) return result

    console.error('[Estimate SMS] Full communication insert failed; falling back to base insert:', result.error)
    return supabase.from('communications').insert(base).select().single()
  }

  try {
    if (provider === 'twilio') {
      const result = await sendSmsTwilio(normalized.normalized, smsText)
      messageId = result.sid
    } else if (provider === 'ringcentral') {
      const conn = await getRingCentralUserConnection(user.id)
      if (!conn) throw new Error('Connect your RingCentral account in Settings > Integrations.')
      const result = await sendSmsViaRingCentral({
        to: normalized.normalized,
        from: conn.smsFromNumber,
        accessToken: conn.accessToken,
        text: smsText,
      })
      messageId = result.id ?? null
    }
  } catch (err) {
    const msg = err instanceof RingCentralCallError
      ? err.message
      : err instanceof Error ? err.message : 'SMS send failed.'
    console.error('[Estimate SMS] Send failed:', { opportunityId, provider, error: msg })

    const { error: commErr } = await saveSmsCommunication('failed', msg)
    if (commErr) console.error('[Estimate SMS] Failed to save failed SMS communication:', commErr)

    await logAuditEvent({
      actorUserId: user.id,
      action: 'estimate_sms_failed',
      entityType: 'opportunity',
      entityId: opportunityId,
      newData: { opportunityId, provider, error: msg, to: maskPhone(normalized.normalized) } as unknown as Json,
      ipAddress: req.headers.get('x-forwarded-for'),
      userAgent: req.headers.get('user-agent'),
    })

    return NextResponse.json({ error: msg }, { status: 502 })
  }

  // Log successful communication with the exact SMS text shown in Sales activity.
  const { data: comm, error: commErr } = await saveSmsCommunication('sent', null)
  if (commErr) {
    console.error('[Estimate SMS] Failed to save sent SMS communication:', commErr)
    return NextResponse.json({ error: `Estimate SMS sent, but activity logging failed: ${commErr.message}` }, { status: 500 })
  }

  await supabase
    .from('opportunities')
    .update({ estimate_sent_at: new Date().toISOString(), estimate_sent_by: user.id })
    .eq('id', opportunityId)

  await logAuditEvent({
    actorUserId: user.id,
    action: 'estimate_sms_sent',
    entityType: 'opportunity',
    entityId: opportunityId,
    newData: { opportunityId, provider, messageId, to: maskPhone(normalized.normalized), portalToken } as unknown as Json,
    ipAddress: req.headers.get('x-forwarded-for'),
    userAgent: req.headers.get('user-agent'),
  })

  return NextResponse.json({ ok: true, provider, portalUrl, communicationId: comm?.id ?? null }, { status: 200 })
}
