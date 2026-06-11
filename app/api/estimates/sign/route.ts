import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email/sendEmail'
import { buildBookingConfirmationHtml } from '@/lib/email/estimateEmailHtml'
import { formatQuoteNumber } from '@/lib/opportunityDisplay'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { token } = body

  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { data: link } = await supabase
    .from('estimate_portal_links')
    .select('id, opportunity_id, quote_id, expires_at')
    .eq('token', token)
    .maybeSingle()

  if (!link || (link.expires_at && new Date(link.expires_at) < new Date())) {
    return NextResponse.json({ error: 'Estimate link is expired or invalid' }, { status: 404 })
  }

  // If already accepted, return ok — idempotent
  const { data: existing } = await supabase
    .from('estimate_signatures')
    .select('id')
    .eq('opportunity_id', link.opportunity_id)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ ok: true, alreadyAccepted: true })
  }

  // Resolve customer + move details from the opportunity
  type CustomerRow = { full_name: string; email: string | null }[] | { full_name: string; email: string | null } | null
  type AgentRow    = { full_name: string | null }[] | { full_name: string | null } | null
  const { data: opp } = await supabase
    .from('opportunities')
    .select('opportunity_number, service_type, service_date, origin_address_line1, origin_city, origin_province, dest_address_line1, dest_city, dest_province, customer:customers!customer_id(full_name, email), agent:profiles!sales_agent_id(full_name)')
    .eq('id', link.opportunity_id)
    .single()

  const rawCustomer = opp?.customer as CustomerRow
  const rawAgent    = opp?.agent as AgentRow
  const customerRow = Array.isArray(rawCustomer) ? rawCustomer[0] ?? null : rawCustomer
  const agentRow    = Array.isArray(rawAgent)    ? rawAgent[0] ?? null    : rawAgent
  const customerName  = customerRow?.full_name ?? 'Customer'
  const customerEmail = customerRow?.email ?? null

  const ipAddress = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? null
  const userAgent = req.headers.get('user-agent') ?? null

  const { error: sigErr } = await supabase
    .from('estimate_signatures')
    .insert({
      opportunity_id: link.opportunity_id,
      quote_id:       link.quote_id ?? null,
      portal_link_id: link.id,
      signed_name:    customerName,
      ip_address:     ipAddress,
      user_agent:     userAgent,
      signed_at:      new Date().toISOString(),
    })

  if (sigErr) {
    console.error('estimate_signatures insert error:', sigErr)
    return NextResponse.json({ error: sigErr.message }, { status: 500 })
  }

  await supabase.from('audit_log').insert({
    user_id:     null,
    entity_type: 'opportunity',
    entity_id:   link.opportunity_id,
    action:      'update',
    diff:        { event: 'estimate_accepted', customer_name: customerName },
  })

  await supabase
    .from('opportunities')
    .update({ accepted_at: new Date().toISOString() })
    .eq('id', link.opportunity_id)

  // Send booking confirmation email (fire-and-forget — never block the response)
  if (customerEmail) {
    const companyPhone = process.env.COMPANY_PHONE ?? '(800) 321-3222'
    const appOriginUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin
    const portalLink   = `${appOriginUrl}/portal/estimate/${token}`
    const moveDateLabel = opp?.service_date
      ? new Date(opp.service_date + 'T12:00:00').toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' })
      : 'To be confirmed'
    const serviceTypeLabel = String(opp?.service_type ?? 'Moving').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    const origin = [opp?.origin_address_line1, opp?.origin_city, opp?.origin_province].filter(Boolean).join(', ')
    const destination = [opp?.dest_address_line1, opp?.dest_city, opp?.dest_province].filter(Boolean).join(', ')
    const firstName = customerName.trim().split(/\s+/)[0] ?? customerName
    const agentFirstName = agentRow?.full_name?.trim().split(/\s+/)[0] ?? ''
    const quoteNumber = formatQuoteNumber(opp?.opportunity_number ?? '')
    const html = buildBookingConfirmationHtml({
      customerFirstName: firstName,
      customerFullName: customerName,
      quoteNumber,
      moveDate: moveDateLabel,
      serviceType: serviceTypeLabel,
      originAddress: origin,
      destinationAddress: destination,
      companyPhone,
      agentFirstName,
      portalLink,
    })
    const confirmSubject = `Your Move is Confirmed — Kratos Moving #${quoteNumber}`
    const confirmText = `Hi ${firstName}, your Kratos Moving estimate has been accepted and your move date is secured. A coordinator will be in touch shortly. — Kratos Moving`
    try {
      await sendEmail({
        to: customerEmail,
        subject: confirmSubject,
        text: confirmText,
        html,
        fromName: 'Kratos Moving',
        fromEmail: process.env.EMAIL_FROM_DEFAULT ?? '',
      })
      await supabase.from('communications').insert({
        opportunity_id: link.opportunity_id,
        type: 'email',
        direction: 'outbound',
        subject: confirmSubject,
        body: html,
        email_to: customerEmail,
      })
    } catch (err) {
      console.error('[sign] confirmation email failed:', err)
    }
  }

  return NextResponse.json({ ok: true })
}
