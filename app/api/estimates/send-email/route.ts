import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { normalizeRole } from '@/lib/auth/permissions'
import { requireActiveProfile } from '@/lib/auth/server'
import { logAuditEvent } from '@/lib/audit/logAuditEvent'
import { getOrCreateEstimatePortalLink, portalEstimateUrl } from '@/lib/estimates/portal'
import { emailConfigError, sendEmail } from '@/lib/email/sendEmail'
import { renderTemplate } from '@/lib/ringcentral/client'
import { formatQuoteNumber } from '@/lib/opportunityDisplay'
import type { Json } from '@/types/database'

const COMPANY_PHONE = '(800) 321-3222'
const DEFAULT_DEPOSIT_AMOUNT = 150
const DEFAULT_ESTIMATE_EMAIL_BODY = `Hi {{customer_first_name}},

Your Kratos Moving estimate is ready for review.

You can view your estimate here:
{{estimate_link}}

Deposit required to secure your move:
{{deposit_amount}}

If you have any questions or would like to make changes, please reply to this email or call us at {{company_phone}}.

Thank you,
{{agent_first_name}}
Kratos Moving Inc.`

type ProfilesField = { full_name: string | null; email: string | null }[] | { full_name: string | null; email: string | null } | null
type CustomerField = { id: string; full_name: string; email: string | null; phone: string | null }[] | { id: string; full_name: string; email: string | null; phone: string | null } | null

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

function firstName(name: string | null | undefined) {
  return name?.trim().split(/\s+/)[0] ?? ''
}

function money(value: number | string | null | undefined) {
  const amount = Number(value ?? 0)
  return amount.toLocaleString('en-CA', { style: 'currency', currency: 'CAD' })
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }[char] as string))
}

function htmlFromText(text: string) {
  return `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">${escapeHtml(text).replace(/\n/g, '<br />')}</div>`
}

function appOrigin(req: NextRequest) {
  return process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin
}

