import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { requireActiveProfile } from '@/lib/auth/server'
import { getTemplate } from '@/lib/templates/follow-up-templates'
import { interpolate, type InterpolationContext } from '@/lib/templates/interpolate'
import { sendSmsTwilio } from '@/lib/sms/twilio'
import { sendEmail } from '@/lib/email/sendEmail'
import { normalizePhoneToE164 } from '@/lib/phone/normalizePhone'

// Verified live columns for communications — confirmed 2026-06-03 via REST API.
// phone_number, status, provider, provider_message_id, error_message do NOT exist.
const COMMUNICATIONS_COLUMNS = new Set([
  'id', 'opportunity_id', 'customer_id', 'type', 'direction',
  'subject', 'body', 'call_outcome', 'call_duration_seconds',
  'email_to', 'email_cc', 'created_by', 'company_id', 'created_at', 'is_deleted',
])

function filterComm(payload: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(payload).filter(([k]) => COMMUNICATIONS_COLUMNS.has(k)),
  )
}

// Outcomes that warrant a follow-up send
const FOLLOW_UP_OUTCOMES = new Set(['no_answer', 'busy', 'voicemail'])

function defaultCallBody(direction: string, outcome: string | null): string {
  const dir = direction === 'inbound' ? 'Inbound' : 'Outbound'
  const outcomeLabel: Record<string, string> = {
    connected:          'connected',
    no_answer:          'no answer',
    voicemail:          'left voicemail',
    busy:               'line busy',
    wrong_number:       'wrong number',
    left_live_message:  'left live message',
    number_disconnected: 'number disconnected',
    pending:            'pending',
  }
  const out = outcome ? (outcomeLabel[outcome] ?? outcome) : 'logged'
  return `${dir} call — ${out}`
}

