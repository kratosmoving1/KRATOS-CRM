import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { STATUS_TIMESTAMP_MAP } from '@/lib/constants'
import type { OppStatus } from '@/lib/constants'

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status    = searchParams.get('status')
  const search    = searchParams.get('search')
  const agentId   = searchParams.get('agent_id')
  const sortBy    = searchParams.get('sort_by') ?? 'created_at'
  const sortDir   = searchParams.get('sort_dir') ?? 'desc'
  const page      = parseInt(searchParams.get('page') ?? '1')
  const pageSize  = 25

  let query = supabase
    .from('opportunities')
    .select(`
      *,
      customer:customers(id, full_name, email, phone),
      agent:profiles!sales_agent_id(id, full_name),
      lead_source:lead_sources(id, name)
    `, { count: 'exact' })
    .eq('is_deleted', false)

  if (status && status !== 'all') query = query.eq('status', status)
  if (agentId) query = query.eq('sales_agent_id', agentId)
  if (search) {
    query = query.or(
      `opportunity_number.ilike.%${search}%,customers.full_name.ilike.%${search}%`
    )
  }

  query = query
    .order(sortBy, { ascending: sortDir === 'asc' })
    .range((page - 1) * pageSize, page * pageSize - 1)

  const { data, error, count } = await query

  if (error) {
    console.error('Opportunities GET error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, count, page, pageSize })
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  // Generate opportunity number
  const year = new Date().getFullYear()
  const { data: maxRow } = await supabase
    .from('opportunities')
    .select('opportunity_number')
    .like('opportunity_number', `KM-${year}-%`)
    .order('opportunity_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  let seq = 1
  if (maxRow?.opportunity_number) {
    const parts = maxRow.opportunity_number.split('-')
    seq = parseInt(parts[2] ?? '0') + 1
  }
  const opportunityNumber = `KM-${year}-${String(seq).padStart(5, '0')}`

  // Create or find customer
  let customerId: string
  if (body.customer_id) {
    customerId = body.customer_id
  } else {
    const { data: customer, error: custErr } = await supabase
      .from('customers')
      .insert({
        full_name:           body.customer_name,
        phone:               body.customer_phone || null,
        phone_type:          body.customer_phone_type || null,
        secondary_phone:     body.customer_secondary_phone || null,
        secondary_phone_type: body.customer_secondary_phone_type || null,
        email:               body.customer_email || null,
      })
      .select()
      .single()

    if (custErr) {
      console.error('Customer create error:', custErr)
      return NextResponse.json({ error: custErr.message }, { status: 500 })
    }
    customerId = customer.id
  }

  // Build opportunity payload — only include session-2 cols if they exist
  const status = (body.status ?? 'opportunity') as OppStatus
  const nowIso = new Date().toISOString()
  const tsKey  = STATUS_TIMESTAMP_MAP[status]

  const oppPayload: Record<string, unknown> = {
    opportunity_number: opportunityNumber,
    customer_id:        customerId,
    sales_agent_id:     body.sales_agent_id ?? user.id,
    lead_source_id:     body.lead_source_id ?? null,
    service_type:       body.service_type ?? 'local',
    status,
    move_size:          body.move_size ?? null,
    service_date:       body.service_date ?? null,
    notes:              body.notes ?? null,
    total_amount:       body.total_amount ?? 0,
    estimated_cost:     body.estimated_cost ?? 0,
    // origin
    origin_address_line1: body.origin_address_line1 ?? null,
    origin_address_line2: body.origin_address_line2 ?? null,
    origin_city:        body.origin_city ?? null,
    origin_province:    body.origin_province ?? null,
    origin_postal_code: body.origin_postal_code ?? null,
    origin_dwelling_type: body.origin_dwelling_type ?? null,
    origin_floor:       body.origin_floor ?? null,
    origin_has_elevator: body.origin_has_elevator ?? null,
    origin_stairs:      body.origin_stairs ?? null,
    origin_long_carry:  body.origin_long_carry ?? null,
    origin_parking_notes: body.origin_parking_notes ?? null,
    // destination
    dest_address_line1: body.dest_address_line1 ?? null,
    dest_address_line2: body.dest_address_line2 ?? null,
    dest_city:          body.dest_city ?? null,
    dest_province:      body.dest_province ?? null,
    dest_postal_code:   body.dest_postal_code ?? null,
    dest_dwelling_type: body.dest_dwelling_type ?? null,
    dest_floor:         body.dest_floor ?? null,
    dest_has_elevator:  body.dest_has_elevator ?? null,
    dest_stairs:        body.dest_stairs ?? null,
    dest_long_carry:    body.dest_long_carry ?? null,
    dest_parking_notes: body.dest_parking_notes ?? null,
    // pickup/dropoff cities for backward compat with dashboard
    pickup_city:        body.origin_city ?? null,
    dropoff_city:       body.dest_city ?? null,
  }
  if (tsKey) oppPayload[tsKey] = nowIso

  const { data: opp, error: oppErr } = await supabase
    .from('opportunities')
    .insert(oppPayload)
    .select()
    .single()

  if (oppErr) {
    console.error('Opportunity create error:', oppErr)
    return NextResponse.json({ error: oppErr.message }, { status: 500 })
  }

  // Audit log
  await supabase.from('audit_log').insert({
    user_id:     user.id,
    entity_type: 'opportunity',
    entity_id:   opp.id,
    action:      'create',
    diff:        { opportunity_number: opportunityNumber, status },
  })

  return NextResponse.json(opp, { status: 201 })
}
