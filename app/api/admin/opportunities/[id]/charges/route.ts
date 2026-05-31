import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { hasPermission, isActiveUser } from '@/lib/auth/permissions'
import { logAuditEvent } from '@/lib/audit/logAuditEvent'
import { computeSubtotalFromConfig, applyDiscount } from '@/lib/charges/calculate'
import type { ChargeType } from '@/lib/charges/calculate'
import type { Json } from '@/types/database'

const ALLOWED_CHARGE_KEYS = new Set([
  'charge_type', 'name', 'description', 'config',
  'subtotal', 'discount_type', 'discount_value', 'discount_amount', 'total',
  'is_overridden', 'override_reason', 'sort_order',
])

function stripCharge(payload: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(payload).filter(([k]) => ALLOWED_CHARGE_KEYS.has(k)),
  )
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .single()

  if (!isActiveUser(profile)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: charges, error } = await supabase
    .from('opportunity_charges')
    .select('*')
    .eq('opportunity_id', params.id)
    .eq('is_deleted', false)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    console.error('charges GET error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(charges ?? [])
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .single()

  if (!isActiveUser(profile)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: opp } = await supabase
    .from('opportunities')
    .select('id, sales_agent_id')
    .eq('id', params.id)
    .eq('is_deleted', false)
    .single()

  if (!opp) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const canUpdateAny      = hasPermission(profile?.role, 'lead:update')
  const canUpdateAssigned = opp.sales_agent_id === user.id && hasPermission(profile?.role, 'lead:update_assigned')
  if (!canUpdateAny && !canUpdateAssigned) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const cleaned = stripCharge(body)

  if (!cleaned.charge_type || !cleaned.name?.toString().trim()) {
    return NextResponse.json({ error: 'charge_type and name are required' }, { status: 400 })
  }

  // Compute sort_order as max + 1 for this opportunity
  const { data: maxRow } = await supabase
    .from('opportunity_charges')
    .select('sort_order')
    .eq('opportunity_id', params.id)
    .eq('is_deleted', false)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const sort_order = (maxRow?.sort_order ?? -1) + 1

  // Recompute pricing server-side
  const config = (cleaned.config ?? {}) as Record<string, unknown>
  const charge_type = cleaned.charge_type as ChargeType
  const subtotal = cleaned.is_overridden
    ? Number(cleaned.subtotal ?? 0)
    : computeSubtotalFromConfig(charge_type, config)

  const discount_type = (cleaned.discount_type ?? null) as 'percent' | 'amount' | null
  const discount_value = cleaned.discount_value != null ? Number(cleaned.discount_value) : null
  const { discount_amount, total } = applyDiscount(subtotal, discount_type, discount_value)

  const insertPayload = {
    opportunity_id:  params.id,
    charge_type,
    name:            cleaned.name?.toString().trim() ?? '',
    description:     cleaned.description?.toString() ?? null,
    config,
    subtotal,
    discount_type,
    discount_value,
    discount_amount,
    total,
    is_overridden:   Boolean(cleaned.is_overridden),
    override_reason: cleaned.override_reason?.toString() ?? null,
    sort_order,
    created_by:      user.id,
    updated_by:      user.id,
  }

  if (charge_type === 'moving_labor') {
    const { data: existingLabor } = await supabase
      .from('opportunity_charges')
      .select('*')
      .eq('opportunity_id', params.id)
      .eq('charge_type', 'moving_labor')
      .eq('is_deleted', false)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (existingLabor) {
      const updatePayload = {
        charge_type,
        name:            insertPayload.name,
        description:     insertPayload.description,
        config,
        subtotal,
        discount_type,
        discount_value,
        discount_amount,
        total,
        is_overridden:   insertPayload.is_overridden,
        override_reason: insertPayload.override_reason,
        sort_order:      existingLabor.sort_order,
        updated_by:      user.id,
      }

      const { data: updated, error } = await supabase
        .from('opportunity_charges')
        .update(updatePayload)
        .eq('id', existingLabor.id)
        .select()
        .single()

      if (error) {
        console.error('charges POST update existing labor error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      await supabase.from('audit_log').insert({
        user_id:     user.id,
        entity_type: 'opportunity',
        entity_id:   params.id,
        action:      'update',
        diff:        { event: 'main_package_updated', chargeId: existingLabor.id, charge_type, total },
      })

      await logAuditEvent({
        actorUserId: user.id,
        action: 'update',
        entityType: 'opportunity_charge',
        entityId: existingLabor.id,
        oldData: existingLabor as unknown as Json,
        newData: updated as unknown as Json,
        ipAddress: req.headers.get('x-forwarded-for'),
        userAgent: req.headers.get('user-agent'),
      })

      return NextResponse.json(updated)
    }
  }

  const { data: charge, error } = await supabase
    .from('opportunity_charges')
    .insert(insertPayload)
    .select()
    .single()

  if (error) {
    console.error('charges POST error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await supabase.from('audit_log').insert({
    user_id:     user.id,
    entity_type: 'opportunity',
    entity_id:   params.id,
    action:      'update',
    diff:        { event: 'charge_added', charge_type, name: charge.name, total },
  })

  await logAuditEvent({
    actorUserId: user.id,
    action: 'create',
    entityType: 'opportunity_charge',
    entityId: charge.id,
    oldData: null,
    newData: charge as unknown as Json,
    ipAddress: req.headers.get('x-forwarded-for'),
    userAgent: req.headers.get('user-agent'),
  })

  return NextResponse.json(charge, { status: 201 })
}
