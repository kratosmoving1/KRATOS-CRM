import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { token, signedName } = body

  if (!token || !signedName?.trim()) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
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

  // Check if already signed
  const { data: existing } = await supabase
    .from('estimate_signatures')
    .select('id')
    .eq('opportunity_id', link.opportunity_id)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'This estimate has already been signed' }, { status: 409 })
  }

  const ipAddress = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? null
  const userAgent = req.headers.get('user-agent') ?? null

  const { error: sigErr } = await supabase
    .from('estimate_signatures')
    .insert({
      opportunity_id:  link.opportunity_id,
      quote_id:        link.quote_id ?? null,
      portal_link_id:  link.id,
      signed_name:     signedName.trim(),
      ip_address:      ipAddress,
      user_agent:      userAgent,
      signed_at:       new Date().toISOString(),
    })

  if (sigErr) {
    console.error('estimate_signatures insert error:', sigErr)
    return NextResponse.json({ error: sigErr.message }, { status: 500 })
  }

  // Mark opportunity as estimate_signed in audit_log
  await supabase.from('audit_log').insert({
    user_id:     null,
    entity_type: 'opportunity',
    entity_id:   link.opportunity_id,
    action:      'update',
    diff:        { event: 'estimate_signed', signed_name: signedName.trim() },
  })

  // Optionally update estimate_sent_at / accepted_at on opportunity if columns exist
  await supabase
    .from('opportunities')
    .update({ accepted_at: new Date().toISOString() })
    .eq('id', link.opportunity_id)

  return NextResponse.json({ ok: true })
}
