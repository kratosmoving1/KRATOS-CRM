import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { PACKAGE_TIERS, getRateForDate } from '@/lib/packages/tiers'
import { logAuditEvent } from '@/lib/audit/logAuditEvent'
import type { Json } from '@/types/database'

const MINIMUM_HOURS = 3

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { tier_id } = await req.json()
  const tier = PACKAGE_TIERS.find(t => t.id === tier_id)
  if (!tier) {
    return NextResponse.json({ error: `Unknown tier: ${tier_id}` }, { status: 400 })
  }

  // Fetch opportunity — use service_date (the actual column name per SCHEMA.md)
  // Use .neq('is_deleted', true) to correctly include rows where is_deleted IS NULL
  const { data: opp, error: oppErr } = await supabase
    .from('opportunities')
    .select('id, service_date')
    .eq('id', params.id)
    .neq('is_deleted', true)
    .maybeSingle()

  if (oppErr || !opp) {
    return NextResponse.json({ error: `Opportunity ${params.id} not found` }, { status: 404 })
  }

  const { rate, isWeekend } = getRateForDate(tier, opp.service_date)

  console.log('[apply-package]', {
    opportunity_id: params.id,
    tier_id: tier.id,
    move_date: opp.service_date,
    resolved_rate: rate,
    is_weekend: isWeekend,
  })

  const labor_hours = MINIMUM_HOURS
  const billable_hours = MINIMUM_HOURS
  const subtotal = +(billable_hours * rate).toFixed(2)
  const description = `${billable_hours}h @ $${rate.toFixed(2)}/hr (${tier.num_trucks} truck, ${tier.num_crew} crew)${isWeekend ? ' — Weekend rate' : ''}`

  const config = {
    tier_id: tier.id,
    package_name: tier.label,
    num_trucks: tier.num_trucks,
    num_crew: tier.num_crew,
    hourly_rate: rate,
    is_weekend_rate: isWeekend,
    labor_hours,
    travel_hours: 0,
    billable_hours,
    minimum_hours: MINIMUM_HOURS,
    total_hours: labor_hours,
    load_hours: 0,
    unload_hours: 0,
    handling_buffer_hours: 0,
    distance_km: null,
    drive_time_minutes: null,
    handicap_origin: 0,
    handicap_stops: 0,
    handicap_dest: 0,
  }

  // Check for an existing Moving Labor charge — update it rather than inserting a duplicate
  const { data: existing } = await supabase
    .from('opportunity_charges')
    .select('id, sort_order')
    .eq('opportunity_id', params.id)
    .eq('charge_type', 'moving_labor')
    .neq('is_deleted', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (existing) {
    const { data: updated, error: updErr } = await supabase
      .from('opportunity_charges')
      .update({
        name: `${tier.label} Package — Moving Labor`,
        description,
        config,
        subtotal,
        discount_type: null,
        discount_value: null,
        discount_amount: 0,
        total: subtotal,
        is_overridden: false,
        override_reason: null,
        updated_by: user.id,
      })
      .eq('id', existing.id)
      .select()
      .single()

    if (updErr) {
      console.error('apply-package update error:', updErr)
      return NextResponse.json({ error: updErr.message }, { status: 500 })
    }

    await supabase.from('audit_log').insert({
      user_id: user.id,
      entity_type: 'opportunity',
      entity_id: params.id,
      action: 'update',
      diff: { event: 'main_package_updated', tier_id: tier.id, chargeId: existing.id, total: subtotal },
    })

    await logAuditEvent({
      actorUserId: user.id,
      action: 'update',
      entityType: 'opportunity_charge',
      entityId: existing.id,
      oldData: null,
      newData: updated as unknown as Json,
      ipAddress: req.headers.get('x-forwarded-for'),
      userAgent: req.headers.get('user-agent'),
    })

    return NextResponse.json({ updated: existing.id, tier_id: tier.id }, { status: 200 })
  }

  // No existing Moving Labor charge — insert new
  const { data: maxRow } = await supabase
    .from('opportunity_charges')
    .select('sort_order')
    .eq('opportunity_id', params.id)
    .neq('is_deleted', true)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const sort_order = (maxRow?.sort_order ?? -1) + 1

  const { data: created, error: insErr } = await supabase
    .from('opportunity_charges')
    .insert({
      opportunity_id: params.id,
      charge_type: 'moving_labor',
      name: `${tier.label} Package — Moving Labor`,
      description,
      config,
      subtotal,
      discount_type: null,
      discount_value: null,
      discount_amount: 0,
      total: subtotal,
      is_overridden: false,
      override_reason: null,
      sort_order,
      created_by: user.id,
      updated_by: user.id,
    })
    .select()
    .single()

  if (insErr) {
    console.error('apply-package insert error:', insErr)
    return NextResponse.json({ error: insErr.message }, { status: 500 })
  }

  await supabase.from('audit_log').insert({
    user_id: user.id,
    entity_type: 'opportunity',
    entity_id: params.id,
    action: 'update',
    diff: { event: 'main_package_applied', tier_id: tier.id, chargeId: created.id, total: subtotal },
  })

  await logAuditEvent({
    actorUserId: user.id,
    action: 'create',
    entityType: 'opportunity_charge',
    entityId: created.id,
    oldData: null,
    newData: created as unknown as Json,
    ipAddress: req.headers.get('x-forwarded-for'),
    userAgent: req.headers.get('user-agent'),
  })

  return NextResponse.json({ created: created.id, tier_id: tier.id }, { status: 201 })
}
