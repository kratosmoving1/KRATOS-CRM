import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireActiveProfile } from '@/lib/auth/server'
import { normalizeRole } from '@/lib/auth/permissions'
import { STATUS_TRANSITIONS, STATUS_TIMESTAMP_MAP, type OppStatus } from '@/lib/constants'
import { sendEmail } from '@/lib/email/sendEmail'
import {
  buildBookingConfirmationHtml,
  buildCancellationEmailHtml,
} from '@/lib/email/estimateEmailHtml'
import { formatQuoteNumber } from '@/lib/opportunityDisplay'

const COMPANY_PHONE = process.env.COMPANY_PHONE ?? '(800) 321-3222'

type CustomerRow = { full_name: string; email: string | null }[] | { full_name: string; email: string | null } | null
type AgentRow    = { full_name: string | null }[] | { full_name: string | null } | null

function one<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null
  return Array.isArray(v) ? v[0] ?? null : v
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createClient()
  const auth = await requireActiveProfile(supabase)
  if (auth.response) return auth.response

  const { user, role } = auth.context
  const normalizedRole = normalizeRole(role)
  if (!['owner', 'admin', 'manager', 'sales', 'dispatcher'].includes(normalizedRole)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const newStatus: OppStatus = body.newStatus
  const cancellationReason: string | undefined = typeof body.cancellationReason === 'string' && body.cancellationReason.trim()
    ? body.cancellationReason.trim()
    : undefined

  if (!newStatus) return NextResponse.json({ error: 'newStatus is required' }, { status: 400 })

  const admin = createAdminClient()

  const { data: opp, error: fetchErr } = await admin
    .from('opportunities')
    .select('id, status, opportunity_number, service_type, service_date, origin_address_line1, origin_city, origin_province, dest_address_line1, dest_city, dest_province, sales_agent_id, customer:customers!customer_id(full_name, email), agent:profiles!sales_agent_id(full_name)')
    .eq('id', params.id)
    .neq('is_deleted', true)
    .single()

  if (fetchErr || !opp) return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 })

  if (normalizedRole === 'sales' && opp.sales_agent_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const currentStatus = opp.status as OppStatus
  const allowed = STATUS_TRANSITIONS[currentStatus] ?? []
  if (!allowed.includes(newStatus)) {
    return NextResponse.json({ error: `Cannot transition from ${currentStatus} to ${newStatus}` }, { status: 422 })
  }

  const tsKey = STATUS_TIMESTAMP_MAP[newStatus]
  const updatePayload: Record<string, unknown> = { status: newStatus }
  if (tsKey) updatePayload[tsKey] = new Date().toISOString()

  const { error: updateErr } = await admin
    .from('opportunities')
    .update(updatePayload)
    .eq('id', params.id)

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  // Audit log
  await admin.from('audit_log').insert({
    user_id:     user.id,
    entity_type: 'opportunity',
    entity_id:   params.id,
    action:      'status_change',
    diff:        { from: currentStatus, to: newStatus, ...(cancellationReason ? { cancellationReason } : {}) },
  })

  // Email notification
  const rawCustomer = opp.customer as CustomerRow
  const rawAgent    = opp.agent as AgentRow
  const customerRow = one(rawCustomer)
  const agentRow    = one(rawAgent)
  const customerName  = customerRow?.full_name ?? 'Customer'
  const customerEmail = customerRow?.email ?? null
  const firstName     = customerName.trim().split(/\s+/)[0] ?? customerName
  const agentFirst    = agentRow?.full_name?.trim().split(/\s+/)[0] ?? ''
  const quoteNumber   = formatQuoteNumber(opp.opportunity_number)

  if (customerEmail) {
    const moveDateLabel = opp.service_date
      ? new Date(opp.service_date + 'T12:00:00').toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' })
      : 'To be confirmed'
    const serviceTypeLabel = String(opp.service_type ?? 'Moving').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    const origin      = [opp.origin_address_line1, opp.origin_city, opp.origin_province].filter(Boolean).join(', ')
    const destination = [opp.dest_address_line1, opp.dest_city, opp.dest_province].filter(Boolean).join(', ')

    let subject = ''
    let html    = ''
    let text    = ''

    if (newStatus === 'booked') {
      subject = `Your Move is Confirmed — Kratos Moving #${quoteNumber}`
      text    = `Hi ${firstName}, your Kratos Moving move has been booked. Move date: ${moveDateLabel}. A coordinator will be in touch shortly.`
      html    = buildBookingConfirmationHtml({
        customerFirstName: firstName,
        customerFullName: customerName,
        quoteNumber,
        moveDate: moveDateLabel,
        serviceType: serviceTypeLabel,
        originAddress: origin,
        destinationAddress: destination,
        companyPhone: COMPANY_PHONE,
        agentFirstName: agentFirst,
      })
    } else if (newStatus === 'cancelled') {
      subject = `Your Kratos Moving Booking Has Been Cancelled — Quote #${quoteNumber}`
      text    = `Hi ${firstName}, your Kratos Moving booking (Quote #${quoteNumber}) has been cancelled.${cancellationReason ? ` Reason: ${cancellationReason}` : ''} If you'd like to rebook, call us at ${COMPANY_PHONE}.`
      html    = buildCancellationEmailHtml({
        customerFirstName: firstName,
        quoteNumber,
        companyPhone: COMPANY_PHONE,
        cancellationReason,
      })
    }

    if (subject && html) {
      sendEmail({
        to: customerEmail,
        subject,
        text,
        html,
        fromName: 'Kratos Moving',
        fromEmail: process.env.EMAIL_FROM_DEFAULT ?? '',
      }).then(() => {
        void admin.from('communications').insert({
          opportunity_id: params.id,
          type: 'email',
          direction: 'outbound',
          subject,
          body: html,
          email_to: customerEmail,
          created_by: user.id,
        })
      }).catch(err => console.error('[status] notification email failed:', err))
    }
  }

  return NextResponse.json({ ok: true, newStatus })
}
