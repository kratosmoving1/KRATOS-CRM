import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireActiveProfile } from '@/lib/auth/server'
import { normalizeRole, type CrmRole } from '@/lib/auth/permissions'
import { logAuditEvent } from '@/lib/audit/logAuditEvent'
import { sendEmail } from '@/lib/email/sendEmail'
import type { Json } from '@/types/database'

const EMAIL_ALLOWED_ROLES: CrmRole[] = ['owner', 'admin', 'manager', 'sales', 'dispatcher']

type EmailSendBody = {
  opportunityId?: string | null
  customerId?: string | null
  templateId?: string | null
  toEmail?: string | null
  to?: string | null
  subject?: string | null
  messageBody?: string | null
  body?: string | null
  vars?: Record<string, string | undefined>
}

type CustomerRecord = {
  id: string
  full_name: string
  email: string | null
  phone: string | null
}

type OpportunityRecord = {
  id: string
  opportunity_number: string | null
  customer_id: string
  sales_agent_id: string | null
  service_date: string | null
  deposit_amount: number | null
  customer?: CustomerRecord | CustomerRecord[] | null
  agent?: { full_name: string | null } | { full_name: string | null }[] | null
}

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

function firstName(fullName: string | null | undefined) {
  return fullName?.trim().split(/\s+/)[0] ?? ''
}

function missingResendEnv() {
  return [
    'EMAIL_PROVIDER',
    'RESEND_API_KEY',
    'EMAIL_FROM_DEFAULT',
    'EMAIL_REPLY_TO_DEFAULT',
    'NEXT_PUBLIC_APP_URL',
  ].filter(key => !process.env[key])
}

function renderMerge(text: string, vars: Record<string, string | undefined>) {
  return text.replace(/{{\s*([^}]+?)\s*}}/g, (_match, key: string) => vars[key.trim()] ?? '')
}

function textToHtml(text: string) {
  return text
    .split(/\n{2,}/)
    .map(paragraph => `<p>${paragraph.replace(/[&<>]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[char] ?? char)).replace(/\n/g, '<br />')}</p>`)
    .join('')
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const auth = await requireActiveProfile(supabase)
  if (auth.response) return auth.response
  const { user, role } = auth.context
  const normalizedRole = normalizeRole(role)

  if (!EMAIL_ALLOWED_ROLES.includes(normalizedRole)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (process.env.EMAIL_PROVIDER !== 'resend' || missingResendEnv().length > 0) {
    return NextResponse.json({ error: 'Resend email is not configured.' }, { status: 503 })
  }

  let body: EmailSendBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const opportunityId = body.opportunityId ?? null
  let customerId = body.customerId ?? null
  const templateId = body.templateId ?? null
  const explicitTo = body.toEmail ?? body.to ?? null

  if (!opportunityId && !customerId) {
    return NextResponse.json({ error: 'opportunityId or customerId required' }, { status: 400 })
  }

  let opportunity: OpportunityRecord | null = null
  let customer: CustomerRecord | null = null

  if (opportunityId) {
    const { data, error } = await supabase
      .from('opportunities')
      .select('id, opportunity_number, customer_id, sales_agent_id, service_date, deposit_amount, customer:customers!customer_id(id, full_name, email, phone), agent:profiles!sales_agent_id(full_name)')
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
      .select('id, full_name, email, phone')
      .eq('id', customerId)
      .eq('is_deleted', false)
      .single()
    if (error || !data) return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    customer = data as CustomerRecord
  }

  const to = explicitTo ?? customer?.email ?? null
  if (!to) return NextResponse.json({ error: 'Recipient email required' }, { status: 400 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  const agentName = profile?.full_name ?? one(opportunity?.agent)?.full_name ?? ''
  const vars = {
    customer_name: customer?.full_name ?? '',
    agent_first_name: firstName(agentName),
    company_name: 'Kratos Moving',
    quote_number: opportunity?.opportunity_number ?? '',
    move_date: opportunity?.service_date ?? '',
    deposit_amount: opportunity?.deposit_amount != null ? `$${Number(opportunity.deposit_amount).toFixed(2)}` : '—',
    portal_link: process.env.NEXT_PUBLIC_APP_URL ?? '',
    phone_number: customer?.phone ?? '',
    ...(body.vars ?? {}),
  }

  let subject = body.subject?.trim() || 'Kratos Moving follow-up'
  let text = (body.messageBody ?? body.body ?? '').trim()

  if (templateId) {
    const { data: tpl } = await supabase
      .from('communication_templates')
      .select('subject, body')
      .eq('id', templateId)
      .eq('channel', 'email')
      .eq('is_active', true)
      .single()
    if (!tpl) return NextResponse.json({ error: 'Email template not found or inactive' }, { status: 404 })
    subject = renderMerge(tpl.subject || subject, vars).trim()
    text = renderMerge(tpl.body, vars).trim()
  } else {
    subject = renderMerge(subject, vars).trim()
    text = renderMerge(text, vars).trim()
  }

  if (!text) return NextResponse.json({ error: 'Email body required' }, { status: 400 })

  await logAuditEvent({
    actorUserId: user.id,
    action: 'email_send_attempted',
    entityType: 'communication',
    entityId: opportunityId ?? customerId,
    oldData: null,
    newData: { provider: 'resend', opportunityId, customerId, to } as unknown as Json,
    ipAddress: req.headers.get('x-forwarded-for'),
    userAgent: req.headers.get('user-agent'),
  })

  async function saveComm(status: 'sent' | 'failed', providerMessageId: string | null, errorMessage: string | null) {
    const base = {
      opportunity_id: opportunityId,
      customer_id: customerId,
      type: 'email',
      direction: 'outbound',
      subject,
      body: text,
      email_to: to,
      created_by: user.id,
    }
    const full = {
      ...base,
      status,
      provider: 'resend',
      provider_message_id: providerMessageId,
      error_message: errorMessage,
    }
    const result = await supabase.from('communications').insert(full).select().single()
    if (result.error?.code === '42703') {
      return supabase.from('communications').insert(base).select().single()
    }
    return result
  }

  try {
    const result = await sendEmail({
      to,
      subject,
      text,
      html: textToHtml(text),
    })
    const { data, error } = await saveComm('sent', result.id ?? null, null)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await logAuditEvent({
      actorUserId: user.id,
      action: 'email_sent',
      entityType: 'communication',
      entityId: data?.id ?? opportunityId ?? customerId,
      newData: { provider: 'resend', messageId: result.id ?? null, to } as unknown as Json,
      ipAddress: req.headers.get('x-forwarded-for'),
      userAgent: req.headers.get('user-agent'),
    })
    return NextResponse.json({ success: true, provider: 'resend', id: result.id ?? null }, { status: 200 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Email send failed.'
    await saveComm('failed', null, msg)
    await logAuditEvent({
      actorUserId: user.id,
      action: 'email_failed',
      entityType: 'communication',
      entityId: opportunityId ?? customerId,
      newData: { provider: 'resend', error: msg, to } as unknown as Json,
      ipAddress: req.headers.get('x-forwarded-for'),
      userAgent: req.headers.get('user-agent'),
    })
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
