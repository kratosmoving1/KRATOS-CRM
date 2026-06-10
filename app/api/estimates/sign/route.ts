import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

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

  // Resolve customer name from the opportunity
  type CustomerRow = { full_name: string }[] | { full_name: string } | null
  const { data: opp } = await supabase
    .from('opportunities')
    .select('customer:customers!customer_id(full_name)')
    .eq('id', link.opportunity_id)
    .single()

  const rawCustomer = opp?.customer as CustomerRow
  const customerName = (Array.isArray(rawCustomer) ? rawCustomer[0]?.full_name : rawCustomer?.full_name) ?? 'Customer'

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

  return NextResponse.json({ ok: true })
}
