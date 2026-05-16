import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 })

  const supabase = createAdminClient()

  const { data: link } = await supabase
    .from('estimate_portal_links')
    .select('id, opportunity_id, quote_id, expires_at')
    .eq('token', token)
    .maybeSingle()

  if (!link || (link.expires_at && new Date(link.expires_at) < new Date())) {
    return NextResponse.json({ error: 'Estimate link is expired or invalid' }, { status: 404 })
  }

  const { data: opp } = await supabase
    .from('opportunities')
    .select('*, customer:customers!customer_id(full_name, email, phone)')
    .eq('id', link.opportunity_id)
    .eq('is_deleted', false)
    .single()

  if (!opp) return NextResponse.json({ error: 'Estimate not found' }, { status: 404 })

  // Check if already signed
  const { data: signature } = await supabase
    .from('estimate_signatures')
    .select('id')
    .eq('opportunity_id', link.opportunity_id)
    .maybeSingle()

  const customer = Array.isArray(opp.customer) ? opp.customer[0] : opp.customer

  function address(parts: Array<string | null | undefined>) {
    return parts.filter(Boolean).join(', ') || ''
  }

  return NextResponse.json({
    opportunityNumber: opp.opportunity_number,
    customerName:      customer?.full_name ?? '',
    customerEmail:     customer?.email ?? null,
    customerPhone:     customer?.phone ?? null,
    serviceDate:       opp.service_date ?? null,
    serviceType:       opp.service_type ?? 'local',
    moveSize:          opp.move_size ?? null,
    totalAmount:       Number(opp.total_amount ?? 0),
    depositAmount:     Number(opp.deposit_amount ?? 150) || 150,
    originAddress:     address([opp.origin_address_line1, opp.origin_address_line2, opp.origin_city, opp.origin_province, opp.origin_postal_code]),
    destAddress:       address([opp.dest_address_line1, opp.dest_address_line2, opp.dest_city, opp.dest_province, opp.dest_postal_code]),
    notes:             null, // never expose internal notes to customer
    alreadySigned:     Boolean(signature),
  })
}