function senderForProfile(email: string | null | undefined) {
  const mapped: Record<string, { name: string; email: string }> = {
    'sales@kratosmoving.com': { name: 'Euliza from Kratos Moving', email: 'sales@kratosmoving.com' },
    'info@kratosmoving.com': { name: 'Alex from Kratos Moving', email: 'info@kratosmoving.com' },
    'operations@kratosmoving.com': { name: 'Kevin from Kratos Moving', email: 'operations@kratosmoving.com' },
    'mustafa@kratosmoving.com': { name: 'Mustafa from Kratos Moving', email: 'mustafa@kratosmoving.com' },
  }
  const normalized = email?.toLowerCase()
  const identity = normalized ? mapped[normalized] : null
  const allowProfileFrom = process.env.EMAIL_ALLOW_PROFILE_FROM === 'true'

  if (identity && allowProfileFrom) {
    return { fromName: identity.name, fromEmail: identity.email, replyTo: identity.email }
  }

  return {
    fromName: 'Kratos Moving',
    fromEmail: process.env.EMAIL_FROM_DEFAULT,
    replyTo: identity?.email ?? email ?? process.env.EMAIL_REPLY_TO_DEFAULT,
  }
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

  const body = await req.json()
  const opportunityId = typeof body.opportunityId === 'string' ? body.opportunityId : null
  const quoteId = typeof body.quoteId === 'string' ? body.quoteId : null
  const recipientEmail = typeof body.recipientEmail === 'string' ? body.recipientEmail.trim() : ''
  const pricingDisplay = typeof body.pricingDisplay === 'string' ? body.pricingDisplay : 'estimated_price'
  const depositAmount = body.depositAmount === undefined || body.depositAmount === null ? null : Number(body.depositAmount)
  const customMessage = typeof body.message === 'string' && body.message.trim() ? body.message.trim() : null

  if (!opportunityId) return NextResponse.json({ error: 'opportunityId is required' }, { status: 400 })
  if (!recipientEmail) return NextResponse.json({ error: 'Recipient email is required' }, { status: 400 })
  if (depositAmount !== null && (!Number.isFinite(depositAmount) || depositAmount < 0)) {
    return NextResponse.json({ error: 'Deposit amount must be zero or greater.' }, { status: 400 })
  }

  const { data: opportunity, error } = await supabase
    .from('opportunities')
    .select('*, customer:customers!customer_id(id, full_name, email, phone), agent:profiles!sales_agent_id(full_name, email)')
    .eq('id', opportunityId)
    .eq('is_deleted', false)
    .single()

  if (error || !opportunity) return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 })
  if (normalizedRole === 'sales' && opportunity.sales_agent_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', user.id)
    .single()

  const customer = one(opportunity.customer as CustomerField)
  const agent = one(opportunity.agent as ProfilesField)
  const savedDeposit = Number(opportunity.deposit_amount ?? DEFAULT_DEPOSIT_AMOUNT)
  const resolvedDeposit = depositAmount ?? (Number.isFinite(savedDeposit) && savedDeposit > 0 ? savedDeposit : DEFAULT_DEPOSIT_AMOUNT)

  await logAuditEvent({
    actorUserId: user.id,
    action: 'estimate_email_send_attempted',
    entityType: 'opportunity',
    entityId: opportunityId,
    oldData: null,
    newData: { opportunityId, quoteId, recipientEmail, pricingDisplay, depositAmount: resolvedDeposit } as Json,
    ipAddress: req.headers.get('x-forwarded-for'),
    userAgent: req.headers.get('user-agent'),
  })

  let link: Awaited<ReturnType<typeof getOrCreateEstimatePortalLink>>
  try {
    link = await getOrCreateEstimatePortalLink({ supabase, opportunityId, quoteId, createdBy: user.id })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unable to create estimate portal link.'
    await logAuditEvent({
      actorUserId: user.id,
      action: 'estimate_email_failed',
      entityType: 'opportunity',
      entityId: opportunityId,
      oldData: null,
      newData: { opportunityId, quoteId, recipientEmail, error: message } as Json,
      ipAddress: req.headers.get('x-forwarded-for'),
      userAgent: req.headers.get('user-agent'),
    })
    return NextResponse.json({ error: message }, { status: 500 })
  }

  const estimateLink = portalEstimateUrl(appOrigin(req), link.token)

  const vars = {
    customer_first_name: firstName(customer?.full_name),
    customer_full_name: customer?.full_name ?? '',
    agent_first_name: firstName(profile?.full_name ?? agent?.full_name),
    agent_full_name: profile?.full_name ?? agent?.full_name ?? '',
    company_phone: process.env.COMPANY_PHONE || COMPANY_PHONE,
    move_date: opportunity.service_date ?? '',
    origin_address: [opportunity.origin_address_line1, opportunity.origin_city, opportunity.origin_province, opportunity.origin_postal_code].filter(Boolean).join(', '),
    destination_address: [opportunity.dest_address_line1, opportunity.dest_city, opportunity.dest_province, opportunity.dest_postal_code].filter(Boolean).join(', '),
    origin_city: opportunity.origin_city ?? '',
    destination_city: opportunity.dest_city ?? '',
    estimate_link: estimateLink,
    deposit_amount: money(resolvedDeposit),
    quote_number: formatQuoteNumber(opportunity.opportunity_number),
  }

  const { data: template } = await supabase
    .from('communication_templates')
    .select('*')
    .eq('channel', 'email')
    .eq('trigger', 'estimate_ready')
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  const subject = await renderTemplate(template?.subject ?? 'Your Kratos Moving estimate is ready', vars)
  const text = customMessage ?? await renderTemplate(template?.body || DEFAULT_ESTIMATE_EMAIL_BODY, vars)

  await supabase
    .from('opportunities')
    .update({ deposit_amount: resolvedDeposit })
    .eq('id', opportunityId)

  try {
    const sender = senderForProfile(profile?.email)
    if (!sender.fromEmail) throw new Error(emailConfigError())
    const result = await sendEmail({
      to: recipientEmail,
      subject,
      text,
      html: htmlFromText(text),
      fromName: sender.fromName,
      fromEmail: sender.fromEmail,
      replyTo: sender.replyTo,
    })

    await supabase.from('communications').insert({
      opportunity_id: opportunityId,
      customer_id: customer?.id ?? opportunity.customer_id,
      type: 'email',
      direction: 'outbound',
      subject,
      body: text,
      email_to: recipientEmail,
      provider: result.provider,
      provider_message_id: result.id ?? null,
      status: 'sent',
      created_by: user.id,
    })

    await supabase
      .from('opportunities')
      .update({
        deposit_amount: resolvedDeposit,
        estimate_sent_at: new Date().toISOString(),
        estimate_sent_by: user.id,
      })
      .eq('id', opportunityId)

    await logAuditEvent({
      actorUserId: user.id,
      action: 'estimate_email_sent',
      entityType: 'opportunity',
      entityId: opportunityId,
      oldData: null,
      newData: {
        opportunityId,
        quoteId,
        recipientEmail,
        pricingDisplay,
        depositAmount: resolvedDeposit,
        portalLinkId: link.id,
        emailProvider: result.provider,
      } as Json,
      ipAddress: req.headers.get('x-forwarded-for'),
      userAgent: req.headers.get('user-agent'),
    })

    return NextResponse.json({ ok: true, portalUrl: estimateLink })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unable to send estimate email.'
    console.error('Estimate email failed:', err)
    await supabase.from('communications').insert({
      opportunity_id: opportunityId,
      customer_id: customer?.id ?? opportunity.customer_id,
      type: 'email',
      direction: 'outbound',
      subject,
      body: text,
      email_to: recipientEmail,
      provider: process.env.EMAIL_PROVIDER ?? null,
      status: 'failed',
      error_message: message,
      created_by: user.id,
    })
    await logAuditEvent({
      actorUserId: user.id,
      action: 'estimate_email_failed',
      entityType: 'opportunity',
      entityId: opportunityId,
      oldData: null,
      newData: {
        opportunityId,
        quoteId,
        recipientEmail,
        pricingDisplay,
        depositAmount: resolvedDeposit,
        portalLinkId: link.id,
        error: message,
      } as Json,
      ipAddress: req.headers.get('x-forwarded-for'),
      userAgent: req.headers.get('user-agent'),
    })
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
