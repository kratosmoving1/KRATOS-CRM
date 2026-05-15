import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { hasPermission, isAdminRole } from '@/lib/auth/permissions'
import { requireActiveProfile } from '@/lib/auth/server'
import { logAuditEvent } from '@/lib/audit/logAuditEvent'
import type { Json } from '@/types/database'

function toPositiveCents(value: unknown) {
  const cents = Number(value)
  return Number.isInteger(cents) && cents > 0 ? cents : null
}

export async function POST(req: NextRequest) {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY
  if (!stripeSecretKey) {
    return NextResponse.json({ error: 'Stripe is not configured yet.' }, { status: 503 })
  }

  const supabase = createClient()
  const auth = await requireActiveProfile(supabase)
  if (auth.response) return auth.response
  const { user, profile } = auth.context

  const body = await req.json()
  const opportunityId = typeof body.opportunityId === 'string' ? body.opportunityId : null
  const quoteId = typeof body.quoteId === 'string' ? body.quoteId : null
  const requestedAmountCents = toPositiveCents(body.amountCents)

  if (!opportunityId) {
    return NextResponse.json({ error: 'opportunityId is required' }, { status: 400 })
  }

  const { data: opportunity, error: oppError } = await supabase
    .from('opportunities')
    .select('id, opportunity_number, customer_id, sales_agent_id, total_amount, customer:customers(full_name, email)')
    .eq('id', opportunityId)
    .eq('is_deleted', false)
    .single()

  if (oppError || !opportunity) {
    return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 })
  }

  const isAssigned = opportunity.sales_agent_id === user.id
  const canCreatePayment =
    isAdminRole(profile.role) ||
    hasPermission(profile.role, 'estimate:update') ||
    (isAssigned && hasPermission(profile.role, 'estimate:create'))

  if (!canCreatePayment) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const amountCents = requestedAmountCents ?? Math.round(Number(opportunity.total_amount ?? 0) * 100)
  if (!amountCents || amountCents <= 0) {
    return NextResponse.json({ error: 'Payment amount must be greater than zero' }, { status: 400 })
  }

  const origin = req.nextUrl.origin
  const customer = Array.isArray(opportunity.customer) ? opportunity.customer[0] : opportunity.customer
  const params = new URLSearchParams()
  params.set('mode', 'payment')
  params.set('client_reference_id', opportunityId)
  params.set('success_url', `${origin}/admin/opportunities/${opportunityId}/quote?payment=success`)
  params.set('cancel_url', `${origin}/admin/opportunities/${opportunityId}/quote?payment=cancelled`)
  params.set('metadata[opportunityId]', opportunityId)
  if (quoteId) params.set('metadata[quoteId]', quoteId)
  if (opportunity.customer_id) params.set('metadata[customerId]', opportunity.customer_id)
  params.set('metadata[createdBy]', user.id)
  params.set('metadata[source]', 'kratos_crm')
  params.set('line_items[0][quantity]', '1')
  params.set('line_items[0][price_data][currency]', 'cad')
  params.set('line_items[0][price_data][unit_amount]', String(amountCents))
  params.set(
    'line_items[0][price_data][product_data][name]',
    `Kratos Moving Quote ${opportunity.opportunity_number}`,
  )
  if (customer?.email) params.set('customer_email', customer.email)

  const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${stripeSecretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  })

  const session = await stripeRes.json()
  if (!stripeRes.ok) {
    console.error('Stripe checkout session failed:', session)
    return NextResponse.json({ error: session.error?.message ?? 'Stripe checkout failed' }, { status: 502 })
  }

  await logAuditEvent({
    actorUserId: user.id,
    action: 'payment_checkout_created',
    entityType: 'payment',
    entityId: opportunityId,
    oldData: null,
    newData: {
      stripeCheckoutSessionId: session.id,
      opportunityId,
      quoteId,
      customerId: opportunity.customer_id,
      amountCents,
      currency: 'cad',
    } as Json,
    ipAddress: req.headers.get('x-forwarded-for'),
    userAgent: req.headers.get('user-agent'),
  })

  return NextResponse.json({ url: session.url, sessionId: session.id })
}