// Valid call outcomes per SCHEMA.md
const VALID_OUTCOMES = new Set([
  'connected', 'voicemail', 'no_answer', 'wrong_number',
  'busy', 'pending', 'left_live_message', 'number_disconnected',
])

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  // Auth — user session client for auth check, then admin client for DB ops
  const sessionClient = createClient()
  const auth = await requireActiveProfile(sessionClient)
  if (auth.response) return auth.response
  const { user } = auth.context
  const db = createAdminClient()

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const direction          = String(body.direction ?? 'outbound')
  const outcome            = body.outcome ? String(body.outcome) : null
  const description        = body.description ? String(body.description).trim() : null
  const smsTplId           = body.sms_template_id ? String(body.sms_template_id) : null
  const smsBodyOverride    = body.sms_body_override ? String(body.sms_body_override).trim() : null
  const emailTplId         = body.email_template_id ? String(body.email_template_id) : null
  const emailSubjectOverride = body.email_subject_override ? String(body.email_subject_override).trim() : null
  const emailBodyOverride  = body.email_body_override ? String(body.email_body_override).trim() : null

  if (outcome && !VALID_OUTCOMES.has(outcome)) {
    return NextResponse.json({ error: `Invalid call outcome: ${outcome}` }, { status: 400 })
  }

  // Load opportunity (admin client to bypass RLS on is_deleted=null rows)
  const { data: opp, error: oppErr } = await db
    .from('opportunities')
    .select('id, customer_id, opportunity_number, service_date, move_size')
    .eq('id', params.id)
    .neq('is_deleted', true)
    .single()

  if (oppErr || !opp) {
    return NextResponse.json({ error: `Opportunity ${params.id} not found` }, { status: 404 })
  }

  // Load customer
  const { data: customer, error: custErr } = await db
    .from('customers')
    .select('id, full_name, email, phone')
    .eq('id', opp.customer_id)
    .neq('is_deleted', true)
    .single()

  if (custErr || !customer) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
  }

  // Load agent profile
  const { data: agent } = await db
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  const ctx: InterpolationContext = {
    customer: { full_name: customer.full_name ?? '' },
    opportunity: {
      opportunity_number: opp.opportunity_number,
      service_date: opp.service_date,
      move_size: opp.move_size,
    },
    agent: { full_name: agent?.full_name ?? '' },
  }

  const errors: string[] = []
  const created: { call: unknown; sms: unknown; email: unknown } = {
    call: null, sms: null, email: null,
  }

  // ── 1. Log the call ─────────────────────────────────────────────────────────
  const { data: callRow, error: callErr } = await db
    .from('communications')
    .insert(filterComm({
      opportunity_id: params.id,
      customer_id:    opp.customer_id,
      type:           'call',
      direction:      direction === 'inbound' ? 'inbound' : 'outbound',
      call_outcome:   outcome ?? null,
      body:           (description && description.trim().length > 0)
                        ? description.trim()
                        : defaultCallBody(direction, outcome),
      created_by:     user.id,
    }))
    .select()
    .single()

  if (callErr) {
    return NextResponse.json({ error: callErr.message }, { status: 500 })
  }
  created.call = callRow

  // ── 2. Optionally send SMS follow-up ────────────────────────────────────────
  const shouldSendFollowUps = outcome ? FOLLOW_UP_OUTCOMES.has(outcome) : false

  if (shouldSendFollowUps && smsTplId) {
    const tpl = getTemplate(smsTplId)
    if (!tpl || tpl.channel !== 'sms') {
      errors.push(`SMS template not found: ${smsTplId}`)
    } else if (!customer.phone) {
      errors.push('SMS not sent — customer has no phone number')
    } else {
      const normalizedPhone = normalizePhoneToE164(customer.phone)
      if (!normalizedPhone.isE164) {
        errors.push(`SMS not sent — invalid phone number: ${customer.phone}`)
      } else {
        const bodyText = smsBodyOverride || interpolate(tpl.body, ctx)
        if (!bodyText.trim()) {
          errors.push('SMS body is empty — not sent')
        } else try {
          const result = await sendSmsTwilio(normalizedPhone.normalized, bodyText)
          console.log('[calls.POST.sms] Twilio success', { sid: result.sid })
          const { data: smsRow, error: smsInsertErr } = await db
            .from('communications')
            .insert(filterComm({
              opportunity_id: params.id,
              customer_id:    opp.customer_id,
              type:           'sms',
              direction:      'outbound',
              body:           bodyText,
              created_by:     user.id,
            }))
            .select()
            .single()
          if (smsInsertErr) {
            console.error('[calls.POST.sms] DB insert failed', smsInsertErr.message)
            errors.push(`SMS sent but not saved: ${smsInsertErr.message}`)
          } else created.sms = smsRow
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Twilio send failed'
          console.error('[calls.POST.sms] Twilio error', msg)
          errors.push(`SMS send failed: ${msg}`)
          await db.from('communications').insert(filterComm({
            opportunity_id: params.id,
            customer_id:    opp.customer_id,
            type:           'sms',
            direction:      'outbound',
            body:           `[Send failed: ${msg}] ${bodyText}`,
            created_by:     user.id,
          }))
        }
      }
    }
  }

  // ── 3. Optionally send email follow-up ──────────────────────────────────────
  if (shouldSendFollowUps && emailTplId) {
    const tpl = getTemplate(emailTplId)
    if (!tpl || tpl.channel !== 'email') {
      errors.push(`Email template not found: ${emailTplId}`)
    } else if (!customer.email) {
      errors.push('Email not sent — customer has no email address')
    } else {
      const subjectText = emailSubjectOverride || interpolate(tpl.subject ?? 'Following up from Kratos Moving', ctx)
      const bodyText    = emailBodyOverride || interpolate(tpl.body, ctx)
      if (!bodyText.trim()) {
        errors.push('Email body is empty — not sent')
      } else try {
        const result = await sendEmail({
          to:      customer.email,
          subject: subjectText,
          text:    bodyText,
          html:    `<pre style="font-family:sans-serif;white-space:pre-wrap">${bodyText}</pre>`,
        })
        const { data: emailRow, error: emailInsertErr } = await db
          .from('communications')
          .insert(filterComm({
            opportunity_id: params.id,
            customer_id:    opp.customer_id,
            type:           'email',
            direction:      'outbound',
            subject:        subjectText,
            body:           bodyText,
            email_to:       customer.email,
            created_by:     user.id,
          }))
          .select()
          .single()
        if (emailInsertErr) {
          console.error('[calls.POST.email] DB insert failed', emailInsertErr.message)
          errors.push(`Email sent but not saved: ${emailInsertErr.message}`)
        } else created.email = emailRow
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Email send failed'
        console.error('[calls.POST.email] send error', msg)
        errors.push(`Email send failed: ${msg}`)
        await db.from('communications').insert(filterComm({
          opportunity_id: params.id,
          customer_id:    opp.customer_id,
          type:           'email',
          direction:      'outbound',
          subject:        subjectText,
          body:           `[Send failed: ${msg}] ${bodyText}`,
          email_to:       customer.email,
          created_by:     user.id,
        }))
      }
    }
  }

  return NextResponse.json({ created, errors }, { status: 201 })
}
