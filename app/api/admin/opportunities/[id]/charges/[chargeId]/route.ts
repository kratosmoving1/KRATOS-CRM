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

type RouteParams = { params: { id: string; chargeId: string } }

async function getChargeAndAuth(req: NextRequest, params: { id: string; chargeId: string }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401, supabase, user: null, profile: null, charge: null }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .single()

  if (!isActiveUser(profile)) return { error: 'Forbidden', status: 403, supabase, user, profile, charge: null }

  const { data: charge } = await supabase
    .from('opportunity_charges')
    .select('*, opportunity:opportunities(id, sales_agent_id)')
    .eq('id', params.chargeId)
    .eq('opportunity_id', params.id)
    .eq('is_deleted', false)
    .single()

  if (!charge) return { error: 'Not found', status: 404, supabase, user, profile, charge: null }

  const opp = charge.opportunity as { id: string; sales_agent_id: string | null } | null
  const canUpdateAny      = hasPermission(profile?.role, 'lead:update')
  const canUpdateAssigned = opp?.sales_agent_id === user.id && hasPermission(profile?.role, 'lead:update_assigned')
  if (!canUpdateAny && !canUpdateAssigned) return { error: 'Forbidden', status: 403, supabase, user, profile, charge: null }

  return { error: null, status: 200, supabase, user, profile, charge }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const auth = await getChargeAndAuth(req, params)
  if (auth.error || !auth.user || !auth.charge) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const { supabase, user, charge } = auth

  const body = await req.json()
  const cleaned = stripCharge(body)

  const config = (cleaned.config ?? charge.config) as Record<string, unknown>
  const charge_type = ((cleaned.charge_type ?? charge.charge_type) as ChargeType)
  const is_overridden = cleaned.is_overridden != null ? Boolean(cleaned.is_overridden) : charge.is_overridden

  const subtotal = is_overridden
    ? Number(cleaned.subtotal ?? charge.subtotal)
    : computeSubtotalFromConfig(charge_type, config)

  const discount_type = (cleaned.discount_type !== undefined
    ? cleaned.discount_type
    : charge.discount_type) as 'percent' | 'amount' | null
  const discount_value = cleaned.discount_value !== undefined
    ? (cleaned.discount_value != null ? Number(cleaned.discount_value) : null)
    : charge.discount_value
  const { discount_amount, total } = applyDiscount(subtotal, discount_type, discount_value)

  const updatePayload = {
    charge_type,
    name:            cleaned.name?.toString().trim() ?? charge.name,
    description:     cleaned.description !== undefined ? (cleaned.description?.toString() ?? null) : charge.description,
    config,
    subtotal,
    discount_type,
    discount_value,
    discount_amount,
    total,
    is_overridden,
    override_reason: cleaned.override_reason !== undefined ? (cleaned.override_reason?.toString() ?? null) : charge.override_reason,
    sort_order:      cleaned.sort_order != null ? Number(cleaned.sort_order) : charge.sort_order,
    updated_by:      user.id,
  }

  const { data: updated, error } = await supabase
    .from('opportunity_charges')
    .update(updatePayload)
    .eq('id', params.chargeId)
    .select()
    .single()

  if (error) {
    console.error('charge PATCH error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await supabase.from('audit_log').insert({
    user_id:     user.id,
    entity_type: 'opportunity',
    entity_id:   params.id,
    action:      'update',
    diff:        { event: 'charge_updated', chargeId: params.chargeId, charge_type, total },
  })

  await logAuditEvent({
    actorUserId: user.id,
    action: 'update',
    entityType: 'opportunity_charge',
    entityId: params.chargeId,
    oldData: charge as unknown as Json,
    newData: updated as unknown as Json,
    ipAddress: req.headers.get('x-forwarded-for'),
    userAgent: req.headers.get('user-agent'),
  })

  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const auth = await getChargeAndAuth(req, params)
  if (auth.error || !auth.user || !auth.charge) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const { supabase, user, charge } = auth

  const { error } = await supabase
    .from('opportunity_charges')
    .update({ is_deleted: true, deleted_at: new Date().toISOString() })
    .eq('id', params.chargeId)

  if (error) {
    console.error('charge DELETE error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await supabase.from('audit_log').insert({
    user_id:     user.id,
    entity_type: 'opportunity',
    entity_id:   params.id,
    action:      'update',
    diff:        { event: 'charge_deleted', chargeId: params.chargeId, name: charge.name },
  })

  await logAuditEvent({
    actorUserId: user.id,
    action: 'delete',
    entityType: 'opportunity_charge',
    entityId: params.chargeId,
    oldData: charge as unknown as Json,
    newData: null,
    ipAddress: req.headers.get('x-forwarded-for'),
    userAgent: req.headers.get('user-agent'),
  })

  return new NextResponse(null, { status: 204 })
}
