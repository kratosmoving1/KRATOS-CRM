/**
 * Public Stripe deposit checkout for the customer estimate portal.
 * No CRM auth required — uses the portal token to identify the quote.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

function appOrigin(req: NextRequest) {
  return process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin
}

export async function POST(req: NextRequest) {
  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (!stripeKey) {
    return NextResponse.json({ error: 'Online payment is not configured. Please call Kratos Moving to pay your deposit.' }, { status: 503 })
  }

  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const token = typeof body.token === 'string' ? body.token : null
  if (!token) return NextResponse.json({ error: 'Missing portal token' }, { status: 400 })

  const supabase = createAdminClient()

  const { data: link } = await supabase
    .from('estimate_portal_links')
    .select('id, opportunity_id, expires_at')
    .eq('token', token)
    .maybeSingle()

  if (!link || (link.expires_at && new Date(link.expires_at) < new Date())) {
    return NextResponse.json({ error: 'This estimate link is expired or invalid.' }, { status: 404 })
  }

  type CustomerField = { full_name: string; email: string | null }[] | { full_name: string; email: string | null } | null
  const { data: opp } = await supabase
    .from('opportunities')
    .select('id, opportunity_number, deposit_amount, total_amount, customer_id, customer:customers!customer_id(full_name, email)')
    .eq('id', link.opportunity_id)
    .not('is_deleted', 'is', 'true')
    .single()

  if (!opp) return NextResponse.json({ error: 'Estimate not found.' }, { status: 404 })

  const rawCustomer = opp.customer as unknown as CustomerField
  const customer = Array.isArray(rawCustomer) ? rawCustomer[0] ?? null : rawCustomer

  // Resolve deposit amount
  const requestedDeposit = typeof body.depositAmount === 'number' ? body.depositAmount : null
  const savedDeposit = Number(opp.deposit_amount ?? 150)
  const deposit = requestedDeposit ?? (Number.isFinite(savedDeposit) && savedDeposit > 0 ? savedDeposit : 150)
  const depositCents = Math.round(deposit * 100)

  if (depositCents < 100) {
    return NextResponse.json({ error: 'Deposit must be at least $1.00.' }, { status: 400 })
  }

  const origin = appOrigin(req)
  const successUrl = `${origin}/portal/estimate/${token}?payment=success`
  const cancelUrl  = `${origin}/portal/estimate/${token}`

  const params = new URLSearchParams()
  params.set('mode', 'payment')
  params.set('client_reference_id', opp.id)
  params.set('success_url', successUrl)
  params.set('cancel_url', cancelUrl)
  params.set('metadata[opportunityId]', opp.id)
  params.set('metadata[source]', 'customer_portal')
  params.set('metadata[portalToken]', token)
  params.set('metadata[customerId]', opp.customer_id)
  params.set('line_items[0][quantity]', '1')
  params.set('line_items[0][price_data][currency]', 'cad')
  params.set('line_items[0][price_data][unit_amount]', String(depositCents))
  params.set('line_items[0][price_data][product_data][name]', `Moving Deposit — Kratos Moving Quote #${opp.opportunity_number}`)
  params.set('line_items[0][price_data][product_data][description]', `Deposit to secure your moving date.`)
  if (customer?.email) params.set('customer_email', customer.email)

  const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  })

  const session = await stripeRes.json() as { id?: string; url?: string; error?: { message?: string } }

  if (!stripeRes.ok) {
    console.error('[PortalCheckout] Stripe session creation failed:', { opportunityId: opp.id, error: session.error })
    return NextResponse.json({
      error: 'Unable to start payment. Please call Kratos Moving at (800) 321-3222.',
    }, { status: 502 })
  }

  // Log the checkout attempt on the opportunity
  try {
    await supabase.from('audit_log').insert({
      user_id:     null,
      entity_type: 'opportunity',
      entity_id:   opp.id,
      action:      'update',
      diff:        { event: 'customer_deposit_checkout_started', depositCents, stripeSessionId: session.id },
    })
  } catch { /* audit failure must not block checkout redirect */ }

  return NextResponse.json({ url: session.url, sessionId: session.id })
}
